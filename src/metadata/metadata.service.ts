import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as http from 'http';

export type CloudPlatform = 'aws' | 'gcp' | null;

export interface NetworkInterface {
  private_ip: string;
  public_ip: string | null;
  network: string;
}

export interface MetadataResponse {
  cloud_platform: string;
  instance_id: string;
  region: string;
  machine_type: string;
  network_interfaces: NetworkInterface[];
}

@Injectable()
export class MetadataService implements OnModuleInit {
  private readonly logger = new Logger(MetadataService.name);
  private platform: CloudPlatform = null;
  private imdsv2Token: string | null = null;

  async onModuleInit() {
    this.platform = await this.detectPlatform();
    this.logger.log(`Detected cloud platform: ${this.platform ?? 'none'}`);
  }

  getPlatform(): CloudPlatform {
    return this.platform;
  }

  private async detectPlatform(): Promise<CloudPlatform> {
    // Try GCP first
    const isGcp = await this.probe(
      'metadata.google.internal',
      '/computeMetadata/v1/',
      { 'Metadata-Flavor': 'Google' },
    );
    if (isGcp) return 'gcp';

    // Try AWS IMDSv2 - get token first
    try {
      const token = await this.getImdsv2Token();
      if (token) {
        this.imdsv2Token = token;
        return 'aws';
      }
    } catch {
      // fall through
    }

    // Try AWS IMDSv1 as fallback
    const isAws = await this.probe('169.254.169.254', '/latest/meta-data/');
    if (isAws) return 'aws';

    return null;
  }

  // Get IMDSv2 token
  private getImdsv2Token(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '169.254.169.254',
          path: '/latest/api/token',
          method: 'PUT',
          headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
          timeout: 2000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200 && data) {
              resolve(data.trim());
            } else {
              reject(new Error('IMDSv2 token request failed'));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  // HTTP probe with 2 second timeout
  private probe(
    host: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        { host, path, method: 'GET', headers, timeout: 2000 },
        (res) => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
          res.resume();
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  // Fetch metadata value - uses IMDSv2 token for AWS if available
  private fetchMetadata(
    host: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<string> {
    // Add IMDSv2 token for AWS requests
    const finalHeaders = { ...headers };
    if (host === '169.254.169.254' && this.imdsv2Token) {
      finalHeaders['X-aws-ec2-metadata-token'] = this.imdsv2Token;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        { host, path, method: 'GET', headers: finalHeaders, timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data.trim());
            } else {
              reject(new Error(`HTTP ${res.statusCode} for ${path}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  // ------------------------------------------------------------------ //
  // AWS metadata retrieval
  // ------------------------------------------------------------------ //

  async getAwsMetadata(): Promise<MetadataResponse> {
    const host = '169.254.169.254';
    const get = (path: string) => this.fetchMetadata(host, path);

    const instance_id = await get('/latest/meta-data/instance-id');
    const az = await get('/latest/meta-data/placement/availability-zone');
    const machine_type = await get('/latest/meta-data/instance-type');

    // region = availability zone minus last character (e.g. us-east-1a -> us-east-1)
    const region = az.slice(0, -1);

    // Get list of MACs
    const macsRaw = await get('/latest/meta-data/network/interfaces/macs/');
    const macs = macsRaw.split('\n').map((m) => m.replace(/\/$/, '')).filter(Boolean);

    const network_interfaces: NetworkInterface[] = await Promise.all(
      macs.map(async (mac) => {
        const base = `/latest/meta-data/network/interfaces/macs/${mac}`;
        const private_ip = await get(`${base}/local-ipv4s`);
        const network = await get(`${base}/vpc-id`);

        let public_ip: string | null = null;
        try {
          public_ip = await get(`${base}/public-ipv4s`);
        } catch {
          public_ip = null;
        }

        return { private_ip, public_ip, network };
      }),
    );

    return { cloud_platform: 'aws', instance_id, region, machine_type, network_interfaces };
  }

  // ------------------------------------------------------------------ //
  // GCP metadata retrieval
  // ------------------------------------------------------------------ //

  async getGcpMetadata(): Promise<MetadataResponse> {
    const host = 'metadata.google.internal';
    const headers = { 'Metadata-Flavor': 'Google' };
    const get = (path: string) => this.fetchMetadata(host, path, headers);

    const instance_id = await get('/computeMetadata/v1/instance/id');
    const zoneRaw = await get('/computeMetadata/v1/instance/zone');
    const region = zoneRaw.split('/').pop() ?? zoneRaw;
    const machineRaw = await get('/computeMetadata/v1/instance/machine-type');
    const machine_type = machineRaw.split('/').pop() ?? machineRaw;

    const ifaceIndexes = await get('/computeMetadata/v1/instance/network-interfaces/');
    const indexes = ifaceIndexes.split('\n').map((i) => i.replace(/\/$/, '')).filter(Boolean);

    const network_interfaces: NetworkInterface[] = await Promise.all(
      indexes.map(async (idx) => {
        const base = `/computeMetadata/v1/instance/network-interfaces/${idx}`;
        const private_ip = await get(`${base}/ip`);
        const networkRaw = await get(`${base}/network`);
        const network = networkRaw.split('/').pop() ?? networkRaw;

        let public_ip: string | null = null;
        try {
          public_ip = await get(`${base}/access-configs/0/external-ip`);
        } catch {
          public_ip = null;
        }

        return { private_ip, public_ip, network };
      }),
    );

    return { cloud_platform: 'gcp', instance_id, region, machine_type, network_interfaces };
  }

  // ------------------------------------------------------------------ //
  // Main entry point
  // ------------------------------------------------------------------ //

  async getMetadata(): Promise<MetadataResponse> {
    if (this.platform === 'aws') return this.getAwsMetadata();
    if (this.platform === 'gcp') return this.getGcpMetadata();
    throw new Error('No supported cloud platform detected');
  }
}
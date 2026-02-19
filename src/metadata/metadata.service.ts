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

  // Detect platform once at startup and cache it
  async onModuleInit() {
    this.platform = await this.detectPlatform();
    this.logger.log(`Detected cloud platform: ${this.platform ?? 'none'}`);
  }

  getPlatform(): CloudPlatform {
    return this.platform;
  }

  // Try GCP first, then AWS, with short timeouts
  private async detectPlatform(): Promise<CloudPlatform> {
    const isGcp = await this.probe(
      'metadata.google.internal',
      '/computeMetadata/v1/',
      { 'Metadata-Flavor': 'Google' },
    );
    if (isGcp) return 'gcp';

    const isAws = await this.probe('169.254.169.254', '/latest/meta-data/');
    if (isAws) return 'aws';

    return null;
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

  // Fetch a single metadata value as plain text
  private fetchMetadata(
    host: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host, path, method: 'GET', headers, timeout: 5000 },
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

    // zone returns e.g. projects/123/zones/us-east1-b — we want just us-east1-b
    const zoneRaw = await get('/computeMetadata/v1/instance/zone');
    const region = zoneRaw.split('/').pop() ?? zoneRaw;

    // machine-type returns e.g. projects/123/machineTypes/e2-medium — we want e2-medium
    const machineRaw = await get('/computeMetadata/v1/instance/machine-type');
    const machine_type = machineRaw.split('/').pop() ?? machineRaw;

    // Get number of network interfaces
    const ifaceIndexes = await get('/computeMetadata/v1/instance/network-interfaces/');
    const indexes = ifaceIndexes.split('\n').map((i) => i.replace(/\/$/, '')).filter(Boolean);

    const network_interfaces: NetworkInterface[] = await Promise.all(
      indexes.map(async (idx) => {
        const base = `/computeMetadata/v1/instance/network-interfaces/${idx}`;
        const private_ip = await get(`${base}/ip`);

        // network returns full path — extract just the network name
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
  // Main entry point called by controller
  // ------------------------------------------------------------------ //

  async getMetadata(): Promise<MetadataResponse> {
    if (this.platform === 'aws') return this.getAwsMetadata();
    if (this.platform === 'gcp') return this.getGcpMetadata();
    throw new Error('No supported cloud platform detected');
  }
}
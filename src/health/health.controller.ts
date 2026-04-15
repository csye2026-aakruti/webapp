import { Controller, Get, Req, Res, HttpStatus, All } from '@nestjs/common';
import express from 'express';
import { HealthService } from './health.service';
import { AppLogger } from '../logger/logger.service';
import { MetricsService } from '../logger/metrics.service';

@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {}

  @All('healthz')
  @All('healthz1234')
  async handleAll(@Req() req: express.Request, @Res() res: express.Response) {
    const start = Date.now();

    if (req.method === 'HEAD') {
      return res.status(405).set('Cache-Control', 'no-cache').send();
    }

    if (req.method === 'GET') {
      this.metrics.incrementApiCall('healthz');
      this.logger.log('GET /healthz called', 'HealthController');

      const hasPayload =
        (req.headers['content-length'] && req.headers['content-length'] !== '0') ||
        !!req.headers['transfer-encoding'];

      if (hasPayload) {
        return res.status(HttpStatus.BAD_REQUEST).set('Cache-Control', 'no-cache').send();
      }

      const ok = await this.healthService.insertHealthCheck();

      this.metrics.timeApiCall('healthz', Date.now() - start);

      if (!ok) {
        this.logger.error('Health check failed - database unavailable', '', 'HealthController');
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).set('Cache-Control', 'no-cache').send();
      }

      this.logger.log('GET /healthz succeeded', 'HealthController');
      return res.status(HttpStatus.OK).set('Cache-Control', 'no-cache').send();
    }

    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
}
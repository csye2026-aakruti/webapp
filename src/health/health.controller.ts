import { Controller, Get, Req, Res, HttpStatus, All } from '@nestjs/common';
import express from 'express';
import { HealthService } from './health.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Handle all requests and check for HEAD method
  @All()
  async handleAll(@Req() req: express.Request, @Res() res: express.Response) {
    if (req.method === 'HEAD') {
      return res.status(405).set('Cache-Control', 'no-cache').send();
    }

    if (req.method === 'GET') {
      // Spec: no payload allowed on GET
      const hasPayload =
        (req.headers['content-length'] && req.headers['content-length'] !== '0') ||
        !!req.headers['transfer-encoding'];

      if (hasPayload) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .set('Cache-Control', 'no-cache')
          .send();
      }

      // Perform health check logic
      const ok = await this.healthService.insertHealthCheck();

      if (!ok) {
        return res
          .status(HttpStatus.SERVICE_UNAVAILABLE)
          .set('Cache-Control', 'no-cache')
          .send();
      }

      return res
        .status(HttpStatus.OK)
        .set('Cache-Control', 'no-cache')
        .send();
    }

    // Return 405 for all other methods
    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
}
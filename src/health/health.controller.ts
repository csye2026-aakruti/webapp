import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  async healthz(@Req() req: Request, @Res() res: Response) {
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

  // Non-GET must be 405
  @Post('healthz') postNotAllowed(@Res() res: Response) {
    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
  @Put('healthz') putNotAllowed(@Res() res: Response) {
    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
  @Patch('healthz') patchNotAllowed(@Res() res: Response) {
    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
  @Delete('healthz') deleteNotAllowed(@Res() res: Response) {
    return res.status(405).set('Cache-Control', 'no-cache').send();
  }
}
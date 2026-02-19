import { Controller, All, Req, Res, HttpStatus } from '@nestjs/common';
import express from 'express';
import { MetadataService } from './metadata.service';

@Controller('v1/metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @All()
  async handleAll(@Req() req: express.Request, @Res() res: express.Response) {
    // Set cache headers on every response
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    });

    // Only GET is allowed
    if (req.method !== 'GET') {
      return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
    }

    // No query parameters allowed
    if (Object.keys(req.query).length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Query parameters are not allowed',
      });
    }

    // No request body allowed
    const hasBody =
      (req.headers['content-length'] && req.headers['content-length'] !== '0') ||
      !!req.headers['transfer-encoding'];

    if (hasBody) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Request body is not allowed',
      });
    }

    // Check if running on a supported cloud platform
    const platform = this.metadataService.getPlatform();
    if (!platform) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'Service Unavailable',
        message: 'Application is not running on a supported cloud platform',
      });
    }

    // Fetch and return metadata
    try {
      const metadata = await this.metadataService.getMetadata();
      return res.status(HttpStatus.OK).json(metadata);
    } catch (err) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'Service Unavailable',
        message: 'Failed to retrieve instance metadata',
      });
    }
  }
}
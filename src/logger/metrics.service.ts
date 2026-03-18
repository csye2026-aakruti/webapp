import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StatsD = require('node-statsd');

@Injectable()
export class MetricsService {
  private client: InstanceType<typeof StatsD>;

  constructor() {
    this.client = new StatsD({
      host: 'localhost',
      port: 8125,
      prefix: 'webapp.',
    });
  }

  incrementApiCall(apiName: string) {
    this.client.increment(`api.${apiName}.count`);
  }

  timeApiCall(apiName: string, durationMs: number) {
    this.client.timing(`api.${apiName}.duration`, durationMs);
  }

  timeDbQuery(queryName: string, durationMs: number) {
    this.client.timing(`db.${queryName}.duration`, durationMs);
  }

  timeS3Operation(operationName: string, durationMs: number) {
    this.client.timing(`s3.${operationName}.duration`, durationMs);
  }
}
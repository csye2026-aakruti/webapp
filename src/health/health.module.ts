import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheck } from './health-check.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HealthCheck])],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
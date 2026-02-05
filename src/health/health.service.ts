import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthCheck } from './health-check.entity';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(HealthCheck)
    private readonly healthRepo: Repository<HealthCheck>,
  ) {}

  async insertHealthCheck(): Promise<boolean> {
    try {
      await this.healthRepo.insert({});
      return true;
    } catch {
      return false;
    }
  }
}
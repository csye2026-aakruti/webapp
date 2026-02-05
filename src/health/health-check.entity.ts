import { Entity, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'health_checks' })
export class HealthCheck {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  check_id: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz', name: 'check_datetime' })
  check_datetime: Date;
}
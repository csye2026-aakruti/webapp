import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @CreateDateColumn({ type: 'timestamp' })
  account_created: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  account_updated: Date;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verification_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  token_expires_at: Date | null;
}
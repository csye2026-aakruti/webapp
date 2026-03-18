import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { HealthCheck } from './health/health-check.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetadataModule } from './metadata/metadata.module';
import { CoursesModule } from './courses/courses.module';
import { AppLogger } from './logger/logger.service';
import { MetricsService } from './logger/metrics.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: true,
      autoLoadEntities: true,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    UsersModule,
    AuthModule,
    TypeOrmModule.forFeature([HealthCheck]),
    MetadataModule,
    CoursesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService,AppLogger,MetricsService],
})
export class AppModule {}
 
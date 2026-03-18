import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './course.entity';
import { Syllabus } from './syllabus.entity';
import { UsersModule } from '../users/users.module';
import { AppLogger } from '../logger/logger.service';
import { MetricsService } from '../logger/metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Syllabus]),
    UsersModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService,AppLogger,MetricsService],
})
export class CoursesModule {}
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Res,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import express from 'express';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ValidationPipe } from '@nestjs/common';
import { AppLogger } from '../logger/logger.service';
import { MetricsService } from '../logger/metrics.service';

const IMMUTABLE_FIELDS = [
  'id',
  'department_code',
  'number',
  'has_syllabus',
  'date_created',
  'date_updated',
];

@Controller('v1/courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  async findAll(@Res() res: express.Response) {
    const start = Date.now();
    this.metrics.incrementApiCall('courses.list');
    this.logger.log('GET /v1/courses called', 'CoursesController');
    const courses = await this.coursesService.findAll();
    this.metrics.timeApiCall('courses.list', Date.now() - start);
    return res.status(HttpStatus.OK).json(courses);
  }

  @Post()
  async create(
    @Req() req: express.Request,
    @Body() rawBody: Record<string, any>,
    @Headers('content-type') contentType: string,
    @Res() res: express.Response,
  ) {
    const start = Date.now();
    this.metrics.incrementApiCall('courses.create');
    this.logger.log('POST /v1/courses called', 'CoursesController');

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      });
    }

    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    let dto: CreateCourseDto;
    try {
      dto = await pipe.transform(rawBody, {
        type: 'body',
        metatype: CreateCourseDto,
      });
    } catch {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Validation failed',
      });
    }

    const course = await this.coursesService.create(dto);
    this.metrics.timeApiCall('courses.create', Date.now() - start);
    this.logger.log(`Course created: ${course.id}`, 'CoursesController');
    return res
      .status(HttpStatus.CREATED)
      .header('Location', `/v1/courses/${course.id}`)
      .json(course);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Res() res: express.Response) {
    const start = Date.now();
    this.metrics.incrementApiCall('courses.get');
    this.logger.log(`GET /v1/courses/${id} called`, 'CoursesController');
    const course = await this.coursesService.findOne(id);
    this.metrics.timeApiCall('courses.get', Date.now() - start);
    return res.status(HttpStatus.OK).json(course);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Headers('content-type') contentType: string,
    @Res() res: express.Response,
  ) {
    const start = Date.now();
    this.metrics.incrementApiCall('courses.update');
    this.logger.log(`PUT /v1/courses/${id} called`, 'CoursesController');

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      });
    }

    const immutableAttempted = IMMUTABLE_FIELDS.filter((f) => f in body);
    if (immutableAttempted.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: `Cannot update immutable fields: ${immutableAttempted.join(', ')}`,
      });
    }

    if (!body || Object.keys(body).length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Request body must contain at least one updatable field',
      });
    }

    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    let dto: UpdateCourseDto;
    try {
      dto = await pipe.transform(body, {
        type: 'body',
        metatype: UpdateCourseDto,
      });
    } catch {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Validation failed',
      });
    }

    if (!dto || Object.keys(dto).length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Request body must contain at least one updatable field',
      });
    }

    const course = await this.coursesService.update(id, dto);
    this.metrics.timeApiCall('courses.update', Date.now() - start);
    return res.status(HttpStatus.OK).json(course);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: express.Response) {
    const start = Date.now();
    this.metrics.incrementApiCall('courses.delete');
    this.logger.log(`DELETE /v1/courses/${id} called`, 'CoursesController');
    await this.coursesService.remove(id);
    this.metrics.timeApiCall('courses.delete', Date.now() - start);
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  @Get(':id/syllabus')
  async getSyllabus(@Param('id') id: string, @Res() res: express.Response) {
    const start = Date.now();
    this.metrics.incrementApiCall('syllabus.get');
    this.logger.log(`GET /v1/courses/${id}/syllabus called`, 'CoursesController');
    const syllabus = await this.coursesService.getSyllabus(id);
    this.metrics.timeApiCall('syllabus.get', Date.now() - start);
    return res.status(HttpStatus.OK).json(syllabus);
  }

  @Post(':id/syllabus')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSyllabus(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: express.Response,
  ) {
    const start = Date.now();
    this.metrics.incrementApiCall('syllabus.upload');
    this.logger.log(`POST /v1/courses/${id}/syllabus called`, 'CoursesController');

    if (!file || file.size === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'File is required and must not be empty',
      });
    }

    const syllabus = await this.coursesService.uploadSyllabus(id, file);
    this.metrics.timeApiCall('syllabus.upload', Date.now() - start);
    this.logger.log(`Syllabus uploaded for course ${id}`, 'CoursesController');
    return res
      .status(HttpStatus.CREATED)
      .header('Location', `/v1/courses/${id}/syllabus`)
      .json(syllabus);
  }

  @Delete(':id/syllabus')
  async deleteSyllabus(@Param('id') id: string, @Res() res: express.Response) {
    const start = Date.now();
    this.metrics.incrementApiCall('syllabus.delete');
    this.logger.log(`DELETE /v1/courses/${id}/syllabus called`, 'CoursesController');
    await this.coursesService.deleteSyllabus(id);
    this.metrics.timeApiCall('syllabus.delete', Date.now() - start);
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
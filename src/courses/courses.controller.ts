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
    constructor(private readonly coursesService: CoursesService) {}
  
    // ------------------------------------------------------------------ //
    // GET /v1/courses
    // ------------------------------------------------------------------ //
    @Get()
    async findAll(@Res() res: express.Response) {
      const courses = await this.coursesService.findAll();
      return res.status(HttpStatus.OK).json(courses);
    }
  
    // ------------------------------------------------------------------ //
    // POST /v1/courses
    // ------------------------------------------------------------------ //
    @Post()
    async create(
      @Body(new ValidationPipe({ whitelist: true, transform: true }))
      dto: CreateCourseDto,
      @Headers('content-type') contentType: string,
      @Res() res: express.Response,
    ) {
      // Require application/json
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json',
        });
      }
  
      const course = await this.coursesService.create(dto);
      return res
        .status(HttpStatus.CREATED)
        .header('Location', `/v1/courses/${course.id}`)
        .json(course);
    }
  
    // ------------------------------------------------------------------ //
    // GET /v1/courses/:id
    // ------------------------------------------------------------------ //
    @Get(':id')
    async findOne(@Param('id') id: string, @Res() res: express.Response) {
      const course = await this.coursesService.findOne(id);
      return res.status(HttpStatus.OK).json(course);
    }
  
    // ------------------------------------------------------------------ //
    // PUT /v1/courses/:id
    // ------------------------------------------------------------------ //
    @Put(':id')
    async update(
      @Param('id') id: string,
      @Body() body: Record<string, any>,
      @Headers('content-type') contentType: string,
      @Res() res: express.Response,
    ) {
      // Require application/json
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json',
        });
      }
  
      // Check for immutable fields
      const immutableAttempted = IMMUTABLE_FIELDS.filter((f) => f in body);
      if (immutableAttempted.length > 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Bad Request',
          message: `Cannot update immutable fields: ${immutableAttempted.join(', ')}`,
        });
      }
  
      // Require at least one updatable field
      if (!body || Object.keys(body).length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'Request body must contain at least one updatable field',
        });
      }
  
      // Validate the body
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
  
      // Check that after whitelisting, at least one field remains
      if (!dto || Object.keys(dto).length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'Request body must contain at least one updatable field',
        });
      }
  
      const course = await this.coursesService.update(id, dto);
      return res.status(HttpStatus.OK).json(course);
    }
  
    // ------------------------------------------------------------------ //
    // DELETE /v1/courses/:id
    // ------------------------------------------------------------------ //
    @Delete(':id')
    async remove(@Param('id') id: string, @Res() res: express.Response) {
      await this.coursesService.remove(id);
      return res.status(HttpStatus.NO_CONTENT).send();
    }
  
    // ------------------------------------------------------------------ //
    // GET /v1/courses/:id/syllabus
    // ------------------------------------------------------------------ //
    @Get(':id/syllabus')
    async getSyllabus(@Param('id') id: string, @Res() res: express.Response) {
      const syllabus = await this.coursesService.getSyllabus(id);
      return res.status(HttpStatus.OK).json(syllabus);
    }
  
    // ------------------------------------------------------------------ //
    // POST /v1/courses/:id/syllabus
    // ------------------------------------------------------------------ //
    @Post(':id/syllabus')
    @UseInterceptors(FileInterceptor('file'))
    async uploadSyllabus(
      @Param('id') id: string,
      @UploadedFile() file: Express.Multer.File,
      @Res() res: express.Response,
    ) {
      if (!file || file.size === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'File is required and must not be empty',
        });
      }
  
      const syllabus = await this.coursesService.uploadSyllabus(id, file);
      return res
        .status(HttpStatus.CREATED)
        .header('Location', `/v1/courses/${id}/syllabus`)
        .json(syllabus);
    }
  
    // ------------------------------------------------------------------ //
    // DELETE /v1/courses/:id/syllabus
    // ------------------------------------------------------------------ //
    @Delete(':id/syllabus')
    async deleteSyllabus(@Param('id') id: string, @Res() res: express.Response) {
      await this.coursesService.deleteSyllabus(id);
      return res.status(HttpStatus.NO_CONTENT).send();
    }
  }
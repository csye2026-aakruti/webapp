import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Course } from './course.entity';
import { Syllabus } from './syllabus.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AppLogger } from '../logger/logger.service';
import { MetricsService } from '../logger/metrics.service';

@Injectable()
export class CoursesService {
  private s3: S3Client;
  private bucketName: string;

  constructor(
    @InjectRepository(Course)
    private courseRepo: Repository<Course>,
    @InjectRepository(Syllabus)
    private syllabusRepo: Repository<Syllabus>,
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {
    this.bucketName = process.env.S3_BUCKET_NAME ?? '';
    this.s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
  }

  async findAll(): Promise<Course[]> {
    const start = Date.now();
    const result = await this.courseRepo.find({
      order: { department_code: 'ASC', number: 'ASC' },
    });
    this.metrics.timeDbQuery('courses.findAll', Date.now() - start);
    return result;
  }

  async findOne(id: string): Promise<Course> {
    const start = Date.now();
    const course = await this.courseRepo.findOne({ where: { id } });
    this.metrics.timeDbQuery('courses.findOne', Date.now() - start);
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  async create(dto: CreateCourseDto): Promise<Course> {
    const start = Date.now();
    const existing = await this.courseRepo.findOne({
      where: { department_code: dto.department_code, number: dto.number },
    });
    if (existing) {
      throw new ConflictException(
        `Course ${dto.department_code} ${dto.number} already exists`,
      );
    }
    const course = this.courseRepo.create({ ...dto, has_syllabus: false });
    const saved = await this.courseRepo.save(course);
    this.metrics.timeDbQuery('courses.create', Date.now() - start);
    return saved;
  }

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id);
    Object.assign(course, dto);
    const start = Date.now();
    const saved = await this.courseRepo.save(course);
    this.metrics.timeDbQuery('courses.update', Date.now() - start);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const course = await this.findOne(id);
    if (course.has_syllabus) {
      throw new ConflictException(
        'Cannot delete course with an attached syllabus. Delete the syllabus first.',
      );
    }
    const start = Date.now();
    await this.courseRepo.remove(course);
    this.metrics.timeDbQuery('courses.remove', Date.now() - start);
  }

  async getSyllabus(courseId: string): Promise<Syllabus> {
    await this.findOne(courseId);
    const start = Date.now();
    const syllabus = await this.syllabusRepo.findOne({
      where: { course_id: courseId },
    });
    this.metrics.timeDbQuery('syllabus.findOne', Date.now() - start);
    if (!syllabus) {
      throw new NotFoundException(`No syllabus found for course ${courseId}`);
    }
    return syllabus;
  }

  async uploadSyllabus(
    courseId: string,
    file: Express.Multer.File,
  ): Promise<Syllabus> {
    const course = await this.findOne(courseId);

    if (course.has_syllabus) {
      throw new ConflictException('Course already has a syllabus');
    }

    if (!file || file.size === 0) {
      throw new BadRequestException('File is required and must not be empty');
    }

    const fileUuid = randomUUID();
    const s3Key = `${courseId}/${fileUuid}/${file.originalname}`;

    // Upload to S3 with timing
    const s3Start = Date.now();
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      this.metrics.timeS3Operation('putObject', Date.now() - s3Start);
      this.logger.log(`File uploaded to S3: ${s3Key}`, 'CoursesService');
    } catch (err) {
      this.logger.error('Failed to upload file to S3', err.stack, 'CoursesService');
      throw err;
    }

    const url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

    // Save metadata to DB
    const dbStart = Date.now();
    const syllabus = this.syllabusRepo.create({
      course_id: courseId,
      file_name: file.originalname,
      s3_bucket_name: this.bucketName,
      s3_object_key: s3Key,
      content_type: file.mimetype,
      file_size: file.size,
      url,
    });
    const saved = await this.syllabusRepo.save(syllabus);
    this.metrics.timeDbQuery('syllabus.save', Date.now() - dbStart);

    await this.courseRepo.update(courseId, { has_syllabus: true });

    return saved;
  }

  async deleteSyllabus(courseId: string): Promise<void> {
    await this.findOne(courseId);

    const syllabus = await this.syllabusRepo.findOne({
      where: { course_id: courseId },
    });
    if (!syllabus) {
      throw new NotFoundException(`No syllabus found for course ${courseId}`);
    }

    // Delete from S3 with timing
    const s3Start = Date.now();
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: syllabus.s3_object_key,
        }),
      );
      this.metrics.timeS3Operation('deleteObject', Date.now() - s3Start);
      this.logger.log(`File deleted from S3: ${syllabus.s3_object_key}`, 'CoursesService');
    } catch (err) {
      this.logger.error('Failed to delete file from S3', err.stack, 'CoursesService');
      throw err;
    }

    // Delete from DB with timing
    const dbStart = Date.now();
    await this.syllabusRepo.remove(syllabus);
    this.metrics.timeDbQuery('syllabus.remove', Date.now() - dbStart);

    await this.courseRepo.update(courseId, { has_syllabus: false });
  }
}
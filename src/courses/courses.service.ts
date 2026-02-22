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
  
  @Injectable()
  export class CoursesService {
    private s3: S3Client;
    private bucketName: string;
  
    constructor(
      @InjectRepository(Course)
      private courseRepo: Repository<Course>,
      @InjectRepository(Syllabus)
      private syllabusRepo: Repository<Syllabus>,
    ) {
      this.bucketName = process.env.S3_BUCKET_NAME ?? '';
      this.s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
    }
  
    // ------------------------------------------------------------------ //
    // Course CRUD
    // ------------------------------------------------------------------ //
  
    async findAll(): Promise<Course[]> {
      return this.courseRepo.find({
        order: { department_code: 'ASC', number: 'ASC' },
      });
    }
  
    async findOne(id: string): Promise<Course> {
      const course = await this.courseRepo.findOne({ where: { id } });
      if (!course) throw new NotFoundException(`Course ${id} not found`);
      return course;
    }
  
    async create(dto: CreateCourseDto): Promise<Course> {
      // Check uniqueness of department_code + number
      const existing = await this.courseRepo.findOne({
        where: { department_code: dto.department_code, number: dto.number },
      });
      if (existing) {
        throw new ConflictException(
          `Course ${dto.department_code} ${dto.number} already exists`,
        );
      }
  
      const course = this.courseRepo.create({
        ...dto,
        has_syllabus: false,
      });
      return this.courseRepo.save(course);
    }
  
    async update(id: string, dto: UpdateCourseDto): Promise<Course> {
      const course = await this.findOne(id);
      Object.assign(course, dto);
      return this.courseRepo.save(course);
    }
  
    async remove(id: string): Promise<void> {
      const course = await this.findOne(id);
      if (course.has_syllabus) {
        throw new ConflictException(
          'Cannot delete course with an attached syllabus. Delete the syllabus first.',
        );
      }
      await this.courseRepo.remove(course);
    }
  
    // ------------------------------------------------------------------ //
    // Syllabus
    // ------------------------------------------------------------------ //
  
    async getSyllabus(courseId: string): Promise<Syllabus> {
      await this.findOne(courseId); // 404 if course not found
      const syllabus = await this.syllabusRepo.findOne({
        where: { course_id: courseId },
      });
      if (!syllabus) {
        throw new NotFoundException(`No syllabus found for course ${courseId}`);
      }
      return syllabus;
    }
  
    async uploadSyllabus(
      courseId: string,
      file: Express.Multer.File,
    ): Promise<Syllabus> {
      const course = await this.findOne(courseId); // 404 if not found
  
      if (course.has_syllabus) {
        throw new ConflictException('Course already has a syllabus');
      }
  
      if (!file || file.size === 0) {
        throw new BadRequestException('File is required and must not be empty');
      }
  
      // Build unique S3 key: {course_id}/{uuid}/{original_filename}
      const fileUuid = randomUUID();
      const s3Key = `${courseId}/${fileUuid}/${file.originalname}`;
  
      // Upload to S3
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
  
      const url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
  
      // Save metadata to DB
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
  
      // Update course has_syllabus flag
      await this.courseRepo.update(courseId, { has_syllabus: true });
  
      return saved;
    }
  
    async deleteSyllabus(courseId: string): Promise<void> {
      await this.findOne(courseId); // 404 if course not found
  
      const syllabus = await this.syllabusRepo.findOne({
        where: { course_id: courseId },
      });
      if (!syllabus) {
        throw new NotFoundException(`No syllabus found for course ${courseId}`);
      }
  
      // Delete from S3
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: syllabus.s3_object_key,
        }),
      );
  
      // Delete from DB
      await this.syllabusRepo.remove(syllabus);
  
      // Update course has_syllabus flag
      await this.courseRepo.update(courseId, { has_syllabus: false });
    }
  }
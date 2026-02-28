import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
  } from 'typeorm';
  import { Course } from './course.entity';
  
  @Entity('syllabi')
  export class Syllabus {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    course_id: string;
  
    @Column()
    file_name: string;
  
    @Column()
    s3_bucket_name: string;
  
    @Column()
    s3_object_key: string;
  
    @Column()
    content_type: string;
  
    @Column()
    file_size: number;
  
    @Column()
    url: string;
  
    @CreateDateColumn({ type: 'timestamp' })
    date_created: Date;
  
    @UpdateDateColumn({ type: 'timestamp' })
    date_updated: Date;
  
    @OneToOne(() => Course, (course) => course.syllabus)
    @JoinColumn({ name: 'course_id' })
    course: Course;
  }
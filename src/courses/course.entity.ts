import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
  } from 'typeorm';
  import { Syllabus } from './syllabus.entity';
  
  @Entity('courses')
  export class Course {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ length: 6 })
    department_code: string;
  
    @Column({ length: 6 })
    number: string;
  
    @Column({ length: 255 })
    title: string;
  
    @Column()
    credit_hours: number;
  
    @Column()
    classification: string;
  
    @Column({ type: 'varchar', length: 2000, nullable: true })
    description: string | null;
    
    @Column({ type: 'varchar', length: 512, nullable: true })
    prerequisites: string | null;
  
    @Column({ default: false })
    has_syllabus: boolean;
  
    @CreateDateColumn({ type: 'timestamp' })
    date_created: Date;
  
    @UpdateDateColumn({ type: 'timestamp' })
    date_updated: Date;
  
    @OneToOne(() => Syllabus, (syllabus) => syllabus.course, { nullable: true })
    syllabus: Syllabus;
  }
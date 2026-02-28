import {
    IsString,
    IsInt,
    Min,
    Max,
    IsIn,
    IsOptional,
    MaxLength,
    MinLength,
  } from 'class-validator';
  
  export class UpdateCourseDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    title?: string;
  
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(8)
    credit_hours?: number;
  
    @IsOptional()
    @IsIn(['core', 'elective'], {
      message: 'classification must be core or elective',
    })
    classification?: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(512)
    prerequisites?: string;
  }
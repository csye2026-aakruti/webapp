import {
    IsString,
    IsNotEmpty,
    IsInt,
    Min,
    Max,
    IsIn,
    IsOptional,
    MaxLength,
    Matches,
    MinLength,
  } from 'class-validator';
  
  export class CreateCourseDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^[A-Z]{2,6}$/, {
      message: 'department_code must be 2-6 uppercase letters only',
    })
    department_code: string;
  
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(6)
    number: string;
  
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(255)
    title: string;
  
    @IsInt()
    @Min(1)
    @Max(8)
    credit_hours: number;
  
    @IsIn(['core', 'elective'], {
      message: 'classification must be core or elective',
    })
    classification: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(512)
    prerequisites?: string;
  }
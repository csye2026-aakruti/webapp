import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  username: string;

  @IsNotEmpty({ message: 'Password is required' })
  @Length(8, 32, { message: 'Password must be between 8 and 32 characters' })
  password: string;

  @IsNotEmpty({ message: 'First name is required' })
  first_name: string;

  @IsNotEmpty({ message: 'Last name is required' })
  last_name: string;
}
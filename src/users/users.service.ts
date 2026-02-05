import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // Create a new user
  async create(userData: Partial<User>): Promise<User> {
    const { username, password, first_name, last_name } = userData;

    // Validate required fields
    if (!username || !password || !first_name || !last_name) {
      throw new BadRequestException('All fields are required');
    }

    // Check if the username already exists
    const existingUser = await this.usersRepository.findOneBy({ username });
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const newUser = this.usersRepository.create({
      username,
      password: hashedPassword,   // ✅ store bcrypt hash
      first_name,
      last_name,
      account_created: new Date(),
      account_updated: new Date(),
    });
    
    const saved = await this.usersRepository.save(newUser);
    
    // dont return password
    return {
      id: saved.id,
      username: saved.username,
      first_name: saved.first_name,
      last_name: saved.last_name,
      account_created: saved.account_created,
      account_updated: saved.account_updated,
    } as any;
  }

  // Fetch a user by ID
  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  // Fetch a user by username
  async findOneByUsername(username: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ username });
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    return user;
  }

  async findOneByUsernameWithPassword(username: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ username });
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    return user; // includes password hash from DB
  }

  // Update user information
  async update(id: string, updateData: Partial<User>): Promise<void> {
    const user = await this.findOne(id); // Ensure the user exists

    // Validate allowed fields
    const allowedFields = ['first_name', 'last_name', 'password'];
    const invalidFields = Object.keys(updateData).filter(
      (key) => !allowedFields.includes(key),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Invalid fields: ${invalidFields.join(', ')}`,
      );
    }

    // Hash the password if it's being updated
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Update the user and set the account_updated timestamp
    await this.usersRepository.update(id, {
      ...updateData,
      account_updated: new Date(),
    });
  }
}
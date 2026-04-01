import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const { username, password, first_name, last_name } = userData;

    if (!username || !password || !first_name || !last_name) {
      throw new BadRequestException('All fields are required');
    }

    const existingUser = await this.usersRepository.findOneBy({ username });
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verification_token = randomUUID();
    const token_expires_at = new Date(Date.now() + 60 * 1000); // 1 minute

    const newUser = this.usersRepository.create({
      username,
      password: hashedPassword,
      first_name,
      last_name,
      verified: false,
      verification_token,
      token_expires_at,
    });

    const saved = await this.usersRepository.save(newUser);

    // Publish to SNS
    await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({
        email: saved.username,
        firstName: saved.first_name,
        token: saved.verification_token,
      }),
    }));

    return {
      id: saved.id,
      username: saved.username,
      first_name: saved.first_name,
      last_name: saved.last_name,
      account_created: saved.account_created,
      account_updated: saved.account_updated,
    } as any;
  }

  async verifyEmail(email: string, token: string): Promise<void> {
    const user = await this.usersRepository.findOneBy({ username: email });

    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }

    if (user.verified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.verification_token !== token) {
      throw new BadRequestException('Invalid token');
    }

    if (!user.token_expires_at || new Date() > user.token_expires_at) {
      throw new BadRequestException('Verification link has expired');
    }

    await this.usersRepository.update(user.id, {
      verified: true,
      verification_token: null,
      token_expires_at: null,
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

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
    return user;
  }

  async update(id: string, updateData: Partial<User>): Promise<void> {
    const user = await this.findOne(id);

    if (!user.verified) {
      throw new ForbiddenException('Email address has not been verified');
    }

    const allowedFields = ['first_name', 'last_name', 'password'];
    const invalidFields = Object.keys(updateData).filter(
      (key) => !allowedFields.includes(key),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(`Invalid fields: ${invalidFields.join(', ')}`);
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    await this.usersRepository.update(id, {
      ...updateData,
      account_updated: new Date(),
    });
  }
}
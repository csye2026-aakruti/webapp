import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import type { Request } from 'express';

declare namespace Express {
  export interface Request {
    user?: { id: string };
  }
}

import { AuthGuard } from '../auth/auth.guard';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('v1/user')
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get('v1/user/self')
  @UseGuards(AuthGuard)
  async getSelf(@Req() req: Request): Promise<User> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const user = await this.usersService.findOne(userId);

    if (!user.verified) {
      throw new ForbiddenException('Email address has not been verified');
    }

    delete (user as Partial<User>).password;
    return user;
  }

  @Put('v1/user/self')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateSelf(
    @Req() req: Request,
    @Body() updateData: Partial<User>,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    await this.usersService.update(userId, updateData);
  }

  @Get('v1/validateEmail')
  async validateEmail(
    @Query('email') email: string,
    @Query('token') token: string,
  ): Promise<{ message: string }> {
    if (!email || !token) {
      throw new BadRequestException('Email and token are required');
    }
    await this.usersService.verifyEmail(email, token);
    return { message: 'Email verified successfully' };
  }

  @Get('v1/user/:id')
  findOne(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findOne(id);
  }
}
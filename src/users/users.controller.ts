import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Req,
  BadRequestException,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import type { Request } from 'express';

// Ensure the extended type is included
declare namespace Express {
  export interface Request {
    user?: { id: string }; // Extend the Request type to include the user property
  }
}

import { AuthGuard } from '../auth/auth.guard';

@Controller('v1/user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Create a new user
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  // Get user information (self)
  @UseGuards(AuthGuard)
  @Get('self')
  async getSelf(@Req() req: Request): Promise<User> {
    const userId = req.user?.id; // Ensure `user` is optional and safely accessed
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    delete (user as Partial<User>).password; // Ensure password is not returned
    return user;
  }

  // Update user information (self)
  @UseGuards(AuthGuard)
  @Put('self')
  @HttpCode(HttpStatus.NO_CONTENT)   // 👈 THIS IS THE KEY LINE
  async updateSelf(
    @Req() req: Request,
    @Body() updateData: Partial<User>,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
  
    await this.usersService.update(userId, updateData);
  
    return; // 👈 explicitly return nothing
  }

 
  @Get(':id')
  findOne(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findOne(id);
  }
}

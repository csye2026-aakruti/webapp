import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException();
    }

    const base64Credentials = authHeader.slice('Basic '.length).trim();
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');

    const i = decoded.indexOf(':');
    if (i < 0) throw new UnauthorizedException();

    const username = decoded.slice(0, i);
    const password = decoded.slice(i + 1);
    if (!username || !password) throw new UnauthorizedException();

    try {
      const user = await this.usersService.findOneByUsernameWithPassword(username);

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException();

      (req as any).user = { id: user.id };
      return true;
    } catch {
      // ✅ Hide whether user exists or not
      throw new UnauthorizedException();
    }
  }
}
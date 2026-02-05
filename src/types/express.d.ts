import { User } from '../users/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string }; // Extend the Request type to include the user property
    }
  }
}
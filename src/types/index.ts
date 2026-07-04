import { UserRole } from '@prisma/client';

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedRequestUser;
    }
  }
}

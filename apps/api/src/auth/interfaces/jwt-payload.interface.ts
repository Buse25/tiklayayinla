import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  jti?: string;
  email?: string;
  role?: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

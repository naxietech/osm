import type { UserRole } from './roles.types';
import type { SafeUser } from './user.types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

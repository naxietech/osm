import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { LoginRequest, LoginResponse, SafeUser } from '@oses/types';
import { UserRole } from '@oses/types';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(dto: LoginRequest): Promise<LoginResponse> {
    // TODO: replace stub with real database lookup and password verification
    const user = this.getMockUser();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: `mock-refresh-${Date.now()}`,
        expiresIn: 900,
      },
    };
  }

  private getMockUser(): SafeUser {
    return {
      id: 'usr_mock_admin_001',
      email: 'admin@oses.pk',
      role: UserRole.ADMIN,
      fullName: 'System Administrator',
      createdAt: new Date().toISOString(),
    };
  }
}

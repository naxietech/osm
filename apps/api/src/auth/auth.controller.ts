import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { PermissionGrant, SafeUser } from '@oses/types';

import { AUTH_CONFIG, type AuthConfig } from '../config/auth.config';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { type LoginDto, LoginDtoSchema } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthPrincipal } from './principal';
import { AuthService, type LoginContext, PermissionResolver, SessionService } from './services';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly permissions: PermissionResolver,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate with email + password; sets HttpOnly auth cookies' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'superadmin@oses.pk' },
        password: {
          type: 'string',
          minLength: 6,
          example: 'change-me-to-a-strong-password-min-12-chars',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Authenticated — access + refresh cookies set' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body(new ZodValidationPipe(LoginDtoSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, accessToken, refreshToken } = await this.authService.login(dto, contextFrom(req));
    setAuthCookies(res, { accessToken, refreshToken }, this.authConfig);
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and reissue auth cookies' })
  @ApiResponse({ status: 200, description: 'Rotated — new cookies set' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired, or reused session' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SafeUser> {
    const token = this.readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Missing session');
    const { user, accessToken, refreshToken } = await this.sessionService.refresh(
      token,
      contextFrom(req),
    );
    setAuthCookies(res, { accessToken, refreshToken }, this.authConfig);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.sessionService.logout(this.readRefreshCookie(req), contextFrom(req));
    clearAuthCookies(res, this.authConfig);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@CurrentUser() principal: AuthPrincipal): Promise<SafeUser> {
    return this.authService.getCurrentUser(principal.sub);
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "The authenticated user's permission grants (action + scope)" })
  @ApiResponse({ status: 200, description: 'Grant list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPermissions(@CurrentUser() principal: AuthPrincipal): Promise<PermissionGrant[]> {
    return this.permissions.grantsFor(principal.roleId);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[this.authConfig.refreshCookieName];
  }
}

function contextFrom(req: Request): LoginContext {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

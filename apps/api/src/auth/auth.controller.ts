import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Throttle } from '../common/guards/throttle.guard.js';
import type { JwtPayload } from './auth.service.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ limit: 5, ttl: 60 })
  @ApiOperation({ summary: 'Register a new account' })
  async register(
    @Body() body: { email: string; password: string; name: string },
  ): Promise<{ token: string; userId: string }> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 10, ttl: 60 })
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() body: { email: string; password: string },
  ): Promise<{ token: string; userId: string; orgId: string | null }> {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session' })
  me(@Request() req: RequestWithUser): JwtPayload {
    return req.user;
  }
}

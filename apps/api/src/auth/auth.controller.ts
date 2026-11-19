import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, SessionToken, UserId } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './dto.js';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(normalizeEmail(body.email), body.password);
  }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(normalizeEmail(body.email), body.password);
  }

  @Post('auth/logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@SessionToken() token: string): Promise<void> {
    await this.auth.logout(token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@UserId() userId: string) {
    return this.auth.me(userId);
  }
}

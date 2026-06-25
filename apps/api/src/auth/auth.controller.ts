import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/auth.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';

class RequestMagicLinkDto {
  @IsEmail()
  email!: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('magic-link')
  requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.auth.requestMagicLink(dto.email);
  }

  @Public()
  @Get('verify')
  async verify(@Query('token') token: string) {
    if (!token) {
      throw new HttpException('Token required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.auth.verifyMagicLink(token);
    } catch {
      throw new HttpException('Invalid or expired link', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.auth.getMe(user.id);
  }
}

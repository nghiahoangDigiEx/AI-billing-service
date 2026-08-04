import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponse } from '@/common/decorators/api-standard-response.decorator';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { RefreshDto } from '@/modules/auth/dto/refresh.dto';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { AuthResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { UserResponseDto } from '@/modules/user/dto/user-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiStandardResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User with this email already exists.',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and get tokens' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged in.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid email or password.',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access tokens' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token.',
  })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refreshToken(refreshDto.refreshToken);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to application with tokens.',
  })
  googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { accessToken: string; refreshToken: string };
    const { accessToken, refreshToken } = user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }
}

import { Controller, Get, Post, Body, UseGuards, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentification & Keycloak')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private sessionCookie(request: Request, response: Response, token: string) {
    response.cookie('school_refresh', token, {
      httpOnly: true,
      secure: request.secure || request.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private refreshCookie(request: Request) {
    const raw = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('school_refresh='));
    return raw ? decodeURIComponent(raw.slice('school_refresh='.length)) : '';
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Connexion directe Keycloak (Obtention de token JWT)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'admin' },
        password: { type: 'string', example: 'admin123' },
      },
      required: ['username', 'password'],
    },
  })
  async login(@Body() body: { username: string; password: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.authService.directLogin(body.username, body.password);
    this.sessionCookie(request, response, tokens.refresh_token);
    const { refresh_token: _refreshToken, ...publicTokens } = tokens;
    return publicTokens;
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = this.refreshCookie(request);
    if (!token) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    const tokens = await this.authService.refresh(token);
    this.sessionCookie(request, response, tokens.refresh_token);
    const { refresh_token: _refreshToken, ...publicTokens } = tokens;
    return publicTokens;
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = this.refreshCookie(request);
    response.clearCookie('school_refresh', { path: '/api/auth' });
    await this.authService.logout(token);
    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté (Keycloak + Base de données)' })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user);
  }
}

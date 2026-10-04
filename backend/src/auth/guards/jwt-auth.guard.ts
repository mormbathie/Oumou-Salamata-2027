import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { isObservable, lastValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector, private prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const result = super.canActivate(context);
    const authenticated = isObservable(result) ? await lastValueFrom(result) : await result;
    const path = request.path.replace(/\/$/, '');
    const allowed = (request.method === 'GET' && path === '/api/auth/me') ||
      (request.method === 'POST' && path === '/api/users/me/password');
    if (!allowed) {
      const user = await this.prisma.user.findUnique({ where: { keycloakId: request.user.userId }, select: { mustChangePassword: true } });
      if (user?.mustChangePassword) throw new ForbiddenException({ code: 'PASSWORD_UPDATE_REQUIRED', message: 'Changez votre mot de passe provisoire pour continuer.' });
    }
    return authenticated;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Session manquante ou expirée. Reconnectez-vous.');
    }
    return user;
  }
}

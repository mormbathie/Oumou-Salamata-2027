import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      throw new ForbiddenException('Permissions insuffisantes pour cette ressource.');
    }

    const hasRole = () =>
      user.roles.some((role: string) => requiredRoles.includes(role.toUpperCase()));

    if (!hasRole()) {
      throw new ForbiddenException(
        `Accès refusé. Rôles requis: [${requiredRoles.join(', ')}]. Vos rôles: [${user.roles.join(', ')}]`,
      );
    }

    return true;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async directLogin(username: string, password: string) {
    const keycloakUrl =
      this.configService.get<string>('KEYCLOAK_INTERNAL_URL') ||
      this.configService.get<string>('KEYCLOAK_AUTH_SERVER_URL') ||
      'http://localhost:8080';
    const realm = this.configService.get<string>('KEYCLOAK_REALM') || 'oumou-salamat';
    const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'oumou-salamat-app';

    try {
      const response = await fetch(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: clientId,
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new UnauthorizedException(errorData.error_description || 'Identifiants Keycloak invalides');
      }

      const tokenData = await response.json();

      // Find or sync local user in db
      const localUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ username }, { email: `${username}@oumou-salamat.sn` }],
        },
      });

      return {
        ...tokenData,
        user: localUser || { username },
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(`Échec de connexion Keycloak: ${err.message}`);
    }
  }

  async getProfile(user: any) {
    const localUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: user.username },
          { email: user.email },
        ],
      },
    });

    const rolePriority = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT'];
    const appRole = rolePriority.find((role) => (user.roles || []).includes(role));
    let syncedUser = localUser;
    if (user.userId && user.email && user.username && appRole) {
      const role = appRole as any;
      const localData = {
        keycloakId: user.userId,
        email: user.email.toLowerCase(),
        username: user.username,
        firstName: user.firstName || user.username,
        lastName: user.lastName || '',
        role,
      };
      const existing = await this.prisma.user.findFirst({
        where: { OR: [{ keycloakId: user.userId }, { email: localData.email }, { username: user.username }] },
      });
      syncedUser = existing
        ? await this.prisma.user.update({ where: { id: existing.id }, data: localData })
        : await this.prisma.user.create({ data: localData });
    }

    return {
      ...user,
      localProfile: syncedUser,
    };
  }
}

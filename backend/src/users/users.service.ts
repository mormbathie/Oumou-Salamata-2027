import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Role as LocalRole } from '@prisma/client';

const APP_ROLES = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT'];

@Injectable()
export class UsersService {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  private get keycloakUrl() {
    return (
      this.config.get<string>('KEYCLOAK_INTERNAL_URL') ||
      this.config.get<string>('KEYCLOAK_AUTH_SERVER_URL') ||
      'http://localhost:8080'
    ).replace(/\/$/, '');
  }

  private get realm() {
    return this.config.get<string>('KEYCLOAK_REALM') || 'oumou-salamat';
  }

  private async adminToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.cachedToken;
    }

    const username = this.config.get<string>('KEYCLOAK_ADMIN_USERNAME');
    const password = this.config.get<string>('KEYCLOAK_ADMIN_PASSWORD');
    if (!username || !password) {
      throw new ServiceUnavailableException(
        'La gestion Keycloak n’est pas configurée. Vérifiez KEYCLOAK_ADMIN_USERNAME et KEYCLOAK_ADMIN_PASSWORD.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username,
            password,
          }),
        },
      );
    } catch {
      throw new ServiceUnavailableException('Keycloak est indisponible.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'La connexion administrateur à Keycloak a échoué. Vérifiez les identifiants de configuration.',
      );
    }

    const data = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + Number(data.expires_in || 60) * 1000;
    return this.cachedToken!;
  }

  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(`${this.keycloakUrl}/admin/realms/${this.realm}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${await this.adminToken()}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Keycloak est indisponible.');
    }

    if (!response.ok) {
      const raw = await response.text();
      let message = 'Keycloak a refusé la demande.';
      try {
        const body = JSON.parse(raw);
        message = body.errorMessage || body.error || message;
      } catch {
        // Do not return raw server or proxy responses to the browser.
      }
      if (response.status === 404) throw new NotFoundException(message);
      if (response.status === 409) throw new ConflictException(message);
      if (response.status === 400) throw new BadRequestException(message);
      throw new BadGatewayException(message);
    }

    if (response.status === 204) return null;
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }

  async findAll() {
    const users = await this.request('/users?max=500');
    const managedUsers = await Promise.all(
      users.map(async (user: any) => {
        const mappings = await this.request(`/users/${encodeURIComponent(user.id)}/role-mappings/realm`);
        return this.publicUser(user, mappings);
      }),
    );
    await Promise.all(managedUsers.map((user) => this.syncLocalUser(user)));
    return managedUsers;
  }

  async create(input: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
  }) {
    const username = input.username?.trim();
    const email = input.email?.trim();
    const roleName = input.role?.toUpperCase();
    if (!username || !email || !input.firstName?.trim() || !input.lastName?.trim()) {
      throw new BadRequestException('Le nom d’utilisateur, l’adresse e-mail, le prénom et le nom sont obligatoires.');
    }
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }
    if (!APP_ROLES.includes(roleName)) {
      throw new BadRequestException('Le rôle sélectionné est invalide.');
    }

    const created = await this.request('/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        enabled: true,
        emailVerified: true,
        requiredActions: [],
      }),
    });
    const user = created || (await this.request(`/users?username=${encodeURIComponent(username)}&exact=true`))?.[0];
    if (!user?.id) {
      throw new BadGatewayException('Le compte a été créé, mais Keycloak n’a pas renvoyé son identifiant.');
    }

    try {
      await this.request(`/users/${encodeURIComponent(user.id)}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ type: 'password', value: input.password, temporary: false }),
      });
      const role = await this.request(`/roles/${encodeURIComponent(roleName)}`);
      await this.request(`/users/${encodeURIComponent(user.id)}/role-mappings/realm`, {
        method: 'POST',
        body: JSON.stringify([role]),
      });
      const safeUser = this.publicUser(user, [role]);
      await this.syncLocalUser(safeUser);
      return safeUser;
    } catch (error) {
      try {
        await this.request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      } catch {
        // Preserve the provisioning error; Keycloak may already have removed the partial account.
      }
      throw error;
    }
  }

  async setEnabled(id: string, enabled: boolean, actorId: string) {
    if (id === actorId && !enabled) {
      throw new ConflictException('Vous ne pouvez pas désactiver votre propre compte.');
    }
    const user = await this.request(`/users/${encodeURIComponent(id)}`);
    await this.request(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ id, enabled }),
    });
    return { id, enabled, username: user.username };
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new ConflictException('Vous ne pouvez pas supprimer votre propre compte.');
    }
    await this.request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const localUser = await this.prisma.user.findUnique({ where: { keycloakId: id }, select: { id: true } });
    if (localUser) {
      await this.prisma.$transaction([
        this.prisma.classroom.updateMany({ where: { teacherId: localUser.id }, data: { teacherId: null } }),
        this.prisma.user.delete({ where: { id: localUser.id } }),
      ]);
    }
    return { id, deleted: true };
  }

  async syncLocalUser(user: { id: string; username: string; email: string; firstName: string; lastName: string; roles: string[] }) {
    if (!user.id || !user.email || !user.username) return;
    const roleName = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT']
      .find((candidate) => user.roles.includes(candidate)) || 'ENSEIGNANT';
    const data = {
      keycloakId: user.id,
      username: user.username,
      email: user.email.toLowerCase(),
      firstName: user.firstName || user.username,
      lastName: user.lastName || '',
      role: roleName as LocalRole,
    };
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ keycloakId: user.id }, { email: data.email }, { username: data.username }] },
    });
    if (existing) {
      return this.prisma.user.update({ where: { id: existing.id }, data });
    }
    return this.prisma.user.create({ data });
  }

  private publicUser(user: any, roleMappings: any[] = []) {
    const roles = roleMappings
      .map((role) => role.name)
      .filter((role: string) => APP_ROLES.includes(role));
    return {
      id: user.id,
      username: user.username,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      enabled: Boolean(user.enabled),
      roles,
    };
  }
}

import { BadRequestException } from '@nestjs/common';

export function normalizeEmail(value: unknown, required = false): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email && !required) return null;
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new BadRequestException('Adresse e-mail invalide.');
  }
  return email;
}

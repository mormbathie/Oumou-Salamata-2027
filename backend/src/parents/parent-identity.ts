import { Prisma } from '@prisma/client';
import { normalizeEmail } from '../common/email';

const nameKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
const phoneKey = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00221')) digits = digits.slice(5);
  else if (digits.length === 12 && digits.startsWith('221')) digits = digits.slice(3);
  return digits;
};

// The lock is shared by every creation path, including simultaneous enrollments.
// Names AND phone must match: a shared family phone alone is not an identity.
export async function findOrCreateParent(tx: Prisma.TransactionClient, data: Prisma.ParentCreateInput) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261008)`;
  const parents = await tx.parent.findMany({ orderBy: { createdAt: 'asc' } });
  const existing = parents.find(parent =>
    nameKey(parent.firstName) === nameKey(data.firstName) &&
    nameKey(parent.lastName) === nameKey(data.lastName) &&
    phoneKey(parent.phone) === phoneKey(data.phone));
  if (existing) return existing;
  return tx.parent.create({ data: { ...data, email: normalizeEmail(data.email) } });
}

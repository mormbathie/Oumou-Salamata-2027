-- Additive, idempotent patch for installations currently managed with prisma db push.
-- No UPDATE, DELETE, DROP, enum change, or historical fee recalculation.
BEGIN;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "supplies" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "registrationOptions" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "billingKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_billingKey_key" ON "Invoice"("billingKey");
COMMIT;

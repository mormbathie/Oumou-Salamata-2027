-- Additive only: never recalculate historical registration invoices or payments.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "supplyLines" TEXT;
CREATE TABLE IF NOT EXISTS "SupplyArticle" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyArticle_pkey" PRIMARY KEY ("id")
);

-- 002_add_currency_to_user.sql
ALTER TABLE "users"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ARS';

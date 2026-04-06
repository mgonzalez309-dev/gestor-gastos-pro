-- AlterTable: add savings_goal column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savings_goal" DOUBLE PRECISION;

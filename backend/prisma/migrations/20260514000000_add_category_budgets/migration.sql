-- AlterTable: add category_budgets JSON column to users
ALTER TABLE "users" ADD COLUMN "category_budgets" JSONB;

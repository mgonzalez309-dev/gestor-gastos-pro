-- Add tags array column to expenses
ALTER TABLE "expenses" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

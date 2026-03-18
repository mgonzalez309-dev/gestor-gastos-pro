-- database/schema.sql
-- Complete PostgreSQL schema for Gestor de Gastos.
-- Run with: psql -U <user> -d <db_name> -f database/schema.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADVISOR');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Category') THEN
    CREATE TYPE "Category" AS ENUM (
      'FOOD',
      'TRANSPORT',
      'ENTERTAINMENT',
      'HEALTH',
      'EDUCATION',
      'CLOTHING',
      'TECHNOLOGY',
      'HOME',
      'SERVICES',
      'OTHER'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "age" INTEGER,
  "monthly_income" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "extracted_text" TEXT,
  "parsed_amount" DOUBLE PRECISION,
  "parsed_tax" DOUBLE PRECISION,
  "parsed_merchant" TEXT,
  "parsed_items" JSONB,
  "parsed_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "merchant" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "category" "Category" NOT NULL DEFAULT 'OTHER',
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "ticket_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "advisor_id" TEXT,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE INDEX IF NOT EXISTS "idx_expenses_user_id" ON "expenses"("user_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_date" ON "expenses"("date");
CREATE INDEX IF NOT EXISTS "idx_expenses_category" ON "expenses"("category");
CREATE INDEX IF NOT EXISTS "idx_tickets_user_id" ON "tickets"("user_id");
CREATE INDEX IF NOT EXISTS "idx_recommendations_user_id" ON "recommendations"("user_id");
CREATE INDEX IF NOT EXISTS "idx_recommendations_advisor_id" ON "recommendations"("advisor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_user_id_fkey'
  ) THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_user_id_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_ticket_id_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recommendations_user_id_fkey'
  ) THEN
    ALTER TABLE "recommendations"
      ADD CONSTRAINT "recommendations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recommendations_advisor_id_fkey'
  ) THEN
    ALTER TABLE "recommendations"
      ADD CONSTRAINT "recommendations_advisor_id_fkey"
      FOREIGN KEY ("advisor_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

COMMIT;

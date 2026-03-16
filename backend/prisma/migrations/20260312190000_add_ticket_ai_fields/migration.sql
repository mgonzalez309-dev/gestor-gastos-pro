-- AlterTable
ALTER TABLE "tickets"
ADD COLUMN "parsed_tax" DOUBLE PRECISION,
ADD COLUMN "parsed_items" JSONB;

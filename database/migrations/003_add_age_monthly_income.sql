-- 003_add_age_monthly_income.sql
ALTER TABLE "users"
ADD COLUMN "age" INTEGER,
ADD COLUMN "monthly_income" DOUBLE PRECISION;

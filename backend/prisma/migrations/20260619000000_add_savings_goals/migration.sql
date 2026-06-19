-- Create savings_goals table
CREATE TABLE "savings_goals" (
    "id"             TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "target_amount"  DOUBLE PRECISION NOT NULL,
    "current_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_date"    TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "savings_goals"
    ADD CONSTRAINT "savings_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "savings_goals_user_id_idx" ON "savings_goals"("user_id");
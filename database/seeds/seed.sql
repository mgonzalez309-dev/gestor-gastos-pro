-- database/seeds/seed.sql
-- Sample data for local testing.

BEGIN;

INSERT INTO "users" (
  "id", "name", "email", "password", "role", "currency", "age", "monthly_income", "created_at", "updated_at"
) VALUES
  (
    'seed_user_01',
    'Usuario Demo',
    'demo.user@gastos.local',
    '$2a$12$JQdi6Qj17X4V8oWBa6vU4uNQmNQ9.5qkJ2Y5gYOA3wW4v2DQQxTRS',
    'USER',
    'ARS',
    29,
    180000,
    NOW(),
    NOW()
  ),
  (
    'seed_advisor_01',
    'Asesor Demo',
    'demo.advisor@gastos.local',
    '$2a$12$JQdi6Qj17X4V8oWBa6vU4uNQmNQ9.5qkJ2Y5gYOA3wW4v2DQQxTRS',
    'ADVISOR',
    'ARS',
    35,
    260000,
    NOW(),
    NOW()
  )
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "tickets" (
  "id", "user_id", "image_url", "extracted_text", "parsed_amount", "parsed_tax", "parsed_merchant", "parsed_items", "parsed_date", "created_at"
) VALUES
  (
    'seed_ticket_01',
    'seed_user_01',
    'uploads/seed-ticket-01.jpg',
    'SUPERMERCADO DEMO\nTOTAL 12650',
    12650,
    1520,
    'Supermercado Demo',
    '[{"item":"Leche","price":1800},{"item":"Pan","price":700}]'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "expenses" (
  "id", "user_id", "merchant", "amount", "category", "date", "description", "ticket_id", "created_at", "updated_at"
) VALUES
  (
    'seed_expense_01',
    'seed_user_01',
    'Supermercado Demo',
    12650,
    'FOOD',
    NOW() - INTERVAL '2 days',
    'Compra semanal',
    'seed_ticket_01',
    NOW(),
    NOW()
  ),
  (
    'seed_expense_02',
    'seed_user_01',
    'Transporte Urbano',
    3200,
    'TRANSPORT',
    NOW() - INTERVAL '1 day',
    'Carga SUBE',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'seed_expense_03',
    'seed_user_01',
    'Streaming Plus',
    5500,
    'ENTERTAINMENT',
    NOW(),
    'Suscripcion mensual',
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "recommendations" (
  "id", "user_id", "advisor_id", "message", "type", "created_at"
) VALUES
  (
    'seed_reco_01',
    'seed_user_01',
    'seed_advisor_01',
    'Reduce un 10% tus gastos en entretenimiento este mes.',
    'SAVING',
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

COMMIT;

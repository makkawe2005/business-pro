-- 028_add_calendar_availability_up.sql
-- Company-wide working hours + holiday closures, backing the shared available-slots
-- computation. user_id is nullable on both tables and always NULL for now (company-wide) —
-- the column exists so a future move to per-consultant calendars is a query/UI change,
-- not a schema migration.

BEGIN;

CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique indexes, not a plain UNIQUE(user_id, day_of_week) — Postgres treats NULLs
-- as distinct in a regular unique constraint, which would let duplicate company-wide rows
-- (user_id IS NULL) slip in silently.
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_hours_company_day ON business_hours(day_of_week) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_hours_user_day ON business_hours(user_id, day_of_week) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS calendar_closures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL,
  label VARCHAR(200),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_closures_date ON calendar_closures(closure_date);

-- Seed the default company week: Sunday-Thursday 9:00-17:00, Friday/Saturday closed.
INSERT INTO business_hours (user_id, day_of_week, is_open, start_time, end_time) VALUES
  (NULL, 0, true, '09:00', '17:00'),
  (NULL, 1, true, '09:00', '17:00'),
  (NULL, 2, true, '09:00', '17:00'),
  (NULL, 3, true, '09:00', '17:00'),
  (NULL, 4, true, '09:00', '17:00'),
  (NULL, 5, false, NULL, NULL),
  (NULL, 6, false, NULL, NULL)
ON CONFLICT DO NOTHING;

COMMIT;

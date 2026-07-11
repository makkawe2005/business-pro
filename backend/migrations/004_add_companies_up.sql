-- 004_add_companies_up.sql
-- Adds a companies table: one client owns many companies (1-to-many via client_id FK)

BEGIN;

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(150),
  city VARCHAR(150),
  country VARCHAR(150),
  commercial_registration_number VARCHAR(100),
  vat_number VARCHAR(100),
  national_address VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_client ON companies(client_id);

COMMIT;

-- 014_add_client_services_up.sql
-- Adds a "Services" checkbox group to clients: Consultation, Investment, Business Solutions.

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_consultation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_investment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_business_solutions BOOLEAN NOT NULL DEFAULT false;

COMMIT;

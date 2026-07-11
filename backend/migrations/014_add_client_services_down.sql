-- 014_add_client_services_down.sql
-- Reverts 014_add_client_services_up.sql

BEGIN;

ALTER TABLE clients
  DROP COLUMN IF EXISTS service_consultation,
  DROP COLUMN IF EXISTS service_investment,
  DROP COLUMN IF EXISTS service_business_solutions;

COMMIT;

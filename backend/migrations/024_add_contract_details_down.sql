BEGIN;

ALTER TABLE clients
  DROP COLUMN IF EXISTS contract_price,
  DROP COLUMN IF EXISTS payment_type;

COMMIT;

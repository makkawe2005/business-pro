BEGIN;

ALTER TABLE companies DROP COLUMN IF EXISTS national_address;

COMMIT;

-- 003_add_client_stage_down.sql
-- Revert 003_add_client_stage_up.sql

BEGIN;

ALTER TABLE clients DROP COLUMN IF EXISTS stage;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_stage') THEN
    DROP TYPE client_stage;
  END IF;
END$$;

COMMIT;

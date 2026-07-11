-- 003_add_client_stage_up.sql
-- Adds a stage column to clients so a client can move from Phase 1 to Phase 2.

BEGIN;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_stage') THEN
        CREATE TYPE client_stage AS ENUM ('phase1','phase2');
    END IF;
END$$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage client_stage NOT NULL DEFAULT 'phase1';

COMMIT;

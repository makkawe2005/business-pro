-- 001_create_schema_down.sql
-- Revert the schema created in 001_create_schema_up.sql

BEGIN;

-- Recreate engagements_count on clients (nullable) to preserve compatibility on rollback
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    -- keep enum if other objects still reference it
    NULL;
  END IF;
END$$;

-- Drop tables if they exist
DROP TABLE IF EXISTS engagement_events CASCADE;
DROP TABLE IF EXISTS engagements CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop types
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_status') THEN
    DROP TYPE engagement_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    DROP TYPE client_status;
  END IF;
END$$;

COMMIT;

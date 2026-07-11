-- 001_create_schema_up.sql
-- Creates core tables: users, clients, notes, engagements, engagement_events
-- Target: PostgreSQL

BEGIN;

-- Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
        CREATE TYPE client_status AS ENUM ('Prospect','Active','Inactive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_status') THEN
        CREATE TYPE engagement_status AS ENUM ('open','in_progress','closed','on_hold');
    END IF;
END$$;

-- Users (minimal local user management)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  email VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients (no engagements_count column)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(50),
  industry VARCHAR(100),
  status client_status NOT NULL DEFAULT 'Prospect',
  briefing TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes / call log
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  author_name VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Engagements (pipeline items)
CREATE TABLE IF NOT EXISTS engagements (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status engagement_status NOT NULL DEFAULT 'open',
  current_assigned_user INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Engagement events (handoff/audit trail)
CREATE TABLE IF NOT EXISTS engagement_events (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  from_user_id INTEGER REFERENCES users(id),
  to_user_id INTEGER REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_engagements_client ON engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_engagements_assigned ON engagements(current_assigned_user);
CREATE INDEX IF NOT EXISTS idx_events_engagement ON engagement_events(engagement_id);

-- If an older clients table previously had an engagements_count column, drop it.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='engagements_count'
  ) THEN
    ALTER TABLE clients DROP COLUMN engagements_count;
  END IF;
END$$;

COMMIT;

-- 021_add_client_documents_up.sql
-- Adds client_documents: files attached to a client (uploaded by Client Relation, downloadable
-- by any role that can currently view that client). Stored as BYTEA directly in Postgres —
-- Render's web service disk is ephemeral, so files can't be saved to local disk.

BEGIN;

CREATE TABLE IF NOT EXISTS client_documents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);

COMMIT;

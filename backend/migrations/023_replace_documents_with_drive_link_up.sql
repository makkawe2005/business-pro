-- 023_replace_documents_with_drive_link_up.sql
-- Replaces the client_documents upload/download feature with a single Google Drive link per client.
-- This permanently discards any previously-uploaded document files (accepted data loss, confirmed).

BEGIN;

DROP TABLE IF EXISTS client_documents;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_link VARCHAR(500);

COMMIT;

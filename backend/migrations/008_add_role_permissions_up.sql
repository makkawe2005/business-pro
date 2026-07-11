-- 008_add_role_permissions_up.sql
-- Adds a configurable role -> page permissions matrix.

BEGIN;

CREATE TABLE IF NOT EXISTS role_permissions (
    role user_role NOT NULL,
    page_key TEXT NOT NULL,
    PRIMARY KEY (role, page_key)
);

INSERT INTO role_permissions (role, page_key) VALUES
    ('admin', 'phase1'),
    ('admin', 'phase2'),
    ('admin', 'phase3'),
    ('admin', 'system_admin'),
    ('user', 'phase1'),
    ('user', 'phase2'),
    ('user', 'phase3')
ON CONFLICT (role, page_key) DO NOTHING;

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS investors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(320),
  investor_type VARCHAR(50) NOT NULL DEFAULT 'Individual',
  company_name VARCHAR(255),
  nationality VARCHAR(100),
  national_id VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Prospect',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant the new 'investors' page_key to every existing role by default, same convention
-- used for 'calendar' (migration 019) — adjustable afterward via the Permissions page.
INSERT INTO role_permissions (role_id, page_key)
SELECT id, 'investors' FROM roles
ON CONFLICT (role_id, page_key) DO NOTHING;

COMMIT;

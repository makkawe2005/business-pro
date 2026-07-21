-- 027_add_task_management_up.sql
-- Adds Phase 4 (Execution) and its tasks. One task is auto-created per checked service
-- when a client enters phase4: consultation/investment are direct, single-assignee tasks;
-- business_solutions is a parent container (assigned_to stays NULL) whose sub-tasks are
-- added dynamically by the Project Manager via POST /clients/:id/tasks — there is no fixed
-- catalog of sub-tasks, unlike the per-service team mapping this replaces.

BEGIN;

ALTER TYPE client_stage ADD VALUE IF NOT EXISTS 'phase4';
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'Executing';
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'Completed';

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service VARCHAR(30) NOT NULL CHECK (service IN ('consultation','investment','business_solutions')),
  parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned','in_progress','submitted','sent_back','closed')),
  deliverable_note TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_events (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('nominated','submitted','sent_back','closed')),
  actor_user_id INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);

INSERT INTO role_permissions (role_id, page_key)
SELECT id, 'phase4' FROM roles WHERE name IN ('admin', 'Project Manager')
ON CONFLICT (role_id, page_key) DO NOTHING;

COMMIT;

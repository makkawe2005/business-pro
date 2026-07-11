# Migration Plan — Client Dashboard (Option A)

Goal: create `users`, `clients`, `notes`, `engagements`, and `engagement_events` tables in PostgreSQL, remove `clients.engagements_count`, and provide seed data for local development.

Files added:
- `backend/migrations/001_create_schema_up.sql` — `up` migration
- `backend/migrations/001_create_schema_down.sql` — `down` migration
- `backend/migrations/001_seed.sql` — dev seed rows

Preconditions and safety
- Backup the database before running migrations: `pg_dump` or DB snapshot.
- Run migrations in a maintenance window if applying to production.

Run migrations (example using `psql`):

```bash
# apply up
psql -d yourdb -f backend/migrations/001_create_schema_up.sql

# load seed (optional for dev)
psql -d yourdb -f backend/migrations/001_seed.sql

# rollback (if necessary)
psql -d yourdb -f backend/migrations/001_create_schema_down.sql
```

Transactional handoff pattern

Wrap these two operations in a single DB transaction when assigning / reassigning:

1) INSERT INTO engagement_events (engagement_id, from_user_id, to_user_id, event_type, note) VALUES (...);
2) UPDATE engagements SET current_assigned_user = <to_user_id>, status = 'in_progress', updated_at = now() WHERE id = <engagement_id>;

Example (psql):

```sql
BEGIN;
INSERT INTO engagement_events (engagement_id, from_user_id, to_user_id, event_type, note)
VALUES (42, 11, 12, 'reassigned', 'Pass to next owner');
UPDATE engagements SET current_assigned_user = 12, status = 'in_progress', updated_at = now() WHERE id = 42;
COMMIT;
```

Notes
- The `up` migration attempts to drop `clients.engagements_count` if present; however, test backups are recommended before removal.
- The schema uses ENUMs for `client_status` and `engagement_status` for clarity.

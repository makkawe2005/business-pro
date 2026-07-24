# API Specification — Client Dashboard

All endpoints return JSON. This document lists endpoints to be implemented on the server (no code changes applied yet).

Clients
- `clients.status` (added in migration 001, extended in migrations 012 and 016) is a `client_status` enum: `Prospect`, `Reschedule`, `Active`, `Finalizing`, or `Inactive`. `Reschedule` (added in migration 012) is set when Phase 2 sends a client back to Sales for follow-up — the Sales/Phase 1 view shows both `Prospect` and `Reschedule` clients together (colored differently in the UI), distinct from a fresh Prospect lead. `Finalizing` (added in migration 016) is set when Sales graduates a client into Finance & Legal.

- GET /clients/summary
  - Returns aggregate counts only: { total, prospect, reschedule, active, inactive }, computed in SQL. `active` is `Active` + `Finalizing` combined (a Finance & Legal client is still an active deal, just in its final stage). `total` is every non-`Inactive` status (`Prospect` + `Reschedule` + `Active` + `Finalizing`) — it deliberately excludes `inactive` clients, since they're no longer a "live" client. Not phase-gated (counts carry no client-level data) — used by the Phase 1/2/3 summary cards instead of fetching every client row.

- GET /clients
  - Query params: `stage` (optional, `phase1`/`phase2`/`phase3`) and `status` (optional, one or more of `Prospect`/`Reschedule`/`Active`/`Finalizing`/`Inactive` as a comma-separated list, e.g. `status=Prospect,Reschedule`) — both filters apply together (AND) when both are present. Omit either to skip that filter.
  - Returns: list of clients. Each client object should include an aggregated `engagements_count` (server computes via COUNT) and `company_name` (the client's first/oldest linked company, `null` if none — a client can technically have several `companies` rows, but the UI only ever creates one). Also includes, added alongside migration 027: `has_overdue_task` (`true` if any of the client's leaf tasks — direct or business_solutions sub-task, not the parent container — has a `due_date` before today and isn't `closed`), `has_due_soon_task` (same leaf-task scope, `true` if a non-closed task's `due_date` falls within the next 2 days inclusive of today), `total_task_count` and `open_task_count` (leaf-task counts, all and non-`closed` respectively — power the ✓/count badge on the client list). All four are `0`/`false` for clients outside `phase4`, since tasks only exist there today; computed generically so they stay correct if that changes.
  - If `stage` is present, requires the caller's role to have that page_key in the permissions matrix (see "Roles & Permissions" below) or returns 403 `{ error: "Not permitted for this phase" }`. If `stage` is absent (an unfiltered or status-only cross-phase query, e.g. the Admin page's `status=Inactive` lookup), requires `system_admin` instead, since it would otherwise return clients from every phase with no permission check at all.

- GET /dashboard
  - Requires `dashboard` page access (added in migration 017, seeded to `admin`; grant it to other roles via the Permissions page). Returns `{ columns: [{ key, clients: [{ id, contact_name, phone, status, stage, updated_at, company_name }] }], statusCounts: { Prospect, Reschedule, Active, Finalizing, Inactive }, industryCounts: [{ industry, count }], serviceCounts: { consultation, investment, businessSolutions } }`. `columns` has six fixed entries: `prospect` (`phase1`/`Prospect`), `reschedule` (`phase1`/`Reschedule`), `sales` (`phase2`/`Active`), `legalFinance` (`phase3`/`Finalizing`) — each an exact stage+status match — `execution` (`phase4`, any status — matches both `Executing` and `Completed`, added alongside this table entry in migration 027), and `inactive` (`status='Inactive'` across **any** stage, since a client can go inactive from phase1, phase2, or phase3), all sorted by `contact_name`. `company_name` is the client's first/oldest linked company (`null` if none, same as `GET /clients`). `phone`, `stage`, and `company_name` are included so the dashboard's client-side search/table can show/filter by them and link into the right phase (`stage` matters most for the `inactive` column, since it spans all three stages). `statusCounts` is a raw per-status count across **all** clients regardless of stage — powers the dashboard's status bar chart. `industryCounts` counts distinct clients grouped by their first company's `industry` (clients with no company, or whose company has no industry set, are excluded), sorted by count descending — powers the dashboard's industry donut chart. `serviceCounts` is a count of clients with each `service_*` boolean (added in migration 014) set `true`, across **all** clients — powers the dashboard's services bar chart. `taskCounts: { open, closed }` is a system-wide leaf-task count (same definition as `GET /execution/summary`) — powers the dashboard's open-vs-closed donut chart; unlike the rest of this endpoint it reflects `phase4` data, but stays gated on `dashboard` rather than `phase4` since it's a read-only headline number, not an actionable task view. This is a read-only pipeline-wide overview independent of per-phase permissions — a role can see the dashboard without also having `phase1`/`phase2`/`phase3` access. Deeper task/execution insights (per-assignee workload, the task table) live on their own dashboard — see `GET /execution/summary` and `GET /execution/tasks` below.

- GET /clients/:id
  - Returns: client fields + notes (latest first) + engagements (with current_assigned_user and status) + companies (latest first).
  - Requires the caller's role to have the client's current `stage` as a permitted page_key, or returns 403.

- POST /clients
  - Body: { contact_name, email, phone, status, stage? }
  - `stage` defaults to `phase1` when omitted. `contact_name` is required. Creates a client and returns the created resource.
  - `name`, `industry`, and `briefing` no longer live on `clients` (moved to `companies` in migration 005) — the client's display identity is `contact_name`.
  - Requires the caller's role to have the target `stage` (post-default) as a permitted page_key, or returns 403.

- PUT /clients/:id
  - Body: fields to update (same as POST, including `stage`, plus `service_consultation`/`service_investment`/`service_business_solutions` — booleans, added in migration 014, default `false`, toggled independently from the Services checkboxes in the client detail panel; and `contract_price`/`payment_type` — free-text strings, added in migration 024, edited via the Contract Details section shown on Sales (phase2) and Legal & Finance (phase3) only). Returns updated resource. Used to graduate a client from Phase 1 to Phase 2 via `{ "stage": "phase2", "status": "Active" }`, from Phase 2 to Phase 3 via `{ "stage": "phase3", "status": "Finalizing" }` (added in migration 016), or to send a Phase 2 **or** Phase 3 client back to Client Relation via `{ "stage": "phase1", "status": "Reschedule" }` — both Sales and Finance & Legal reschedule directly to Client Relation, not to the immediately preceding phase, so `Reschedule` status always means "sitting in Client Relation, kicked back from downstream."
  - Permission check is based on the client's **current** stage (pre-update), not the target stage — a phase1-only role can still graduate a client into phase2 via this call (a normal handoff), it just can't independently browse/edit phase2 clients afterward. Returns 403 if the caller's role lacks the client's current stage.

- DELETE /clients/:id
  - Deletes the client (cascades to its notes, engagements, and engagement_events). Returns 204 on success, 404 if not found. Requires `system_admin` in addition to the same current-stage permission check as PUT — the frontend never calls this (see below), so it's fenced off from ordinary phase roles rather than left reachable by anyone with phase access to an unused, irreversible capability.

- `clients.stage` (added in migration 003, extended in migration 016) is a `client_stage` enum: `phase1` (default), `phase2`, or `phase3`. The frontend graduates a client to `phase2` (and sets `status` to `Active`) when an engagement is created for them in Phase 1, and from `phase2` to `phase3` (and sets `status` to `Finalizing`) the same way from Sales. Finance & Legal (`phase3`) mirrors Sales' read-only client view (Services/Company locked, Notes only, no Appointments) and its pipeline actions ("Next Phase", "Deal Cancele" with a mandatory reason, and "Reschedule" with a mandatory reason) — the only difference is Phase 3 has no further stage to graduate into. Both Sales and Finance & Legal reschedule directly back to `phase1` (Client Relation), never to each other, so Sales' list only ever shows `Active` clients (no `Reschedule` filter there) — only Phase 1 lists both `Prospect` and `Reschedule` together.
- The frontend never issues `DELETE /clients/:id` from its UI anymore — "removing" a client from either phase is done via `PUT /clients/:id` with `{ "status": "Inactive" }`, which keeps the record. `DELETE` remains available as an API capability but is unused by the current UI.

Notes
- POST /clients/:id/notes
  - Body: { author_id?, author_name, text }
  - Creates a note linked to the client. Same current-stage permission check as `PUT /clients/:id`.

Companies
- POST /clients/:id/companies
  - Body: { name, region?, city?, country?, commercial_registration_number?, vat_number?, industry?, briefing?, contact_person_name?, additional_phone_number? }
  - Creates a company record owned by the client (`companies.client_id` FK, `ON DELETE CASCADE`, added in migration 004). `name` is required, all other fields optional — except `briefing`, which is required when the owning client is currently in `phase1` (Client Relation). `industry`, `briefing`, `contact_person_name`, and `additional_phone_number` were added in migration 005. `national_address` was removed in migration 022. Same current-stage permission check as `PUT /clients/:id`.

- PUT /companies/:id
  - Body: any subset of the POST fields to update. Returns the updated resource, 404 if not found. Permission check resolves the owning client via `companies.client_id` and applies the same current-stage rule.

- DELETE /companies/:id
  - Deletes a single company record. Returns 204 on success, 404 if not found. Same permission check as PUT.

- The UI restricts each client to at most one company (the "Add company" form hides once a client has one, editing happens via PUT instead) — the API itself still allows multiple companies per client.

Appointments
- GET /clients/:id
  - The client detail bundle now also includes `appointments` (chronological, soonest first) — added in migration 006, scoped to a single client.

- GET /appointments
  - Requires `calendar` page access (added in migration 019, granted to every existing role by default — independent of `phase1`, same pattern as `dashboard`, even though appointments only exist in Client Relation today). Cross-client listing — powers the Calendar page. Query params: `from`/`to` (optional, `YYYY-MM-DD`, inclusive on both ends, filters on `scheduled_at`'s date) and `status` (optional, comma-separated `appointment_status` values, e.g. `status=Scheduled`). Returns every matching appointment across all clients, each with `client_id`, `contact_name`, and `stage` attached, sorted by `scheduled_at` ascending.

- POST /clients/:id/appointments
  - Body: { scheduled_at, title, agenda?, meeting_type?, location?, meeting_link? }
  - `scheduled_at` and `title` are required. `scheduled_at` is checked against the company calendar (`checkBusinessHours` — same `business_hours`/`calendar_closures` tables as `GET /calendar/available-slots`, migration 028) and rejected with 400 if it's in the past, falls outside working hours, or lands on a closure date; this is a hard block, not a warning. Creates an appointment linked to the client with `status` defaulting to `Scheduled` and `meeting_type` defaulting to `Remote` (added in migration 015; one of `Remote`/`In-Person`, enforced via a `CHECK` constraint, not an enum). `location` and `meeting_link` (added in migration 020, both nullable) are freeform text — the frontend shows/collects `location` for `In-Person` appointments and `meeting_link` for `Remote` ones, but the API itself doesn't enforce that pairing. Same current-stage permission check as `PUT /clients/:id`.

- PUT /appointments/:id
  - Body: any subset of { scheduled_at, title, agenda, status, meeting_type, location, meeting_link } to update. `status` is one of `Scheduled`/`Completed`/`Cancelled` (the `appointment_status` enum); `meeting_type` is one of `Remote`/`In-Person`. If `scheduled_at` is included, it goes through the same `checkBusinessHours` hard block as `POST` above — status-only updates (mark completed/cancel) are unaffected since they don't touch `scheduled_at`. Returns the updated resource, 404 if not found. Permission check resolves the owning client via `appointments.client_id`.

- DELETE /appointments/:id
  - Deletes a single appointment. Returns 204 on success, 404 if not found. Same permission check as PUT.

- Phase 2 replaced its Call log (notes) section with Appointments; Phase 1 has no notes section (removed — see below), other phases still use notes.
- Notes are hidden from the Client Relation (phase1) UI specifically (frontend-only condition in `PhaseView.jsx`); the `POST /clients/:id/notes` endpoint itself has no stage restriction.

Calendar availability (migration 028) — company-wide business hours + holiday closures backing a
shared available-slots computation. `business_hours.user_id` and `calendar_closures.user_id` are
both nullable and always `NULL` today (company-wide); the columns exist so a future move to
per-consultant calendars is a query/UI change, not a schema migration. Lives under System Admin →
Calendar in the frontend, but reused as-is by any future consumer (e.g. a PM-facing consultant
scheduling tool) since the read endpoint below isn't admin-gated.
- GET /calendar/business-hours
  - Requires `system_admin`. Returns the 7 company-wide rows (`user_id IS NULL`), ordered by `day_of_week` (0=Sunday..6=Saturday).
- PUT /calendar/business-hours
  - Requires `system_admin`. Body: `{ days: [{ day_of_week, is_open, start_time, end_time }, ...] }`. Upserts each day (`user_id` stays `NULL`); `start_time`/`end_time` are ignored (stored `NULL`) when `is_open` is false. Returns the full updated set of 7 rows.
- GET /calendar/closures
  - Requires `system_admin`. Returns every company-wide closure (`user_id IS NULL`), each with `created_by_name` joined in, ordered by `closure_date` ascending. `end_date` (added migration 029, nullable) makes a row span a range of days; a row with `end_date IS NULL` is a single-day closure (`closure_date` only) — every consumer of this table treats `COALESCE(end_date, closure_date)` as the effective last day.
- POST /calendar/closures
  - Requires `system_admin`. Body: `{ date, end_date?, label? }`. `end_date` defaults to `date` (single-day) when omitted; 400 if `end_date < date`. Adds a company-wide closure spanning `[date, end_date]` inclusive, `created_by` set to the caller.
- DELETE /calendar/closures/:id
  - Requires `system_admin`. Removes a closure (the whole range, not a single day within it). 404 if not found (or not company-wide).
- GET /calendar/available-slots?date=YYYY-MM-DD&duration=60
  - No page-key gate — authenticated only. Deliberately not `system_admin`-restricted: it's read-only, reveals nothing sensitive (just open time labels), and its real consumer is meant to be a future PM-facing scheduling tool, not the admin portal. Returns `{ date, slots: [] }` immediately if `date` is before today (server-local). Otherwise looks up `business_hours` for that date's weekday; if closed, or the date falls within any `calendar_closures` range (`closure_date <= date <= COALESCE(end_date, closure_date)`), returns `{ date, slots: [] }`. Otherwise generates `HH:MM` labels from `start_time` to `end_time` in `duration`-minute steps (default 60), excluding any time already taken by an `appointments` row with `status = 'Scheduled'` on that date, and — when `date` is today — excluding any label at or before the current server time.

Google Drive link (migration 023, replaces the earlier file-upload Documents feature from migration 021)
- `clients.drive_link` (`VARCHAR(500)`, nullable) — a single external Google Drive URL per client, replacing the old in-Postgres `BYTEA` document storage. `client_documents` and its upload/download endpoints were dropped; any previously-uploaded files were discarded (accepted data loss).
- GET /clients/:id
  - The returned `client` object includes `drive_link` directly (no separate array/bundle key).

- PUT /clients/:id/drive-link
  - Body: { drive_link } (string URL or null to clear). Requires `phase1` page access (Client Relation) specifically — like the old upload/delete endpoints, this is not gated by the client's current stage via `requireClientPhase`, so Client Relation can still update the link even after the client has graduated to `phase2`/`phase3`. Any other role that can currently view the client (via `requireClientPhase` on `GET /clients/:id`) can see and open the link, but not change it.

Tasks (Phase 4 — Execution, migration 027)
- `clients.stage` gains a fourth value, `phase4`, and `clients.status` gains `Executing`/`Completed`. A client graduates into it the same way as phase1→phase2→phase3, via `PUT /clients/:id` with `{ "stage": "phase4", "status": "Executing" }` from `phase3`. There is only one execution stage — no separate Staffing/Completed sub-stages — task status itself tracks whether work has been assigned and finished.
- `tasks(id, client_id, service, parent_task_id, title, assigned_to, status, deliverable_note, due_date, created_at, updated_at)`. `service` is one of `consultation`/`investment`/`business_solutions`. One task per checked `service_*` flag on the client is auto-created the first time it enters `phase4` (see `PUT /clients/:id`): `consultation`/`investment` are created as direct, single-assignee leaf tasks; `business_solutions` is created as a **parent container** (`parent_task_id IS NULL`, `assigned_to` stays `NULL` — it is never itself worked or closed). `status` is one of `unassigned`/`in_progress`/`submitted`/`sent_back`/`closed`.
- Business Solutions sub-tasks are **dynamic** — there is no fixed catalog. Whoever holds `phase4` access (Project Manager) adds however many sub-tasks a given client's deal actually needs, each with its own title and assignee, via `POST /clients/:id/tasks`. A sub-task is a `tasks` row with `parent_task_id` set to the business_solutions parent's id.
- `GET /clients/:id` — the bundle now also includes `tasks` (parent rows first, then children, each with `assigned_to_name` and its `events` array from `task_events`).

- POST /clients/:id/tasks
  - Body: { title, assigned_to?, due_date? }. Adds a Business Solutions sub-task to the client (404-equivalent 400 if the client has no business_solutions task, i.e. that service wasn't checked). `due_date` is required (400 `{ error: "due_date required when assigning a sub-task" }`) whenever `assigned_to` is set — a sub-task can't be handed to someone with no deadline. Same current-stage (`phase4`) permission check as `PUT /clients/:id`.

- PUT /tasks/:id
  - Body: any subset of { title, assigned_to, due_date }. Reassigning a previously-`unassigned` task moves its status to `in_progress` and logs a `nominated` event. Permission check resolves the owning client via `tasks.client_id` and applies the same current-stage (`phase4`) rule — i.e. only whoever holds `phase4` access can reassign/retitle/schedule a task.

- DELETE /tasks/:id
  - Removes a Business Solutions sub-task. 400 if the task is a parent container (not a sub-task) or if it's already been submitted/sent back/closed — only sub-tasks that haven't been submitted yet can be removed. Same `phase4` permission check.

- PUT /tasks/:id/submit
  - Body: { deliverable_note } (required, free text — no fixed structured fields). **Not** gated by `phase4` page access — instead requires `req.user.sub === tasks.assigned_to`, so an assignee without any phase4 permission can still submit their own task. 403 if the caller isn't the assignee. Sets status to `submitted` and logs a `submitted` event.

- PUT /tasks/:id/review
  - Body: { decision: "approve" | "send_back", comment? }. `comment` is required when `decision` is `send_back`. Sets status to `closed` (approve) or `sent_back`, and logs the corresponding `task_events` row (with `comment` for send-backs, shown back to the assignee). Same `phase4` permission check as `PUT /tasks/:id`.

- GET /my-tasks
  - Requires `my_tasks` page permission. Returns every task (across every client) where `assigned_to` is the caller, each with `contact_name`/`phone`/`email`/`company_name`/`stage` and `events` attached, sent-back tasks sorted first. This is what makes "every assignee sees only their own part" work: assignees browse their work through this endpoint rather than the phase4 client bundle, which they may not have permission to view at all.

- GET /task-assignable-users
  - Requires `phase4` page access. Returns `{ id, name }` for every active user, no team/role restriction — the Project Manager can assign any service or sub-task to anyone.

- GET /execution/summary
  - Requires `phase4` page access (this is the Project Manager's own dashboard, gated separately from the `dashboard` page key rather than folded into `GET /dashboard`). Returns `{ clientCount, taskCounts: { open, closed, overdue }, taskWorkload: [{ user_id, name, open_count, overdue_count, closed_count }] }`. `clientCount` is every client currently in `phase4` (Executing or Completed). `taskCounts`/`taskWorkload` use the same leaf-task definition as the `Completed` gate below (business_solutions parent containers excluded). Per-assignee `open_count` excludes that assignee's overdue tasks (they're broken out into `overdue_count`), so the three counts are mutually exclusive and sum to the assignee's total. Powers both the Execution board's summary strip and the dedicated Execution dashboard (open/closed chart + per-assignee workload).

- GET /execution/tasks
  - Requires `phase4` page access. Returns a flat list of every leaf task (same definition as above) with client and assignee context joined in: `{ id, title, status, due_date, service, parent_task_id, parent_title, assigned_to, assignee_name, client_id, contact_name, company_name }`. `parent_task_id`/`parent_title` are `null` for direct tasks and populated for business_solutions sub-tasks. Sorted open-before-closed, then by `due_date` ascending (nulls last). Powers the task table on the Execution dashboard.

- Marking a client `Completed` (`PUT /clients/:id` with `{ "status": "Completed" }` while its current stage is `phase4`) is rejected with 400 unless every leaf task (direct tasks, and every business_solutions sub-task — not the parent container itself) is `closed`.

Engagements
- POST /clients/:id/engagements
  - Body: { title, description, created_by (user id), current_assigned_user (optional) }
  - Creates an engagement for the client. Same current-stage permission check as `PUT /clients/:id`.

- GET /engagements/:id
  - Returns engagement details and `engagement_events` ordered by `created_at`. Permission check resolves the owning client via `engagements.client_id`.

- POST /engagements/:id/assign
  - Body: { from_user_id?, to_user_id, event_type?, note }
  - Behaviour: within a DB transaction insert an `engagement_events` row, then update `engagements.current_assigned_user` to `to_user_id` and set `status='in_progress'`. Same permission check as `GET /engagements/:id`.

CSV Import/Export
- Import/export operate on clients only: `contact`, `email`, `phone`, `status`, `engagements` columns. `industry`/`briefing`/`name` are no longer client fields (see migration 005) and are not part of the client CSV. Ignore engagements in CSV import — they are created via API.

Authentication & Users
- `users` are managed locally. API endpoints that create or modify resources should accept `created_by` or `author_id` numeric user ids.
- `users.password_hash` (added in migration 002) stores a bcrypt hash. Plaintext passwords are never stored or returned.
- `users` columns as of migration 018: `id`, `name` (required), `email` (required), `created_at`, `position_name` (nullable, not yet used by any feature — reserved for future use), `password_hash`, `is_active`, `role_id`. Migration 018 fixed a drift where `001_create_schema_up.sql` still described a `username`/`full_name`/nullable-`email` shape that the running app never actually used (it always read/wrote a single `name` column) — also dropped two dead, unused columns (`position_id`, and `user_status`, which duplicated `is_active`).

- There is no self-registration endpoint — accounts can only be created by an admin via `POST /users`. (`POST /auth/register` existed previously but was removed; only `/auth/login` remains public under `/auth/*`.)

- POST /auth/login
  - Body: { email, password, remember? }
  - Returns { token, user: { id, name, email, role_id, role } } on success (`role` is the role's display name, joined for convenience — `role_id` is what authorization actually keys on). `token` is a JWT (HS256) signed with `JWT_SECRET`, embedding `role_id` — expiry is 30 days if `remember` is truthy, otherwise 12 hours. Returns 403 `{ error: "Account is deactivated" }` if `is_active` is false.
  - Rate-limited to 10 attempts per 15 minutes per IP (`express-rate-limit`); returns 429 with `{ error: "Too many login attempts. Please try again later." }` past that.

- All endpoints below `/auth/*` require `Authorization: Bearer <token>` from a successful login, or they return 401.

Public endpoints (no auth — migration 010 added `companies.website` for this)
- POST /public/client-registrations
  - Body: { contact_name, phone, email, company_name, company_city, company_industry, company_website, company_briefing, hp_field }
  - Genuinely unauthenticated — backs the public `/register` page shared with external clients. All 7 real fields are required (400 listing which are missing otherwise); creates a `clients` row (`status='Prospect'`, `stage='phase1'`) and a linked `companies` row in one transaction.
  - `hp_field` is a honeypot: the real form leaves it empty and visually hides it. If it arrives non-empty, the request is treated as a bot — responds with the same `201 { ok: true }` shape without writing anything, so the trap is never revealed.
  - Returns `201 { ok: true }` on success (no ids exposed to an anonymous caller).
  - Rate-limited to 5 submissions per hour per IP; returns 429 with `{ error: "Too many submissions. Please try again later." }` past that.

Environment variables (backend `.env`)
- `JWT_SECRET` (required) — signs auth tokens; the server refuses to start without it.
- `DATABASE_URL` — Postgres connection string.
- `PORT` — defaults to 3000 if unset (the dev scripts/docs elsewhere assume 3001; set explicitly for production).
- `FRONTEND_ORIGIN` — restricts CORS to this origin (e.g. `https://app.example.com`). If unset, CORS allows any origin (`cors()` with no options) — fine for LAN/dev use, but should always be set in a public deployment.

Frontend build-time variable
- `VITE_API_BASE` — if set at build time (`.env.production` or the build command's environment), the frontend calls this URL for all API requests instead of deriving `http://<current-hostname>:3001` from the browser's own address. Needed for any deployment where the frontend and backend aren't reachable via the same hostname on port 3001 (e.g. backend behind a reverse proxy on a different subdomain/port).

Roles & Permissions (migration 007 added roles as an enum, migration 008 added the permissions matrix, migration 009 replaced the enum with a `roles` table so roles can be added/renamed from the app)
- `roles(id, name, protected, created_at)` — a role is a row, not a fixed code value. `protected=true` marks a role that can't be renamed (seeded on `admin` only) — there is currently no role deletion, only create and rename.
- `users.role_id` (FK to `roles.id`) replaces the old `users.role` enum column. The column still carries a DB-level default (the `Customer Relation` role, set in migration 011) but nothing in the app relies on it anymore now that self-registration is removed — the Add User form always sends `role_id` explicitly. `users.is_active` (default `true`) still gates login — deactivated accounts get 403 on `/auth/login` regardless of a correct password.
- `role_permissions(role_id, page_key)` is the configurable matrix: which page_keys (`phase1`, `phase2`, `phase3`, `system_admin`) each role can access. `role_id` is read from the JWT claims at request time — a role reassignment takes effect the next time that user logs in (new token), not retroactively on their current session. A permissions-matrix edit takes effect for other users the next time their frontend reloads `/permissions/me` (on next login/app load), not mid-session.
- `requirePage(pageKey)` is the generic middleware backing all page-level gating, including System Administration (`system_admin`) — there is no separate hardcoded admin check. `requireClientPhase(...)` is the analogous middleware for client-scoped resources, gating by the client's `stage` column (which maps 1:1 onto the `phase1`/`phase2` page_keys) instead of a fixed page_key.
- The "don't lock yourself out" safeguard on `PUT /permissions` is role-agnostic: it rejects any update that would leave *zero* roles with `system_admin` access, rather than hardcoding the role named `admin`.
- There is no hard user deletion — accounts are deactivated (`is_active=false`), mirroring how clients are never hard-deleted from the UI either. The same "no hard delete" policy applies to roles: they can be created and renamed (unless `protected`), not removed.

- GET /roles
  - Requires `system_admin` page access. Returns all roles: { id, name, protected }.

- POST /roles
  - Requires `system_admin` page access. Body: { name }. Creates a role (`protected=false`), 409 if the name (case-insensitive) already exists. New roles start with **no** permissions rows — grant page access via `PUT /permissions` afterward.

- PUT /roles/:id
  - Requires `system_admin` page access. Body: { name }. Renames a role; 400 if the role is `protected`, 409 on a name collision, 404 if not found.

- GET /permissions/me
  - Any authenticated user. Returns the caller's own permitted page_keys as an array, e.g. `["phase1","phase2","phase3"]`. The frontend calls this on login/app load to decide which tabs to render.

- GET /permissions
  - Requires `system_admin` page access. Returns the full matrix keyed by role id: `{ [role_id]: { name, page_keys: [...] } }`.

- PUT /permissions
  - Requires `system_admin` page access. Body: { role_id, page_keys: [...] }. Replaces that role's permitted page_keys (transactional delete + insert). Rejects with 400 if the update would leave no role with `system_admin` access.

- GET /users
  - Requires `system_admin` page access. Returns all users: { id, name, email, role_id, role_name, is_active, created_at } (no password data).

- POST /users
  - Requires `system_admin` page access. Body: { name, email, password, role_id? } (password min 8 chars, 400 if `role_id` doesn't reference an existing role)
  - The only way to create a user account — there is no public self-registration endpoint.

- PUT /users/:id
  - Requires `system_admin` page access. Body: any subset of { name, email, role_id, is_active } to update. Returns the updated resource (no password data), 400 if `name`/`email` is blank or `role_id` doesn't exist, 409 if `email` is already registered to a different user, 404 if the user isn't found.

- POST /users/:id/reset-password
  - Requires `system_admin` page access. Body: { new_password } (min 8 chars)
  - Admin sets a new password directly, bypassing the old one. Returns 204 on success, 404 if not found.

Investors (migration 025, updated in migration 026)
- Standalone entity, not tied to the client pipeline/phases — gated by its own `investors` page_key, granted to every existing role by default (same convention as `calendar` in migration 019), adjustable via the Permissions page.
- `investors(id, name, mobile, email, investor_type, company_name, industries, notes, created_by, created_at, updated_at)`. `investor_type` is free text (`Individual`/`Corporate`/`Institutional` in the UI, default `Individual`). `industries` is a `TEXT[]` (added in migration 026, replacing `nationality`/`national_id`/`status` which were dropped in the same migration) — a multi-select checkbox list reusing the same industry options as the company form. `mobile` stores just the 9 local digits, validated server-side as exactly 9 digits not starting with 0 — the UI shows a fixed `+966` prefix (investors have no per-record country field, unlike companies).

- GET /investors
  - Requires `investors` page access. Returns all investors, newest first.

- GET /investors/:id
  - Requires `investors` page access. 404 if not found.

- POST /investors
  - Requires `investors` page access. Body: { name, mobile, email?, investor_type?, company_name?, industries?, notes? }. `name` and `mobile` are required; `mobile` must match `^[1-9]\d{8}$`. `industries` defaults to `[]` if omitted or not an array. `created_by` is taken from the authenticated user (JWT `sub`).

- PUT /investors/:id
  - Requires `investors` page access. Body: any subset of { name, mobile, email, investor_type, company_name, industries, notes }. Same `mobile` validation as create when provided. 404 if not found.

- DELETE /investors/:id
  - Requires `investors` page access. Returns 204 on success, 404 if not found.

Examples (curl)

Create a client:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Acme","contact_name":"Jane","email":"jane@acme.com"}' \
  http://localhost:3000/clients
```

Assign an engagement (server should run the following transaction server-side):

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"to_user_id": 12, "note":"Handoff to next person"}' \
  http://localhost:3000/engagements/42/assign
```

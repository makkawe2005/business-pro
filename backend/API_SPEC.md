# API Specification — Client Dashboard

All endpoints return JSON. This document lists endpoints to be implemented on the server (no code changes applied yet).

Clients
- `clients.status` (added in migration 001, extended in migrations 012 and 016) is a `client_status` enum: `Prospect`, `Reschedule`, `Active`, `Finalizing`, or `Inactive`. `Reschedule` (added in migration 012) is set when Phase 2 sends a client back to Sales for follow-up — the Sales/Phase 1 view shows both `Prospect` and `Reschedule` clients together (colored differently in the UI), distinct from a fresh Prospect lead. `Finalizing` (added in migration 016) is set when Sales graduates a client into Finance & Legal.

- GET /clients/summary
  - Returns aggregate counts only: { total, prospect, reschedule, active, inactive }, computed in SQL. `active` is `Active` + `Finalizing` combined (a Finance & Legal client is still an active deal, just in its final stage). `total` is every non-`Inactive` status (`Prospect` + `Reschedule` + `Active` + `Finalizing`) — it deliberately excludes `inactive` clients, since they're no longer a "live" client. Not phase-gated (counts carry no client-level data) — used by the Phase 1/2/3 summary cards instead of fetching every client row.

- GET /clients
  - Query params: `stage` (optional, `phase1`/`phase2`/`phase3`) and `status` (optional, one or more of `Prospect`/`Reschedule`/`Active`/`Finalizing`/`Inactive` as a comma-separated list, e.g. `status=Prospect,Reschedule`) — both filters apply together (AND) when both are present. Omit either to skip that filter.
  - Returns: list of clients. Each client object should include an aggregated `engagements_count` (server computes via COUNT) and `company_name` (the client's first/oldest linked company, `null` if none — a client can technically have several `companies` rows, but the UI only ever creates one).
  - If `stage` is present, requires the caller's role to have that page_key in the permissions matrix (see "Roles & Permissions" below) or returns 403 `{ error: "Not permitted for this phase" }`.

- GET /dashboard
  - Requires `dashboard` page access (added in migration 017, seeded to `admin`; grant it to other roles via the Permissions page). Returns `{ columns: [{ key, clients: [{ id, contact_name, phone, status, stage, updated_at, company_name }] }], statusCounts: { Prospect, Reschedule, Active, Finalizing, Inactive }, industryCounts: [{ industry, count }], serviceCounts: { consultation, investment, businessSolutions } }`. `columns` has five fixed entries: `prospect` (`phase1`/`Prospect`), `reschedule` (`phase1`/`Reschedule`), `sales` (`phase2`/`Active`), `legalFinance` (`phase3`/`Finalizing`) — each an exact stage+status match — and `inactive` (`status='Inactive'` across **any** stage, since a client can go inactive from phase1, phase2, or phase3), all sorted by `contact_name`. `company_name` is the client's first/oldest linked company (`null` if none, same as `GET /clients`). `phone`, `stage`, and `company_name` are included so the dashboard's client-side search/table can show/filter by them and link into the right phase (`stage` matters most for the `inactive` column, since it spans all three stages). `statusCounts` is a raw per-status count across **all** clients regardless of stage — powers the dashboard's status bar chart. `industryCounts` counts distinct clients grouped by their first company's `industry` (clients with no company, or whose company has no industry set, are excluded), sorted by count descending — powers the dashboard's industry donut chart. `serviceCounts` is a count of clients with each `service_*` boolean (added in migration 014) set `true`, across **all** clients — powers the dashboard's services bar chart. This is a read-only pipeline-wide overview independent of per-phase permissions — a role can see the dashboard without also having `phase1`/`phase2`/`phase3` access.

- GET /clients/:id
  - Returns: client fields + notes (latest first) + engagements (with current_assigned_user and status) + companies (latest first).
  - Requires the caller's role to have the client's current `stage` as a permitted page_key, or returns 403.

- POST /clients
  - Body: { contact_name, email, phone, status, stage? }
  - `stage` defaults to `phase1` when omitted. `contact_name` is required. Creates a client and returns the created resource.
  - `name`, `industry`, and `briefing` no longer live on `clients` (moved to `companies` in migration 005) — the client's display identity is `contact_name`.
  - Requires the caller's role to have the target `stage` (post-default) as a permitted page_key, or returns 403.

- PUT /clients/:id
  - Body: fields to update (same as POST, including `stage`, plus `service_consultation`/`service_investment`/`service_business_solutions` — booleans, added in migration 014, default `false`, toggled independently from the Services checkboxes in the client detail panel). Returns updated resource. Used to graduate a client from Phase 1 to Phase 2 via `{ "stage": "phase2", "status": "Active" }`, from Phase 2 to Phase 3 via `{ "stage": "phase3", "status": "Finalizing" }` (added in migration 016), or to send a Phase 2 **or** Phase 3 client back to Client Relation via `{ "stage": "phase1", "status": "Reschedule" }` — both Sales and Finance & Legal reschedule directly to Client Relation, not to the immediately preceding phase, so `Reschedule` status always means "sitting in Client Relation, kicked back from downstream."
  - Permission check is based on the client's **current** stage (pre-update), not the target stage — a phase1-only role can still graduate a client into phase2 via this call (a normal handoff), it just can't independently browse/edit phase2 clients afterward. Returns 403 if the caller's role lacks the client's current stage.

- DELETE /clients/:id
  - Deletes the client (cascades to its notes, engagements, and engagement_events). Returns 204 on success, 404 if not found. Same current-stage permission check as PUT.

- `clients.stage` (added in migration 003, extended in migration 016) is a `client_stage` enum: `phase1` (default), `phase2`, or `phase3`. The frontend graduates a client to `phase2` (and sets `status` to `Active`) when an engagement is created for them in Phase 1, and from `phase2` to `phase3` (and sets `status` to `Finalizing`) the same way from Sales. Finance & Legal (`phase3`) mirrors Sales' read-only client view (Services/Company locked, Notes only, no Appointments) and its pipeline actions ("Next Phase", "Deal Cancele" with a mandatory reason, and "Reschedule" with a mandatory reason) — the only difference is Phase 3 has no further stage to graduate into. Both Sales and Finance & Legal reschedule directly back to `phase1` (Client Relation), never to each other, so Sales' list only ever shows `Active` clients (no `Reschedule` filter there) — only Phase 1 lists both `Prospect` and `Reschedule` together.
- The frontend never issues `DELETE /clients/:id` from its UI anymore — "removing" a client from either phase is done via `PUT /clients/:id` with `{ "status": "Inactive" }`, which keeps the record. `DELETE` remains available as an API capability but is unused by the current UI.

Notes
- POST /clients/:id/notes
  - Body: { author_id?, author_name, text }
  - Creates a note linked to the client. Same current-stage permission check as `PUT /clients/:id`.

Companies
- POST /clients/:id/companies
  - Body: { name, region?, city?, country?, commercial_registration_number?, vat_number?, national_address?, industry?, briefing?, contact_person_name?, additional_phone_number? }
  - Creates a company record owned by the client (`companies.client_id` FK, `ON DELETE CASCADE`, added in migration 004). `name` is required, all other fields optional. `industry`, `briefing`, `contact_person_name`, and `additional_phone_number` were added in migration 005. Same current-stage permission check as `PUT /clients/:id`.

- PUT /companies/:id
  - Body: any subset of the POST fields to update. Returns the updated resource, 404 if not found. Permission check resolves the owning client via `companies.client_id` and applies the same current-stage rule.

- DELETE /companies/:id
  - Deletes a single company record. Returns 204 on success, 404 if not found. Same permission check as PUT.

- The UI restricts each client to at most one company (the "Add company" form hides once a client has one, editing happens via PUT instead) — the API itself still allows multiple companies per client.

Appointments
- GET /clients/:id
  - The client detail bundle now also includes `appointments` (chronological, soonest first) — added in migration 006. There is no standalone list endpoint, matching how `notes`/`companies` are only ever read via this bundle.

- POST /clients/:id/appointments
  - Body: { scheduled_at, title, agenda?, meeting_type? }
  - `scheduled_at` and `title` are required. Creates an appointment linked to the client with `status` defaulting to `Scheduled` and `meeting_type` defaulting to `Remote` (added in migration 015; one of `Remote`/`In-Person`, enforced via a `CHECK` constraint, not an enum). Same current-stage permission check as `PUT /clients/:id`.

- PUT /appointments/:id
  - Body: any subset of { scheduled_at, title, agenda, status, meeting_type } to update. `status` is one of `Scheduled`/`Completed`/`Cancelled` (the `appointment_status` enum); `meeting_type` is one of `Remote`/`In-Person`. Returns the updated resource, 404 if not found. Permission check resolves the owning client via `appointments.client_id`.

- DELETE /appointments/:id
  - Deletes a single appointment. Returns 204 on success, 404 if not found. Same permission check as PUT.

- Phase 2 replaced its Call log (notes) section with Appointments; Phase 1 still uses notes.

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

- POST /auth/register
  - Body: { name, email, password } (password min 8 chars)
  - Creates a user with a bcrypt-hashed password. Returns { id, name, email } (no hash).

- POST /auth/login
  - Body: { email, password }
  - Returns { token, user: { id, name, email, role_id, role } } on success (`role` is the role's display name, joined for convenience — `role_id` is what authorization actually keys on). `token` is a JWT (HS256, 12h expiry) signed with `JWT_SECRET`, embedding `role_id`. Returns 403 `{ error: "Account is deactivated" }` if `is_active` is false.
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
- `users.role_id` (FK to `roles.id`, default is the `user` role) replaces the old `users.role` enum column. `users.is_active` (default `true`) still gates login — deactivated accounts get 403 on `/auth/login` regardless of a correct password.
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
  - Requires `system_admin` page access. Body: { name, email, password, role_id? } (password min 8 chars, `role_id` defaults to the `user` role, 400 if `role_id` doesn't reference an existing role)
  - Admin-created account, same validation as `/auth/register` plus an explicit role.

- PUT /users/:id
  - Requires `system_admin` page access. Body: any subset of { role_id, is_active } to update. Returns the updated resource (no password data), 400 if `role_id` doesn't exist, 404 if the user isn't found.

- POST /users/:id/reset-password
  - Requires `system_admin` page access. Body: { new_password } (min 8 chars)
  - Admin sets a new password directly, bypassing the old one. Returns 204 on success, 404 if not found.

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

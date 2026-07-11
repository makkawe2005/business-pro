# Client Dashboard Backend

This backend provides REST endpoints for the Client Dashboard and uses PostgreSQL as the data store.

Prerequisites
- Node.js 18+ (or compatible)
- PostgreSQL database and `psql` client

Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (e.g. postgres://user:pass@localhost:5432/dbname)

2. Install dependencies:

```bash
cd backend
npm install
```

3. Run migrations (up):

```bash
npm run migrate:up
npm run seed   # optional dev seed
```

4. Start server:

```bash
npm start
```

API
- See `API_SPEC.md` for endpoints and examples.

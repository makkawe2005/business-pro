require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./database');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const publicRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' }
});

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set. Set it in .env before starting the server.');
  process.exit(1);
}

// Auth endpoints
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const { rows } = await db.query(
      `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });
    const token = jwt.sign(
      { sub: user.id, email: user.email, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: remember ? '30d' : '12h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id, role: user.role_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Public endpoints (no auth) — shared externally, e.g. the /register page
app.post('/public/client-registrations', publicRegistrationLimiter, async (req, res) => {
  const {
    contact_name, phone, email,
    company_name, company_city, company_industry, company_website, company_briefing,
    hp_field
  } = req.body;

  if (hp_field) {
    // Honeypot tripped — respond as if it succeeded, don't touch the database.
    return res.status(201).json({ ok: true });
  }

  const required = { contact_name, phone, email, company_name, company_city, company_industry, company_website, company_briefing };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: clientRows } = await client.query(
      `INSERT INTO clients (contact_name, email, phone, status, stage)
       VALUES ($1,$2,$3,'Prospect','phase1') RETURNING id`,
      [contact_name, email, phone]
    );
    const clientId = clientRows[0].id;
    await client.query(
      `INSERT INTO companies (client_id, name, city, industry, website, briefing)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [clientId, company_name, company_city, company_industry, company_website, company_briefing]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to submit registration' });
  } finally {
    client.release();
  }
});

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.use(authRequired);

async function roleHasPage(roleId, pageKey) {
  const { rows } = await db.query(
    'SELECT 1 FROM role_permissions WHERE role_id=$1 AND page_key=$2',
    [roleId, pageKey]
  );
  return !!rows[0];
}

function requirePage(pageKey) {
  return async (req, res, next) => {
    try {
      if (!(await roleHasPage(req.user.role_id, pageKey))) {
        return res.status(403).json({ error: 'Not permitted for this page' });
      }
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to verify permission' });
    }
  };
}

function requireClientPhase(resolveClientId) {
  return async (req, res, next) => {
    try {
      const clientId = await resolveClientId(req);
      if (clientId === null) return res.status(404).json({ error: 'Not found' });
      const { rows } = await db.query('SELECT stage FROM clients WHERE id=$1', [clientId]);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      if (!(await roleHasPage(req.user.role_id, rows[0].stage))) {
        return res.status(403).json({ error: 'Not permitted for this phase' });
      }
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to verify permission' });
    }
  };
}

const resolveClientIdDirect = (req) => Promise.resolve(Number(req.params.id));

async function resolveClientIdViaCompany(req) {
  const { rows } = await db.query('SELECT client_id FROM companies WHERE id=$1', [Number(req.params.id)]);
  return rows[0] ? rows[0].client_id : null;
}

async function resolveClientIdViaAppointment(req) {
  const { rows } = await db.query('SELECT client_id FROM appointments WHERE id=$1', [Number(req.params.id)]);
  return rows[0] ? rows[0].client_id : null;
}

async function resolveClientIdViaEngagement(req) {
  const { rows } = await db.query('SELECT client_id FROM engagements WHERE id=$1', [Number(req.params.id)]);
  return rows[0] ? rows[0].client_id : null;
}

// Clients endpoints
app.get('/clients/summary', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT status, COUNT(*)::int AS count FROM clients GROUP BY status');
    const summary = { total: 0, prospect: 0, reschedule: 0, active: 0, inactive: 0 };
    for (const row of rows) {
      if (row.status === 'Prospect') summary.prospect = row.count;
      if (row.status === 'Reschedule') summary.reschedule = row.count;
      if (row.status === 'Active' || row.status === 'Finalizing') summary.active += row.count;
      if (row.status === 'Inactive') summary.inactive = row.count;
      if (row.status !== 'Inactive') summary.total += row.count;
    }
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch client summary' });
  }
});

app.get('/dashboard', requirePage('dashboard'), async (req, res) => {
  try {
    const columnDefs = [
      { key: 'prospect', stage: 'phase1', status: 'Prospect' },
      { key: 'reschedule', stage: 'phase1', status: 'Reschedule' },
      { key: 'sales', stage: 'phase2', status: 'Active' },
      { key: 'legalFinance', stage: 'phase3', status: 'Finalizing' },
      { key: 'inactive', stage: null, status: 'Inactive' }
    ];
    const columns = [];
    for (const def of columnDefs) {
      const params = def.stage ? [def.stage, def.status] : [def.status];
      const whereClause = def.stage ? 'c.stage=$1 AND c.status=$2' : 'c.status=$1';
      const { rows } = await db.query(
        `SELECT c.id, c.contact_name, c.phone, c.status, c.stage, c.updated_at, comp.name AS company_name
         FROM clients c
         LEFT JOIN LATERAL (
           SELECT name FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
         ) comp ON true
         WHERE ${whereClause} ORDER BY c.contact_name ASC`,
        params
      );
      columns.push({ key: def.key, clients: rows });
    }

    const { rows: statusRows } = await db.query('SELECT status, COUNT(*)::int AS count FROM clients GROUP BY status');
    const statusCounts = { Prospect: 0, Reschedule: 0, Active: 0, Finalizing: 0, Inactive: 0 };
    for (const row of statusRows) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) statusCounts[row.status] = row.count;
    }

    const { rows: industryRows } = await db.query(`
      SELECT comp.industry, COUNT(DISTINCT c.id)::int AS count
      FROM clients c
      JOIN LATERAL (
        SELECT industry FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
      ) comp ON true
      WHERE comp.industry IS NOT NULL AND comp.industry != ''
      GROUP BY comp.industry
      ORDER BY count DESC
    `);

    const { rows: serviceRows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE service_consultation)::int AS consultation,
        COUNT(*) FILTER (WHERE service_investment)::int AS investment,
        COUNT(*) FILTER (WHERE service_business_solutions)::int AS "businessSolutions"
      FROM clients
    `);
    const serviceCounts = serviceRows[0];

    res.json({ columns, statusCounts, industryCounts: industryRows, serviceCounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

app.get('/clients', async (req, res) => {
  const { stage, status } = req.query;
  try {
    if (stage && !(await roleHasPage(req.user.role_id, stage))) {
      return res.status(403).json({ error: 'Not permitted for this phase' });
    }
    const params = [];
    const conditions = [];
    if (stage) {
      params.push(stage);
      conditions.push(`c.stage = $${params.length}`);
    }
    if (status) {
      params.push(status.split(','));
      conditions.push(`c.status = ANY($${params.length}::client_status[])`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const q = `SELECT c.*, COALESCE(counts.engagements_count,0) AS engagements_count, comp.name AS company_name
               FROM clients c
               LEFT JOIN (
                 SELECT client_id, COUNT(*) AS engagements_count FROM engagements GROUP BY client_id
               ) counts ON counts.client_id = c.id
               LEFT JOIN LATERAL (
                 SELECT name FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
               ) comp ON true
               ${whereClause}
               ORDER BY c.contact_name`;
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.get('/clients/:id', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const clientQ = 'SELECT * FROM clients WHERE id=$1';
    const { rows: clientRows } = await db.query(clientQ, [id]);
    if (!clientRows[0]) return res.status(404).json({ error: 'Client not found' });
    const client = clientRows[0];

    const notesQ = 'SELECT * FROM notes WHERE client_id=$1 ORDER BY created_at DESC';
    const { rows: notes } = await db.query(notesQ, [id]);

    const engagementsQ = 'SELECT * FROM engagements WHERE client_id=$1 ORDER BY created_at DESC';
    const { rows: engagements } = await db.query(engagementsQ, [id]);

    const companiesQ = 'SELECT * FROM companies WHERE client_id=$1 ORDER BY created_at DESC';
    const { rows: companies } = await db.query(companiesQ, [id]);

    const appointmentsQ = 'SELECT * FROM appointments WHERE client_id=$1 ORDER BY scheduled_at ASC';
    const { rows: appointments } = await db.query(appointmentsQ, [id]);

    const documentsQ = `SELECT id, client_id, file_name, mime_type, file_size, uploaded_by, created_at
                         FROM client_documents WHERE client_id=$1 ORDER BY created_at DESC`;
    const { rows: documents } = await db.query(documentsQ, [id]);

    res.json({ client, notes, engagements, companies, appointments, documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

app.post('/clients', async (req, res) => {
  const { contact_name, email, phone, status, stage } = req.body;
  if (!contact_name) return res.status(400).json({ error: 'contact_name required' });
  const targetStage = stage || 'phase1';
  try {
    if (!(await roleHasPage(req.user.role_id, targetStage))) {
      return res.status(403).json({ error: 'Not permitted for this phase' });
    }
    const q = `INSERT INTO clients (contact_name, email, phone, status, stage)
               VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    const { rows } = await db.query(q, [contact_name, email, phone, status || 'Prospect', targetStage]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/clients/:id', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['contact_name','email','phone','status','stage','service_consultation','service_investment','service_business_solutions'];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      sets.push(`${f} = $${idx}`);
      values.push(req.body[f]);
      idx++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const q = `UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  try {
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/clients/:id', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await db.query('DELETE FROM clients WHERE id=$1 RETURNING id', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Notes
app.post('/clients/:id/notes', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const { author_id, author_name, text } = req.body;
  if (!author_name || !text) return res.status(400).json({ error: 'author_name and text required' });
  try {
    const q = `INSERT INTO notes (client_id, author_id, author_name, text) VALUES ($1,$2,$3,$4) RETURNING *`;
    const { rows } = await db.query(q, [clientId, author_id || null, author_name, text]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Companies
app.post('/clients/:id/companies', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const {
    name, region, city, country, commercial_registration_number, vat_number, national_address,
    industry, briefing, contact_person_name, additional_phone_number
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const q = `INSERT INTO companies (
                 client_id, name, region, city, country, commercial_registration_number, vat_number, national_address,
                 industry, briefing, contact_person_name, additional_phone_number
               )
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`;
    const { rows } = await db.query(q, [
      clientId, name, region || null, city || null, country || null, commercial_registration_number || null, vat_number || null, national_address || null,
      industry || null, briefing || null, contact_person_name || null, additional_phone_number || null
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add company' });
  }
});

app.put('/companies/:id', requireClientPhase(resolveClientIdViaCompany), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['name','region','city','country','commercial_registration_number','vat_number','national_address','industry','briefing','contact_person_name','additional_phone_number'];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      sets.push(`${f} = $${idx}`);
      values.push(req.body[f]);
      idx++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const q = `UPDATE companies SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  try {
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

app.delete('/companies/:id', requireClientPhase(resolveClientIdViaCompany), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await db.query('DELETE FROM companies WHERE id=$1 RETURNING id', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// Appointments
app.get('/appointments', requirePage('calendar'), async (req, res) => {
  const { from, to, status } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (from) {
      params.push(from);
      conditions.push(`a.scheduled_at::date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`a.scheduled_at::date <= $${params.length}::date`);
    }
    if (status) {
      params.push(status.split(','));
      conditions.push(`a.status = ANY($${params.length}::appointment_status[])`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT a.id, a.scheduled_at, a.title, a.agenda, a.status, a.meeting_type, a.location, a.meeting_link,
              c.id AS client_id, c.contact_name, c.stage
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       ${whereClause}
       ORDER BY a.scheduled_at ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/clients/:id/appointments', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const { scheduled_at, title, agenda, created_by, meeting_type, location, meeting_link } = req.body;
  if (!scheduled_at || !title) return res.status(400).json({ error: 'scheduled_at and title required' });
  try {
    const q = `INSERT INTO appointments (client_id, scheduled_at, title, agenda, created_by, meeting_type, location, meeting_link)
               VALUES ($1,$2,$3,$4,$5,COALESCE($6,'Remote'),$7,$8) RETURNING *`;
    const { rows } = await db.query(q, [
      clientId, scheduled_at, title, agenda || null, created_by || null, meeting_type || null,
      location || null, meeting_link || null
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

app.put('/appointments/:id', requireClientPhase(resolveClientIdViaAppointment), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['scheduled_at', 'title', 'agenda', 'status', 'meeting_type', 'location', 'meeting_link'];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      sets.push(`${f} = $${idx}`);
      values.push(req.body[f]);
      idx++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const q = `UPDATE appointments SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  try {
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

app.delete('/appointments/:id', requireClientPhase(resolveClientIdViaAppointment), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await db.query('DELETE FROM appointments WHERE id=$1 RETURNING id', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Documents (listed as part of the GET /clients/:id bundle; upload/delete restricted to Client
// Relation regardless of the client's current stage, download available to whoever can currently
// view the client, matching requireClientPhase everywhere else).
app.post('/clients/:id/documents', requirePage('phase1'), upload.single('file'), async (req, res) => {
  const clientId = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'file required' });
  try {
    const q = `INSERT INTO client_documents (client_id, file_name, mime_type, file_size, file_data, uploaded_by)
               VALUES ($1,$2,$3,$4,$5,$6)
               RETURNING id, client_id, file_name, mime_type, file_size, uploaded_by, created_at`;
    const { rows } = await db.query(q, [
      clientId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user.sub
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

app.get('/clients/:id/documents/:docId/download', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const docId = Number(req.params.docId);
  try {
    const { rows } = await db.query(
      'SELECT file_name, mime_type, file_data FROM client_documents WHERE id=$1 AND client_id=$2',
      [docId, Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];
    res.set('Content-Type', doc.mime_type);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(doc.file_data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

app.delete('/clients/:id/documents/:docId', requirePage('phase1'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM client_documents WHERE id=$1 AND client_id=$2 RETURNING id',
      [Number(req.params.docId), Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Engagements
app.post('/clients/:id/engagements', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const { title, description, created_by, current_assigned_user } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const q = `INSERT INTO engagements (client_id, title, description, created_by, current_assigned_user)
               VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    const { rows } = await db.query(q, [clientId, title, description || null, created_by || null, current_assigned_user || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create engagement' });
  }
});

app.get('/engagements/:id', requireClientPhase(resolveClientIdViaEngagement), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const q = 'SELECT * FROM engagements WHERE id=$1';
    const { rows } = await db.query(q, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Engagement not found' });
    const engagement = rows[0];
    const eventsQ = 'SELECT * FROM engagement_events WHERE engagement_id=$1 ORDER BY created_at DESC';
    const { rows: events } = await db.query(eventsQ, [id]);
    res.json({ engagement, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch engagement' });
  }
});

// Assign/handoff endpoint — transactionally insert event then update engagement
app.post('/engagements/:id/assign', requireClientPhase(resolveClientIdViaEngagement), async (req, res) => {
  const engagementId = Number(req.params.id);
  const { from_user_id, to_user_id, event_type, note } = req.body;
  if (!to_user_id) return res.status(400).json({ error: 'to_user_id required' });
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const insertEventQ = `INSERT INTO engagement_events (engagement_id, from_user_id, to_user_id, event_type, note)
                          VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    const { rows: evRows } = await client.query(insertEventQ, [engagementId, from_user_id || null, to_user_id, event_type || 'assigned', note || null]);
    const updateEngQ = `UPDATE engagements SET current_assigned_user=$1, status=$2, updated_at = now() WHERE id=$3 RETURNING *`;
    const status = 'in_progress';
    const { rows: engRows } = await client.query(updateEngQ, [to_user_id, status, engagementId]);
    await client.query('COMMIT');
    res.status(201).json({ event: evRows[0], engagement: engRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to assign engagement' });
  } finally {
    client.release();
  }
});

// Users (System administration — requires system_admin page access)
app.get('/users', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name, u.is_active, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/users', requirePage('system_admin'), async (req, res) => {
  const { name, email, password, role_id } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  try {
    if (role_id !== undefined) {
      const { rows: roleRows } = await db.query('SELECT 1 FROM roles WHERE id=$1', [role_id]);
      if (!roleRows[0]) return res.status(400).json({ error: 'role_id does not exist' });
    }
    const { rows: existing } = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing[0]) return res.status(409).json({ error: 'Email already registered' });
    const password_hash = await bcrypt.hash(password, 10);
    const columns = role_id !== undefined ? '(name, email, password_hash, role_id)' : '(name, email, password_hash)';
    const values = role_id !== undefined ? [name, email, password_hash, role_id] : [name, email, password_hash];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await db.query(
      `INSERT INTO users ${columns} VALUES (${placeholders})
       RETURNING id, name, email, role_id, is_active, created_at`,
      values
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/users/:id', requirePage('system_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['role_id', 'is_active'];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      sets.push(`${f} = $${idx}`);
      values.push(req.body[f]);
      idx++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'role_id')) {
      const { rows: roleRows } = await db.query('SELECT 1 FROM roles WHERE id=$1', [req.body.role_id]);
      if (!roleRows[0]) return res.status(400).json({ error: 'role_id does not exist' });
    }
    values.push(id);
    const q = `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role_id, is_active, created_at`;
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/users/:id/reset-password', requirePage('system_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' });
  }
  try {
    const password_hash = await bcrypt.hash(new_password, 10);
    const { rows } = await db.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id, name, email',
      [password_hash, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Roles (System administration — requires system_admin page access)
app.get('/roles', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, protected FROM roles ORDER BY protected DESC, name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

app.post('/roles', requirePage('system_admin'), async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows: existing } = await db.query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing[0]) return res.status(409).json({ error: 'A role with this name already exists' });
    const { rows } = await db.query(
      'INSERT INTO roles (name, protected) VALUES ($1, false) RETURNING id, name, protected',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

app.put('/roles/:id', requirePage('system_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows: roleRows } = await db.query('SELECT protected FROM roles WHERE id=$1', [id]);
    if (!roleRows[0]) return res.status(404).json({ error: 'Role not found' });
    if (roleRows[0].protected) return res.status(400).json({ error: 'This role cannot be renamed' });
    const { rows: existing } = await db.query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND id != $2', [name, id]);
    if (existing[0]) return res.status(409).json({ error: 'A role with this name already exists' });
    const { rows } = await db.query(
      'UPDATE roles SET name=$1 WHERE id=$2 RETURNING id, name, protected',
      [name, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename role' });
  }
});

// Permissions (role -> page access matrix)
const ALL_PAGE_KEYS = ['dashboard', 'phase1', 'phase2', 'phase3', 'calendar', 'system_admin'];

app.get('/permissions/me', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT page_key FROM role_permissions WHERE role_id=$1', [req.user.role_id]);
    res.json(rows.map((r) => r.page_key));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

app.get('/permissions', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows: roles } = await db.query('SELECT id, name FROM roles ORDER BY protected DESC, name ASC');
    const { rows: perms } = await db.query('SELECT role_id, page_key FROM role_permissions');
    const matrix = {};
    for (const role of roles) matrix[role.id] = { name: role.name, page_keys: [] };
    for (const row of perms) {
      if (matrix[row.role_id]) matrix[row.role_id].page_keys.push(row.page_key);
    }
    res.json(matrix);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

app.put('/permissions', requirePage('system_admin'), async (req, res) => {
  const { role_id, page_keys } = req.body;
  if (!Array.isArray(page_keys) || page_keys.some((k) => !ALL_PAGE_KEYS.includes(k))) {
    return res.status(400).json({ error: 'page_keys must be an array of valid page keys' });
  }
  try {
    const { rows: roleRows } = await db.query('SELECT id FROM roles WHERE id=$1', [role_id]);
    if (!roleRows[0]) return res.status(400).json({ error: 'role_id does not exist' });
    if (!page_keys.includes('system_admin')) {
      const { rows: otherRows } = await db.query(
        "SELECT COUNT(DISTINCT role_id)::int AS count FROM role_permissions WHERE page_key='system_admin' AND role_id != $1",
        [role_id]
      );
      if (otherRows[0].count === 0) {
        return res.status(400).json({ error: 'At least one role must always retain System Administration access' });
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify permission update' });
  }
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE role_id=$1', [role_id]);
    for (const pageKey of page_keys) {
      await client.query('INSERT INTO role_permissions (role_id, page_key) VALUES ($1,$2)', [role_id, pageKey]);
    }
    await client.query('COMMIT');
    res.json({ role_id, page_keys });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update permissions' });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

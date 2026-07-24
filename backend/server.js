require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();

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
  if (!/^\+966[1-9]\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'phone must be a valid Saudi mobile number' });
  }

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
      req.clientStage = rows[0].stage;
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

async function resolveClientIdViaTask(req) {
  const { rows } = await db.query('SELECT client_id FROM tasks WHERE id=$1', [Number(req.params.id)]);
  return rows[0] ? rows[0].client_id : null;
}

// Which team a client's checked service becomes a task for; business_solutions gets a
// parent-only container (assigned_to stays NULL) whose sub-tasks are added dynamically
// by the Project Manager instead of a fixed list.
const SERVICE_TITLES = {
  service_consultation: { service: 'consultation', title: 'Consultation' },
  service_investment: { service: 'investment', title: 'Investment' },
  service_business_solutions: { service: 'business_solutions', title: 'Business Solutions' }
};

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
      // No status filter: phase4 clients carry either `Executing` or `Completed`, and both belong here.
      { key: 'execution', stage: 'phase4' }
    ];
    const columns = [];
    for (const def of columnDefs) {
      const params = def.status ? [def.stage, def.status] : [def.stage];
      const whereClause = def.status ? 'c.stage=$1 AND c.status=$2' : 'c.stage=$1';
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

    const { rows: statusRows } = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM clients WHERE status != 'Inactive' GROUP BY status`
    );
    const statusCounts = { Prospect: 0, Reschedule: 0, Active: 0, Finalizing: 0 };
    for (const row of statusRows) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) statusCounts[row.status] = row.count;
    }

    const { rows: industryRows } = await db.query(`
      SELECT comp.industry, COUNT(DISTINCT c.id)::int AS count
      FROM clients c
      JOIN LATERAL (
        SELECT industry FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
      ) comp ON true
      WHERE c.status != 'Inactive' AND comp.industry IS NOT NULL AND comp.industry != ''
      GROUP BY comp.industry
      ORDER BY count DESC
    `);

    const { rows: serviceRows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE service_consultation)::int AS consultation,
        COUNT(*) FILTER (WHERE service_investment)::int AS investment,
        COUNT(*) FILTER (WHERE service_business_solutions)::int AS "businessSolutions"
      FROM clients
      WHERE status != 'Inactive'
    `);
    const serviceCounts = serviceRows[0];

    // Leaf tasks only (same definition used by /execution/summary) — powers the Overview
    // dashboard's open-vs-closed donut, a system-wide task snapshot independent of phase4 access.
    const LEAF_TASK_WHERE = `(parent_task_id IS NOT NULL OR service <> 'business_solutions')`;
    const { rows: taskCountRows } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE status <> 'closed')::int AS open,
              COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
       FROM tasks WHERE ${LEAF_TASK_WHERE}`
    );
    const taskCounts = taskCountRows[0];

    res.json({ columns, statusCounts, industryCounts: industryRows, serviceCounts, taskCounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Execution (Phase 4) insights — the Project Manager's own dashboard, gated by phase4
// rather than the `dashboard` page key so it stays independent of the pipeline overview.
app.get('/execution/summary', requirePage('phase4'), async (req, res) => {
  try {
    const { rows: clientRows } = await db.query(`SELECT COUNT(*)::int AS count FROM clients WHERE stage='phase4'`);
    const clientCount = clientRows[0].count;

    // Leaf tasks only — direct consultation/investment tasks, and business_solutions
    // sub-tasks — the business_solutions parent row is a container, never itself worked.
    const LEAF_TASK_WHERE = `(parent_task_id IS NOT NULL OR service <> 'business_solutions')`;
    const { rows: taskCountRows } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE status <> 'closed')::int AS open,
              COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
              COUNT(*) FILTER (WHERE status <> 'closed' AND due_date < CURRENT_DATE)::int AS overdue
       FROM tasks WHERE ${LEAF_TASK_WHERE}`
    );
    const taskCounts = taskCountRows[0];

    const { rows: taskWorkload } = await db.query(
      `SELECT u.id AS user_id, u.name,
              COUNT(*) FILTER (WHERE t.status <> 'closed' AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE))::int AS open_count,
              COUNT(*) FILTER (WHERE t.status <> 'closed' AND t.due_date < CURRENT_DATE)::int AS overdue_count,
              COUNT(*) FILTER (WHERE t.status = 'closed')::int AS closed_count
       FROM tasks t
       JOIN users u ON u.id = t.assigned_to
       WHERE ${LEAF_TASK_WHERE}
       GROUP BY u.id, u.name
       ORDER BY overdue_count DESC, open_count DESC, u.name ASC`
    );

    res.json({ clientCount, taskCounts, taskWorkload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch execution summary' });
  }
});

// Flat leaf-task list (direct tasks + business_solutions sub-tasks) with client and
// assignee context joined in, for the Execution dashboard's task table.
app.get('/execution/tasks', requirePage('phase4'), async (req, res) => {
  try {
    const LEAF_TASK_WHERE = `(t.parent_task_id IS NOT NULL OR t.service <> 'business_solutions')`;
    const { rows } = await db.query(
      `SELECT t.id, t.title, t.status, t.due_date, t.service, t.parent_task_id,
              parent.title AS parent_title,
              t.assigned_to, u.name AS assignee_name,
              c.id AS client_id, c.contact_name, comp.name AS company_name
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN tasks parent ON parent.id = t.parent_task_id
       LEFT JOIN LATERAL (
         SELECT name FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
       ) comp ON true
       WHERE ${LEAF_TASK_WHERE}
       ORDER BY (t.status = 'closed') ASC, t.due_date ASC NULLS LAST, t.created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch execution tasks' });
  }
});

app.get('/clients', async (req, res) => {
  const { stage, status } = req.query;
  try {
    if (stage) {
      if (!(await roleHasPage(req.user.role_id, stage))) {
        return res.status(403).json({ error: 'Not permitted for this phase' });
      }
    } else if (!(await roleHasPage(req.user.role_id, 'system_admin'))) {
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
    const q = `SELECT c.*, COALESCE(counts.engagements_count,0) AS engagements_count, comp.name AS company_name,
               EXISTS (
                 SELECT 1 FROM tasks t WHERE t.client_id = c.id AND t.status <> 'closed'
                   AND t.due_date < CURRENT_DATE AND (t.parent_task_id IS NOT NULL OR t.service <> 'business_solutions')
               ) AS has_overdue_task,
               EXISTS (
                 SELECT 1 FROM tasks t WHERE t.client_id = c.id AND t.status <> 'closed'
                   AND t.due_date >= CURRENT_DATE AND t.due_date <= CURRENT_DATE + INTERVAL '2 days'
                   AND (t.parent_task_id IS NOT NULL OR t.service <> 'business_solutions')
               ) AS has_due_soon_task,
               (SELECT COUNT(*)::int FROM tasks t WHERE t.client_id = c.id
                  AND (t.parent_task_id IS NOT NULL OR t.service <> 'business_solutions')) AS total_task_count,
               (SELECT COUNT(*)::int FROM tasks t WHERE t.client_id = c.id AND t.status <> 'closed'
                  AND (t.parent_task_id IS NOT NULL OR t.service <> 'business_solutions')) AS open_task_count
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

    const tasksQ = `SELECT t.*, u.name AS assigned_to_name
                     FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
                     WHERE t.client_id=$1 ORDER BY t.parent_task_id NULLS FIRST, t.created_at ASC`;
    const { rows: tasks } = await db.query(tasksQ, [id]);
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length > 0) {
      const { rows: events } = await db.query(
        `SELECT e.*, u.name AS actor_name FROM task_events e LEFT JOIN users u ON u.id = e.actor_user_id
         WHERE e.task_id = ANY($1) ORDER BY e.created_at ASC`, [taskIds]
      );
      const eventsByTask = {};
      for (const ev of events) (eventsByTask[ev.task_id] ||= []).push(ev);
      for (const task of tasks) task.events = eventsByTask[task.id] || [];
    }

    res.json({ client, notes, engagements, companies, appointments, tasks });
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
  const fields = ['contact_name','email','phone','status','stage','service_consultation','service_investment','service_business_solutions','contract_price','payment_type'];
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
    if (req.clientStage === 'phase4' && req.body.status === 'Completed') {
      // Only leaf tasks are individually worked (direct consultation/investment tasks, and
      // business_solutions sub-tasks) — the business_solutions parent row is just a container.
      const { rows: openTasks } = await db.query(
        `SELECT id FROM tasks
         WHERE client_id=$1 AND status <> 'closed' AND (parent_task_id IS NOT NULL OR service <> 'business_solutions')`,
        [id]
      );
      if (openTasks.length > 0) {
        return res.status(400).json({ error: 'All tasks must be closed before marking this client Completed' });
      }
    }

    values.push(id);
    const q = `UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });

    if (req.body.stage === 'phase4') {
      const { rows: existingTasks } = await db.query('SELECT id FROM tasks WHERE client_id=$1', [id]);
      if (existingTasks.length === 0) {
        const client = rows[0];
        for (const [flag, { service, title }] of Object.entries(SERVICE_TITLES)) {
          if (client[flag]) {
            await db.query(
              'INSERT INTO tasks (client_id, service, title) VALUES ($1,$2,$3)',
              [id, service, title]
            );
          }
        }
      }
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/clients/:id', requirePage('system_admin'), requireClientPhase(resolveClientIdDirect), async (req, res) => {
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

// Investors (standalone, not tied to the client pipeline/phases)
const MOBILE_PATTERN = /^[1-9]\d{8}$/;

app.get('/investors', requirePage('investors'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM investors ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch investors' });
  }
});

app.get('/investors/:id', requirePage('investors'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM investors WHERE id=$1', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Investor not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch investor' });
  }
});

app.post('/investors', requirePage('investors'), async (req, res) => {
  const { name, mobile, email, investor_type, company_name, industries, notes } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  if (!mobile || !MOBILE_PATTERN.test(mobile)) {
    return res.status(400).json({ error: 'mobile must be 9 digits and not start with 0' });
  }
  try {
    const q = `INSERT INTO investors (name, mobile, email, investor_type, company_name, industries, notes, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    const { rows } = await db.query(q, [
      name.trim(), mobile, email || null, investor_type || 'Individual', company_name || null,
      Array.isArray(industries) ? industries : [], notes || null, req.user.sub
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add investor' });
  }
});

app.put('/investors/:id', requirePage('investors'), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['name', 'mobile', 'email', 'investor_type', 'company_name', 'industries', 'notes'];
  const sets = [];
  const values = [];
  let idx = 1;
  if (Object.prototype.hasOwnProperty.call(req.body, 'name') && !String(req.body.name).trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'mobile') && !MOBILE_PATTERN.test(req.body.mobile)) {
    return res.status(400).json({ error: 'mobile must be 9 digits and not start with 0' });
  }
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      sets.push(`${f} = $${idx}`);
      values.push(f === 'industries' ? (Array.isArray(req.body[f]) ? req.body[f] : []) : req.body[f]);
      idx++;
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const q = `UPDATE investors SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  try {
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Investor not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update investor' });
  }
});

app.delete('/investors/:id', requirePage('investors'), async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM investors WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Investor not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete investor' });
  }
});

// Companies
app.post('/clients/:id/companies', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const {
    name, region, city, country, commercial_registration_number, vat_number,
    industry, briefing, contact_person_name, additional_phone_number
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (req.clientStage === 'phase1' && !(briefing || '').trim()) {
    return res.status(400).json({ error: 'briefing required' });
  }
  try {
    const q = `INSERT INTO companies (
                 client_id, name, region, city, country, commercial_registration_number, vat_number,
                 industry, briefing, contact_person_name, additional_phone_number
               )
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`;
    const { rows } = await db.query(q, [
      clientId, name, region || null, city || null, country || null, commercial_registration_number || null, vat_number || null,
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
  if (req.clientStage === 'phase1' && Object.prototype.hasOwnProperty.call(req.body, 'briefing') && !(req.body.briefing || '').trim()) {
    return res.status(400).json({ error: 'briefing required' });
  }
  const fields = ['name','region','city','country','commercial_registration_number','vat_number','industry','briefing','contact_person_name','additional_phone_number'];
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
    const hoursCheck = await checkBusinessHours(scheduled_at);
    if (!hoursCheck.valid) return res.status(400).json({ error: hoursCheck.error });

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
    if (Object.prototype.hasOwnProperty.call(req.body, 'scheduled_at')) {
      const hoursCheck = await checkBusinessHours(req.body.scheduled_at);
      if (!hoursCheck.valid) return res.status(400).json({ error: hoursCheck.error });
    }
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

// Business hours are entered (and displayed) as Saudi Arabia wall-clock times. Saudi Arabia
// has no DST, so a fixed UTC+3 offset is safe. We deliberately do NOT use Date.prototype's
// local getters (getHours/getDate/etc.) here — those depend on the Node process's own
// timezone, which on the hosting platform defaults to UTC and does not match the browser's
// (Riyadh) timezone. That mismatch silently shifted every working-hours check by 3 hours in
// production, rejecting valid bookings. Shifting the instant by the fixed offset and reading
// its UTC parts gives the same wall-clock reading everywhere, regardless of server timezone.
const APP_TZ_OFFSET_MINUTES = 180; // Asia/Riyadh, UTC+3, no DST

function toAppLocalParts(date) {
  const shifted = new Date(date.getTime() + APP_TZ_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes()
  };
}

// Shared by the appointment endpoints below and the available-slots endpoint further down —
// same business_hours/calendar_closures lookup, but for a single instant instead of a list.
async function checkBusinessHours(scheduledAt) {
  const d = new Date(scheduledAt);
  if (d.getTime() <= Date.now()) {
    return { valid: false, error: 'Cannot book an appointment in the past' };
  }
  const { dayOfWeek, hours: h, minutes: min, year, month, day } = toAppLocalParts(d);
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const { rows: hoursRows } = await db.query(
    `SELECT * FROM business_hours WHERE user_id IS NULL AND day_of_week = $1`, [dayOfWeek]
  );
  const hours = hoursRows[0];
  if (!hours || !hours.is_open || !hours.start_time || !hours.end_time) {
    return { valid: false, error: 'Selected time is outside working hours' };
  }
  const timeLabel = `${hh}:${mm}`;
  if (timeLabel < hours.start_time.slice(0, 5) || timeLabel >= hours.end_time.slice(0, 5)) {
    return { valid: false, error: 'Selected time is outside working hours' };
  }

  const { rows: closureRows } = await db.query(
    `SELECT label FROM calendar_closures WHERE user_id IS NULL AND closure_date <= $1 AND COALESCE(end_date, closure_date) >= $1`, [dateStr]
  );
  if (closureRows.length > 0) {
    const label = closureRows[0].label;
    return { valid: false, error: label ? `This date is unavailable: ${label}` : 'This date is unavailable' };
  }

  return { valid: true };
}

// Calendar availability (migration 028) — company-wide business hours + holiday closures.
// user_id stays NULL everywhere below; the column exists so a future move to per-consultant
// calendars is a query change, not a schema migration.
app.get('/calendar/business-hours', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM business_hours WHERE user_id IS NULL ORDER BY day_of_week`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

app.put('/calendar/business-hours', requirePage('system_admin'), async (req, res) => {
  const { days } = req.body;
  if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: 'days array required' });
  try {
    for (const d of days) {
      await db.query(
        `INSERT INTO business_hours (user_id, day_of_week, is_open, start_time, end_time, updated_at)
         VALUES (NULL, $1, $2, $3, $4, now())
         ON CONFLICT (day_of_week) WHERE user_id IS NULL
         DO UPDATE SET is_open = $2, start_time = $3, end_time = $4, updated_at = now()`,
        [d.day_of_week, !!d.is_open, d.is_open ? (d.start_time || null) : null, d.is_open ? (d.end_time || null) : null]
      );
    }
    const { rows } = await db.query(`SELECT * FROM business_hours WHERE user_id IS NULL ORDER BY day_of_week`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update business hours' });
  }
});

app.get('/calendar/closures', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, u.name AS created_by_name FROM calendar_closures c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.user_id IS NULL ORDER BY c.closure_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calendar closures' });
  }
});

app.post('/calendar/closures', requirePage('system_admin'), async (req, res) => {
  const { date, end_date, label } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const effectiveEnd = end_date || date;
  if (effectiveEnd < date) return res.status(400).json({ error: 'end_date cannot be before date' });
  try {
    const { rows } = await db.query(
      `INSERT INTO calendar_closures (user_id, closure_date, end_date, label, created_by) VALUES (NULL, $1, $2, $3, $4) RETURNING *`,
      [date, effectiveEnd, label || null, req.user.sub]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add calendar closure' });
  }
});

app.delete('/calendar/closures/:id', requirePage('system_admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM calendar_closures WHERE id=$1 AND user_id IS NULL RETURNING id`,
      [Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Closure not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove calendar closure' });
  }
});

// Read-only, no page-key gate (just authenticated) — non-sensitive, and the future
// PM-facing consultant scheduling tool isn't a system_admin surface.
app.get('/calendar/available-slots', async (req, res) => {
  const { date, duration } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
  const slotMinutes = Number(duration) > 0 ? Number(duration) : 60;
  try {
    const nowParts = toAppLocalParts(new Date());
    const todayStr = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
    if (date < todayStr) return res.json({ date, slots: [] });
    const nowLabel = date === todayStr ? `${String(nowParts.hours).padStart(2, '0')}:${String(nowParts.minutes).padStart(2, '0')}` : null;

    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const { rows: hoursRows } = await db.query(
      `SELECT * FROM business_hours WHERE user_id IS NULL AND day_of_week = $1`, [dayOfWeek]
    );
    const hours = hoursRows[0];
    if (!hours || !hours.is_open || !hours.start_time || !hours.end_time) {
      return res.json({ date, slots: [] });
    }

    const { rows: closureRows } = await db.query(
      `SELECT 1 FROM calendar_closures WHERE user_id IS NULL AND closure_date <= $1 AND COALESCE(end_date, closure_date) >= $1`, [date]
    );
    if (closureRows.length > 0) return res.json({ date, slots: [] });

    const { rows: appts } = await db.query(
      `SELECT scheduled_at FROM appointments WHERE status = 'Scheduled' AND scheduled_at::date = $1::date`, [date]
    );
    const takenTimes = new Set(appts.map((a) => {
      const p = toAppLocalParts(new Date(a.scheduled_at));
      return `${String(p.hours).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}`;
    }));

    const slots = [];
    let [h, m] = hours.start_time.split(':').map(Number);
    const [endH, endM] = hours.end_time.split(':').map(Number);
    while (h < endH || (h === endH && m < endM)) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!takenTimes.has(label) && (!nowLabel || label > nowLabel)) slots.push(label);
      m += slotMinutes;
      while (m >= 60) { m -= 60; h += 1; }
    }
    res.json({ date, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute available slots' });
  }
});

// Drive link (a single Google Drive URL per client, editable by Client Relation regardless of the
// client's current stage — same permission shape the old document upload/delete endpoints used —
// visible to whoever can currently view the client, via the GET /clients/:id bundle).
app.put('/clients/:id/drive-link', requirePage('phase1'), async (req, res) => {
  const id = Number(req.params.id);
  const { drive_link } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE clients SET drive_link=$1 WHERE id=$2 RETURNING id, drive_link',
      [drive_link || null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update drive link' });
  }
});

// Tasks (Phase 4 — Execution). One task is auto-created per checked service when a client
// enters phase4 (see PUT /clients/:id). business_solutions is a parent container — its
// sub-tasks are added/removed here by whoever holds phase4 access (Project Manager),
// dynamically, with no fixed catalog. Each leaf task (a direct consultation/investment task,
// or a business_solutions sub-task) has exactly one assignee, who is the only one who can
// see/edit/submit it — enforced by an ownership check rather than a page permission, since an
// assignee may not hold phase4 access at all.
app.post('/clients/:id/tasks', requireClientPhase(resolveClientIdDirect), async (req, res) => {
  const clientId = Number(req.params.id);
  const { title, assigned_to, due_date } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
  if (assigned_to && !due_date) return res.status(400).json({ error: 'due_date required when assigning a sub-task' });
  try {
    const { rows: parentRows } = await db.query(
      `SELECT id FROM tasks WHERE client_id=$1 AND service='business_solutions' AND parent_task_id IS NULL`,
      [clientId]
    );
    if (!parentRows[0]) {
      return res.status(400).json({ error: 'This client has no Business Solutions task to attach sub-tasks to' });
    }
    const { rows } = await db.query(
      `INSERT INTO tasks (client_id, service, parent_task_id, title, assigned_to, due_date, status)
       VALUES ($1,'business_solutions',$2,$3,$4,$5,$6) RETURNING *`,
      [clientId, parentRows[0].id, title.trim(), assigned_to || null, due_date || null, assigned_to ? 'in_progress' : 'unassigned']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add sub-task' });
  }
});

app.put('/tasks/:id', requireClientPhase(resolveClientIdViaTask), async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['title', 'assigned_to', 'due_date'];
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'assigned_to')) {
      const { rows: taskRows } = await db.query('SELECT status, assigned_to FROM tasks WHERE id=$1', [id]);
      if (!taskRows[0]) return res.status(404).json({ error: 'Task not found' });
      if (req.body.assigned_to && taskRows[0].status === 'unassigned') {
        sets.push(`status = $${idx}`);
        values.push('in_progress');
        idx++;
      }
    }
    values.push(id);
    const q = `UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    const { rows } = await db.query(q, values);
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    if (Object.prototype.hasOwnProperty.call(req.body, 'assigned_to') && req.body.assigned_to) {
      await db.query(
        `INSERT INTO task_events (task_id, event_type, actor_user_id) VALUES ($1,'nominated',$2)`,
        [id, req.user.sub]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/tasks/:id', requireClientPhase(resolveClientIdViaTask), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows: taskRows } = await db.query('SELECT service, parent_task_id, status FROM tasks WHERE id=$1', [id]);
    if (!taskRows[0]) return res.status(404).json({ error: 'Task not found' });
    if (taskRows[0].parent_task_id === null) {
      return res.status(400).json({ error: 'Only Business Solutions sub-tasks can be removed' });
    }
    if (!['unassigned', 'in_progress'].includes(taskRows[0].status)) {
      return res.status(400).json({ error: 'Only sub-tasks that have not been submitted yet can be removed' });
    }
    await db.query('DELETE FROM tasks WHERE id=$1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove sub-task' });
  }
});

app.put('/tasks/:id/submit', async (req, res) => {
  const id = Number(req.params.id);
  const { deliverable_note } = req.body;
  if (!deliverable_note || !deliverable_note.trim()) {
    return res.status(400).json({ error: 'A deliverable note is required before submitting' });
  }
  try {
    const { rows: taskRows } = await db.query('SELECT assigned_to FROM tasks WHERE id=$1', [id]);
    if (!taskRows[0]) return res.status(404).json({ error: 'Task not found' });
    if (taskRows[0].assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Only the assigned person can submit this task' });
    }
    const { rows } = await db.query(
      `UPDATE tasks SET status='submitted', deliverable_note=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [deliverable_note.trim(), id]
    );
    await db.query(
      `INSERT INTO task_events (task_id, event_type, actor_user_id) VALUES ($1,'submitted',$2)`,
      [id, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

app.put('/tasks/:id/review', requireClientPhase(resolveClientIdViaTask), async (req, res) => {
  const id = Number(req.params.id);
  const { decision, comment } = req.body;
  if (!['approve', 'send_back'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve or send_back' });
  }
  if (decision === 'send_back' && (!comment || !comment.trim())) {
    return res.status(400).json({ error: 'A comment is required when sending a task back' });
  }
  try {
    const newStatus = decision === 'approve' ? 'closed' : 'sent_back';
    const { rows } = await db.query(
      `UPDATE tasks SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`, [newStatus, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    await db.query(
      `INSERT INTO task_events (task_id, event_type, actor_user_id, comment) VALUES ($1,$2,$3,$4)`,
      [id, decision === 'approve' ? 'closed' : 'sent_back', req.user.sub, comment ? comment.trim() : null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to review task' });
  }
});

// Cross-client — every task assigned to the caller, regardless of phase4 access. Powers the
// "My Tasks" page so any assignee can see and work their own tasks without needing phase4 access.
app.get('/my-tasks', requirePage('my_tasks'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, c.contact_name, c.phone, c.email, c.stage, comp.name AS company_name
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       LEFT JOIN LATERAL (
         SELECT name FROM companies WHERE companies.client_id = c.id ORDER BY created_at ASC LIMIT 1
       ) comp ON true
       WHERE t.assigned_to = $1
       ORDER BY t.status = 'sent_back' DESC, t.due_date NULLS LAST, t.created_at ASC`,
      [req.user.sub]
    );
    const taskIds = rows.map((t) => t.id);
    if (taskIds.length > 0) {
      const { rows: events } = await db.query(
        `SELECT e.*, u.name AS actor_name FROM task_events e LEFT JOIN users u ON u.id = e.actor_user_id
         WHERE e.task_id = ANY($1) ORDER BY e.created_at ASC`, [taskIds]
      );
      const eventsByTask = {};
      for (const ev of events) (eventsByTask[ev.task_id] ||= []).push(ev);
      for (const task of rows) task.events = eventsByTask[task.id] || [];
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Active users a Project Manager can assign a task to — no team/role restriction.
app.get('/task-assignable-users', requirePage('phase4'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name FROM users WHERE is_active = true ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignable users' });
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
  const fields = ['name', 'email', 'role_id', 'is_active'];
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'name') && !String(req.body.name).trim()) {
      return res.status(400).json({ error: 'name required' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      if (!String(req.body.email).trim()) return res.status(400).json({ error: 'email required' });
      const { rows: existing } = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2', [req.body.email, id]
      );
      if (existing[0]) return res.status(409).json({ error: 'Email already registered' });
    }
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
const ALL_PAGE_KEYS = ['dashboard', 'phase1', 'phase2', 'phase3', 'phase4', 'my_tasks', 'calendar', 'investors', 'system_admin'];

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

-- 001_seed.sql
-- Dev seed data for users, clients, notes, engagements, and engagement_events

BEGIN;

-- Users (adapted to existing users table shape)
INSERT INTO users (name, email) VALUES
  ('Maya Griffin', 'maya@example.local'),
  ('Jules Parker', 'jules@example.local')
ON CONFLICT DO NOTHING;

-- Clients
INSERT INTO clients (name, contact_name, email, phone, industry, status, briefing)
VALUES
  ('Aurora Data Labs','Maya Griffin','maya.griffin@auroradata.com','+1 (212) 555-0145','Data analytics','Prospect','Sample briefing for Aurora Data Labs'),
  ('Ridgefield Retail','Noah Sullivan','noah.sullivan@ridgefield.com','+1 (415) 555-0156','Retail','Active','Retail client briefing sample')
ON CONFLICT DO NOTHING;

-- Notes (attach to first client)
WITH c AS (SELECT id FROM clients WHERE name='Aurora Data Labs' LIMIT 1), u AS (SELECT id, name FROM users WHERE name='Maya Griffin' LIMIT 1)
INSERT INTO notes (client_id, author_id, author_name, text)
SELECT c.id, u.id, u.name, 'Seed note: initial contact logged.' FROM c, u;

-- Engagements
WITH c AS (SELECT id FROM clients WHERE name='Aurora Data Labs' LIMIT 1), u AS (SELECT id FROM users WHERE name='Maya Griffin' LIMIT 1)
INSERT INTO engagements (client_id, title, description, status, current_assigned_user, created_by)
SELECT c.id, 'Onboarding', 'Initial onboarding engagement', 'in_progress', u.id, u.id FROM c, u;

-- Engagement events (handoff)
WITH e AS (SELECT id FROM engagements WHERE title='Onboarding' LIMIT 1), u AS (SELECT id FROM users WHERE name='Maya Griffin' LIMIT 1)
INSERT INTO engagement_events (engagement_id, from_user_id, to_user_id, event_type, note)
SELECT e.id, NULL, u.id, 'assigned', 'Seed assignment to Maya' FROM e, u;

COMMIT;

-- 016_add_phase3_stage_and_finalizing_status_up.sql
-- Adds phase3 (Finance & Legal) as a client_stage, and Finalizing as the client_status
-- set when Sales graduates a client into Finance & Legal (mirrors phase1 -> phase2's Active).

BEGIN;

ALTER TYPE client_stage ADD VALUE IF NOT EXISTS 'phase3';
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'Finalizing';

COMMIT;

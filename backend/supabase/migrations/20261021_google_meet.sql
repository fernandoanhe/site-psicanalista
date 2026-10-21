-- =============================================================
-- MIGRATION: evento no Google Agenda + link do Meet por sessão
-- Rodar uma vez no SQL Editor do Supabase, ANTES de configurar
-- as variáveis GOOGLE_* na Vercel.
-- =============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(200);

-- =============================================================
-- MIGRATION: integridade dos agendamentos
-- Rodar uma vez no SQL Editor do Supabase.
-- =============================================================

-- 1. Permite vários períodos de atendimento no mesmo dia da semana
--    (ex.: manhã e tarde), como o painel admin já faz.
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_day_of_week_key;

-- 2. Impede duas sessões pagas no mesmo horário.
--    Se este comando falhar, já existem duplicatas — liste-as com:
--    SELECT session_date, session_time, count(*) FROM bookings
--    WHERE payment_status = 'paid' GROUP BY 1, 2 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_paid_slot
  ON bookings (session_date, session_time)
  WHERE payment_status = 'paid';

-- 3. Acelera a consulta de horários reservados (pagos + pendentes recentes)
CREATE INDEX IF NOT EXISTS idx_bookings_slot_status
  ON bookings (session_date, session_time, payment_status, created_at);

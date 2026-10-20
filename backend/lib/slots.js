const supabase = require('./supabase');

// Tempo que um agendamento pendente segura o horário (igual à expiração do PIX)
const PENDING_HOLD_MINUTES = 30;
// Antecedência mínima para agendar um horário no mesmo dia
const MIN_NOTICE_MINUTES = 60;

// ------------------------------------------------------------------
// Helper: generate time slots between start and end with given duration
// start, end: 'HH:MM' strings
// duration: integer minutes
// Returns array of 'HH:MM' strings
// ------------------------------------------------------------------
function generateSlots(start, end, duration) {
  const slots = [];

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  let current = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (current + duration <= endMinutes) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += duration;
  }

  return slots;
}

// ------------------------------------------------------------------
// Helper: current date/time in Sao Paulo
// Returns { date: 'YYYY-MM-DD', minutes: minutes since midnight }
// ------------------------------------------------------------------
function nowSaoPaulo() {
  // 'sv-SE' locale produces 'YYYY-MM-DD HH:MM:SS'
  const [date, time] = new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    .split(' ');
  const [h, m] = time.split(':').map(Number);
  return { date, minutes: h * 60 + m };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ------------------------------------------------------------------
// getFreeSlots(startDate, endDate)
// Dates are 'YYYY-MM-DD' (inclusive). Returns [{ date, slots: ['HH:MM'] }]
// considering weekly availability (multiple periods per day), blocked
// dates/slots, paid bookings and pending bookings still within the hold.
// ------------------------------------------------------------------
async function getFreeSlots(startDate, endDate) {
  const holdSince = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000).toISOString();

  const [availResult, blockedDatesResult, blockedSlotsResult, bookingsResult] =
    await Promise.all([
      supabase
        .from('availability')
        .select('*')
        .eq('is_active', true),
      supabase
        .from('blocked_dates')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('blocked_slots')
        .select('date, time')
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('bookings')
        .select('session_date, session_time')
        .or(`payment_status.eq.paid,and(payment_status.eq.pending,created_at.gte.${holdSince})`)
        .gte('session_date', startDate)
        .lte('session_date', endDate),
    ]);

  if (availResult.error) throw availResult.error;
  if (blockedDatesResult.error) throw blockedDatesResult.error;
  if (blockedSlotsResult.error) throw blockedSlotsResult.error;
  if (bookingsResult.error) throw bookingsResult.error;

  // A day can have several periods (e.g. morning and afternoon)
  const periodsByDay = {};
  for (const a of availResult.data) {
    (periodsByDay[a.day_of_week] ||= []).push(a);
  }

  const blockedDatesSet = new Set(
    blockedDatesResult.data.map((r) => r.date.slice(0, 10))
  );

  const takenSet = new Set([
    ...blockedSlotsResult.data.map((r) => `${r.date.slice(0, 10)}_${r.time.slice(0, 5)}`),
    ...bookingsResult.data.map((r) => `${r.session_date.slice(0, 10)}_${r.session_time.slice(0, 5)}`),
  ]);

  const now = nowSaoPaulo();
  const result = [];

  // Iterate day by day using UTC noon to avoid timezone shifts
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const last = new Date(`${endDate}T12:00:00Z`);

  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateStr = cursor.toISOString().slice(0, 10);

    if (dateStr < now.date) continue;
    if (blockedDatesSet.has(dateStr)) continue;

    // day_of_week: 0=Sun ... 6=Sat
    const periods = periodsByDay[cursor.getUTCDay()];
    if (!periods) continue;

    const rawSlots = new Set();
    for (const p of periods) {
      generateSlots(p.start_time.slice(0, 5), p.end_time.slice(0, 5), p.slot_duration)
        .forEach((t) => rawSlots.add(t));
    }

    const freeSlots = [...rawSlots].sort().filter((t) => {
      if (takenSet.has(`${dateStr}_${t}`)) return false;
      if (dateStr === now.date && toMinutes(t) < now.minutes + MIN_NOTICE_MINUTES) return false;
      return true;
    });

    if (freeSlots.length > 0) {
      result.push({ date: dateStr, slots: freeSlots });
    }
  }

  return result;
}

module.exports = { getFreeSlots, nowSaoPaulo, PENDING_HOLD_MINUTES };

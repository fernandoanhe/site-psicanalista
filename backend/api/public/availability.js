const express = require('express');
const supabase = require('../../lib/supabase');

const router = express.Router();

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
// Helper: get today's date string 'YYYY-MM-DD' in Sao Paulo time
// ------------------------------------------------------------------
function todaySaoPaulo() {
  return new Date()
    .toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  // 'sv-SE' locale produces ISO YYYY-MM-DD format
}

// ------------------------------------------------------------------
// GET /api/public/availability?year=2026&month=04
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    let { year, month } = req.query;

    if (!year || !month) {
      const now = new Date();
      year = year || String(now.getFullYear());
      month = month || String(now.getMonth() + 1).padStart(2, '0');
    }

    // Normalise month to 2 digits
    month = String(month).padStart(2, '0');
    year = String(year);

    const monthStart = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    // Fetch all needed data in parallel
    const [availResult, blockedDatesResult, blockedSlotsResult, bookingsResult] =
      await Promise.all([
        supabase
          .from('availability')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('blocked_dates')
          .select('date')
          .gte('date', monthStart)
          .lte('date', monthEnd),
        supabase
          .from('blocked_slots')
          .select('date, time')
          .gte('date', monthStart)
          .lte('date', monthEnd),
        supabase
          .from('bookings')
          .select('session_date, session_time')
          .eq('payment_status', 'paid')
          .gte('session_date', monthStart)
          .lte('session_date', monthEnd),
      ]);

    if (availResult.error) throw availResult.error;
    if (blockedDatesResult.error) throw blockedDatesResult.error;
    if (blockedSlotsResult.error) throw blockedSlotsResult.error;
    if (bookingsResult.error) throw bookingsResult.error;

    // Build lookup maps for O(1) access
    const availByDay = {};
    for (const a of availResult.data) {
      availByDay[a.day_of_week] = a;
    }

    const blockedDatesSet = new Set(
      blockedDatesResult.data.map((r) => r.date.slice(0, 10))
    );

    const blockedSlotsSet = new Set(
      blockedSlotsResult.data.map((r) => `${r.date.slice(0, 10)}_${r.time.slice(0, 5)}`)
    );

    const bookedSlotsSet = new Set(
      bookingsResult.data.map(
        (r) => `${r.session_date.slice(0, 10)}_${r.session_time.slice(0, 5)}`
      )
    );

    const today = todaySaoPaulo();
    const result = [];

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${month}-${String(d).padStart(2, '0')}`;

      // Skip past dates
      if (dateStr < today) continue;

      // Skip if entire date is blocked
      if (blockedDatesSet.has(dateStr)) continue;

      // day_of_week: 0=Sun ... 6=Sat
      const dow = new Date(`${dateStr}T12:00:00`).getDay();
      const avail = availByDay[dow];

      if (!avail) continue; // no availability for this weekday

      // Generate raw slots
      const rawSlots = generateSlots(
        avail.start_time.slice(0, 5),
        avail.end_time.slice(0, 5),
        avail.slot_duration
      );

      // Filter out blocked and booked slots
      const freeSlots = rawSlots.filter((t) => {
        const key = `${dateStr}_${t}`;
        return !blockedSlotsSet.has(key) && !bookedSlotsSet.has(key);
      });

      if (freeSlots.length > 0) {
        result.push({ date: dateStr, slots: freeSlots });
      }
    }

    return res.json(result);
  } catch (err) {
    console.error('[GET /public/availability]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
  }
});

module.exports = router;

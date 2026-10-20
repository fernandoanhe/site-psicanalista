const express = require('express');
const supabase = require('../lib/supabase');
const { sendReminderToPatient, sendReminderToAdmin } = require('../lib/email');
const { nowSaoPaulo } = require('../lib/slots');

// Sessions starting within this many minutes get their reminder
const REMINDER_WINDOW_MINUTES = 35;

const router = express.Router();

// ------------------------------------------------------------------
// Core reminder logic (shared between HTTP trigger and cron)
// ------------------------------------------------------------------
async function processReminders() {
  const now = nowSaoPaulo();
  const windowStart = now.minutes;
  const windowEnd = now.minutes + REMINDER_WINDOW_MINUTES;

  function minsToTime(mins) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  // Any paid session starting within the next REMINDER_WINDOW_MINUTES that
  // hasn't been reminded yet. Working with a window (instead of an exact
  // minute) makes this safe for any cron frequency up to the window size.
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('reminder_sent', false);

  if (windowEnd < 1440) {
    query = query
      .eq('session_date', now.date)
      .gte('session_time', minsToTime(windowStart))
      .lte('session_time', minsToTime(windowEnd));
  } else {
    // Window crosses midnight: today until 23:59 or tomorrow from 00:00
    const tomorrow = new Date(`${now.date}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    query = query.or(
      `and(session_date.eq.${now.date},session_time.gte.${minsToTime(windowStart)}),` +
      `and(session_date.eq.${tomorrowStr},session_time.lte.${minsToTime(windowEnd - 1440)})`
    );
  }

  console.log(`[REMINDERS] ${now.date} window: ${minsToTime(windowStart)} + ${REMINDER_WINDOW_MINUTES}min`);

  const { data: bookings, error } = await query;

  if (error) {
    console.error('[REMINDERS] Query error:', error.message);
    return { processed: 0, error: error.message };
  }

  if (!bookings || bookings.length === 0) {
    console.log('[REMINDERS] No bookings to remind');
    return { processed: 0 };
  }

  let processed = 0;

  for (const booking of bookings) {
    try {
      // Send reminders
      await sendReminderToPatient(booking);
      await sendReminderToAdmin(booking);

      // Mark as reminder sent
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          reminder_sent: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error(
          `[REMINDERS] Error marking booking ${booking.id} as reminded:`,
          updateError.message
        );
      } else {
        console.log(`[REMINDERS] Reminder sent for booking ${booking.id} (${booking.patient_name})`);
        processed++;
      }
    } catch (emailErr) {
      console.error(
        `[REMINDERS] Error sending reminder for booking ${booking.id}:`,
        emailErr.message
      );
    }
  }

  return { processed };
}

// ------------------------------------------------------------------
// Remove unpaid bookings older than 30 days (see privacy policy)
// ------------------------------------------------------------------
async function purgeUnpaidBookings() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from('bookings')
    .delete({ count: 'exact' })
    .in('payment_status', ['pending', 'failed'])
    .lt('created_at', cutoff);

  if (error) {
    console.error('[REMINDERS] Purge error:', error.message);
    return 0;
  }
  return count || 0;
}

// ------------------------------------------------------------------
// HTTP trigger: GET /api/cron/reminders
// (for external cron services like Vercel Cron or EasyCron)
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; external
  // services can use the same header or ?secret=<CRON_SECRET>
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.authorization || '').replace(/^Bearer /, '') || req.query.secret;
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const result = await processReminders();
    result.purged = await purgeUnpaidBookings();
    return res.json(result);
  } catch (err) {
    console.error('[GET /cron/reminders]', err.message);
    return res.status(500).json({ error: 'Erro ao processar lembretes' });
  }
});

module.exports = router;
module.exports.processReminders = processReminders;

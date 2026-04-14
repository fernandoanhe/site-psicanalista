const express = require('express');
const cron = require('node-cron');
const supabase = require('../lib/supabase');
const { sendReminderToPatient, sendReminderToAdmin } = require('../lib/email');

const router = express.Router();

// ------------------------------------------------------------------
// Core reminder logic (shared between HTTP trigger and cron)
// ------------------------------------------------------------------
async function processReminders() {
  // Get current time in America/Sao_Paulo
  const nowSP = new Date().toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  });
  // 'sv-SE' gives 'YYYY-MM-DD HH:MM:SS'
  const [datePart, timePart] = nowSP.split(' ');
  const [h, m] = timePart.split(':').map(Number);

  // Target = now + 30 minutes
  const targetMinutes = h * 60 + m + 30;
  const targetH = Math.floor(targetMinutes / 60) % 24;
  const targetM = targetMinutes % 60;

  // Window: target ± 2 minutes
  const windowStart = targetMinutes - 2;
  const windowEnd = targetMinutes + 2;

  // Convert window boundaries to HH:MM strings
  function minsToTime(mins) {
    const hh = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
    const mm = ((mins % 60) + 60) % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  const windowStartTime = minsToTime(windowStart);
  const windowEndTime = minsToTime(windowEnd);

  console.log(
    `[REMINDERS] Date: ${datePart}, target: ${String(targetH).padStart(2,'0')}:${String(targetM).padStart(2,'0')}, window: ${windowStartTime}–${windowEndTime}`
  );

  // Query bookings that need reminders
  // Note: time comparison works correctly as HH:MM strings in Postgres
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('reminder_sent', false)
    .eq('session_date', datePart)
    .gte('session_time', windowStartTime)
    .lte('session_time', windowEndTime);

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
// node-cron: run every minute
// ------------------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const result = await processReminders();
    if (result.processed > 0) {
      console.log(`[CRON] Reminders processed: ${result.processed}`);
    }
  } catch (err) {
    console.error('[CRON] Unexpected error:', err.message);
  }
});

// ------------------------------------------------------------------
// HTTP trigger: GET /api/cron/reminders
// (for external cron services like Vercel Cron or EasyCron)
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await processReminders();
    return res.json(result);
  } catch (err) {
    console.error('[GET /cron/reminders]', err.message);
    return res.status(500).json({ error: 'Erro ao processar lembretes' });
  }
});

module.exports = router;

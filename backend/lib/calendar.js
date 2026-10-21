// ------------------------------------------------------------------
// Google Calendar: one event with its own Google Meet link per paid session.
// Uses an OAuth refresh token from the admin's Google account
// (generated once with scripts/google-auth.js). Without the GOOGLE_* env
// vars the integration is disabled and bookings work without a Meet link.
// ------------------------------------------------------------------

const SESSION_MINUTES = 50;
const TIME_ZONE = 'America/Sao_Paulo';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const API = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;

function isCalendarEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth: ${data.error || res.status} ${data.error_description || ''}`.trim());
  return data.access_token;
}

// 'YYYY-MM-DD' + 'HH:MM[:SS]' + minutes → local 'YYYY-MM-DDTHH:MM:00'
function localDateTime(date, time, plusMinutes = 0) {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, m + plusMinutes));
  return t.toISOString().slice(0, 16) + ':00';
}

/**
 * Create the calendar event (with Meet link) and invite the patient.
 * Google sends the invitation e-mail to the patient (sendUpdates=all).
 * @returns {{ eventId: string, meetLink: string|null }}
 */
async function createSessionEvent(booking) {
  const token = await getAccessToken();
  const date = String(booking.session_date).slice(0, 10);
  const time = String(booking.session_time).slice(0, 5);

  const res = await fetch(`${API}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `Sessão de psicanálise — ${booking.patient_name}`,
      description: 'Sessão online. Entre pelo link do Google Meet no horário marcado.',
      start: { dateTime: localDateTime(date, time), timeZone: TIME_ZONE },
      end: { dateTime: localDateTime(date, time, SESSION_MINUTES), timeZone: TIME_ZONE },
      attendees: [{ email: booking.patient_email, displayName: booking.patient_name }],
      guestsCanSeeOtherGuests: false,
      guestsCanInviteOthers: false,
      reminders: { useDefault: true },
      conferenceData: {
        // Same booking → same request id, so a retried webhook does not create a second Meet
        createRequest: { requestId: `booking-${booking.id}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar: ${data.error?.message || res.status}`);

  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null;

  return { eventId: data.id, meetLink };
}

/**
 * Cancel the event (e.g. after a refund). Google notifies the patient.
 */
async function cancelSessionEvent(eventId) {
  const token = await getAccessToken();
  const res = await fetch(`${API}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  // 410 = already deleted
  if (!res.ok && res.status !== 410) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Google Calendar: ${data.error?.message || res.status}`);
  }
}

module.exports = { isCalendarEnabled, createSessionEvent, cancelSessionEvent };

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ------------------------------------------------------------------
// CORS configuration
// ------------------------------------------------------------------
// CORS_ORIGINS: optional comma-separated extra origins (e.g. www + custom domain)
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.BACKEND_URL,
  process.env.ADMIN_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map((url) => (url || '').trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Local development origins
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
}

// Requests without Origin (webhooks, cron, curl) are not affected by CORS.
// If no URL is configured, fall back to allowing every origin.
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  })
);

// ------------------------------------------------------------------
// Rate limiting (per IP, in memory per instance)
// ------------------------------------------------------------------
app.set('trust proxy', 1);

const tooMany = (message) => ({
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
});

app.use(
  '/api/admin/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, ...tooMany('Muitas tentativas de login. Tente novamente em alguns minutos.') })
);
app.use(
  '/api/public/book',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, ...tooMany('Muitas tentativas de agendamento. Tente novamente em alguns minutos.') })
);

// ------------------------------------------------------------------
// Body parsing
// ------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------
app.use('/api/admin/auth',        require('./api/admin/auth'));
app.use('/api/admin/content',     require('./api/admin/content'));
app.use('/api/admin/schedule',    require('./api/admin/schedule'));
app.use('/api/admin/bookings',    require('./api/admin/bookings'));
app.use('/api/public/content',    require('./api/public/content'));
app.use('/api/public/availability', require('./api/public/availability'));
app.use('/api/public/book',       require('./api/public/book'));
app.use('/api/public/webhook',    require('./api/public/webhook'));
app.use('/api/cron/reminders',    require('./cron/reminders'));

// ------------------------------------------------------------------
// Health check
// ------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ------------------------------------------------------------------
// Global error handler
// ------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Erro interno do servidor',
  });
});

// ------------------------------------------------------------------
// Start server (skipped when loaded by Vercel)
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Local only: on Vercel the reminders are triggered via GET /api/cron/reminders
  const cron = require('node-cron');
  const { processReminders } = require('./cron/reminders');
  cron.schedule('*/5 * * * *', () => {
    processReminders().catch((err) => console.error('[CRON] Unexpected error:', err.message));
  });
}

module.exports = app;

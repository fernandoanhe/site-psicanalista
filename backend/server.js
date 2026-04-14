require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ------------------------------------------------------------------
// CORS configuration
// ------------------------------------------------------------------
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.BACKEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any localhost / 127.0.0.1 origin during development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
  })
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
}

module.exports = app;

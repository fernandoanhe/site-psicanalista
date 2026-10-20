const express = require('express');
const { getFreeSlots } = require('../../lib/slots');

const router = express.Router();

// ------------------------------------------------------------------
// GET /api/public/availability?year=2026&month=04
// Returns [{ date: 'YYYY-MM-DD', slots: ['HH:MM', ...] }]
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    let { year, month } = req.query;

    if (!year || !month) {
      const now = new Date();
      year = year || String(now.getFullYear());
      month = month || String(now.getMonth() + 1);
    }

    if (!/^\d{4}$/.test(String(year)) || !/^\d{1,2}$/.test(String(month)) ||
        Number(month) < 1 || Number(month) > 12) {
      return res.status(400).json({ error: 'Parâmetros year/month inválidos' });
    }

    // Normalise month to 2 digits
    month = String(month).padStart(2, '0');
    year = String(year);

    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const monthStart = `${year}-${month}-01`;
    const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const result = await getFreeSlots(monthStart, monthEnd);

    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (err) {
    console.error('[GET /public/availability]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
  }
});

module.exports = router;

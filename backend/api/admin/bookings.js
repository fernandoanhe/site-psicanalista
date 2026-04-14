const express = require('express');
const supabase = require('../../lib/supabase');
const authMiddleware = require('../../lib/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ------------------------------------------------------------------
// GET /api/admin/bookings
// Optional query params: status, date (YYYY-MM)
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;

    let query = supabase
      .from('bookings')
      .select('*')
      .order('session_date', { ascending: false })
      .order('session_time', { ascending: false });

    if (status && status !== 'todos') {
      query = query.eq('payment_status', status);
    }

    if (date) {
      // date format: YYYY-MM
      const [year, month] = date.split('-');
      if (year && month) {
        const start = `${year}-${month}-01`;
        // Last day of the month
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('session_date', start).lte('session_date', end);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /admin/bookings]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// ------------------------------------------------------------------
// GET /api/admin/bookings/:id
// Single booking details
// ------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[GET /admin/bookings/:id]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar agendamento' });
  }
});

// ------------------------------------------------------------------
// PUT /api/admin/bookings/:id/status
// Manually update payment_status
// ------------------------------------------------------------------
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    const allowedStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!payment_status || !allowedStatuses.includes(payment_status)) {
      return res.status(400).json({
        error: `payment_status deve ser um de: ${allowedStatuses.join(', ')}`,
      });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Agendamento não encontrado' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /admin/bookings/:id/status]', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

module.exports = router;

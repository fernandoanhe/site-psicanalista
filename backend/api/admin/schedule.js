const express = require('express');
const supabase = require('../../lib/supabase');
const authMiddleware = require('../../lib/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ------------------------------------------------------------------
// GET /api/admin/schedule
// Return availability, blocked_dates and blocked_slots
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [availResult, blockedDatesResult, blockedSlotsResult] =
      await Promise.all([
        supabase
          .from('availability')
          .select('*')
          .order('day_of_week', { ascending: true }),
        supabase
          .from('blocked_dates')
          .select('*')
          .order('date', { ascending: true }),
        supabase
          .from('blocked_slots')
          .select('*')
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
      ]);

    if (availResult.error) throw availResult.error;
    if (blockedDatesResult.error) throw blockedDatesResult.error;
    if (blockedSlotsResult.error) throw blockedSlotsResult.error;

    return res.json({
      availability: availResult.data,
      blocked_dates: blockedDatesResult.data,
      blocked_slots: blockedSlotsResult.data,
    });
  } catch (err) {
    console.error('[GET /schedule]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar agenda' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/schedule/availability
// Upsert an availability record by day_of_week
// ------------------------------------------------------------------
router.post('/availability', async (req, res) => {
  try {
    const { day_of_week, start_time, end_time, slot_duration, is_active } =
      req.body;

    if (day_of_week === undefined || day_of_week === null) {
      return res.status(400).json({ error: 'day_of_week é obrigatório' });
    }
    if (!start_time || !end_time) {
      return res
        .status(400)
        .json({ error: 'start_time e end_time são obrigatórios' });
    }

    const record = {
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      slot_duration: slot_duration ? Number(slot_duration) : 60,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('availability')
      .upsert(record, { onConflict: 'day_of_week' })
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[POST /schedule/availability]', err.message);
    return res.status(500).json({ error: 'Erro ao salvar disponibilidade' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/admin/schedule/availability/:id
// ------------------------------------------------------------------
router.delete('/availability/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('availability')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /schedule/availability/:id]', err.message);
    return res.status(500).json({ error: 'Erro ao excluir disponibilidade' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/schedule/block-date
// ------------------------------------------------------------------
router.post('/block-date', async (req, res) => {
  try {
    const { date, reason } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date é obrigatório' });
    }

    const { data, error } = await supabase
      .from('blocked_dates')
      .insert({ date, reason: reason || null })
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Data já está bloqueada' });
      }
      throw error;
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /schedule/block-date]', err.message);
    return res.status(500).json({ error: 'Erro ao bloquear data' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/admin/schedule/block-date/:id
// ------------------------------------------------------------------
router.delete('/block-date/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /schedule/block-date/:id]', err.message);
    return res.status(500).json({ error: 'Erro ao desbloquear data' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/schedule/block-slot
// ------------------------------------------------------------------
router.post('/block-slot', async (req, res) => {
  try {
    const { date, time, reason } = req.body;

    if (!date || !time) {
      return res.status(400).json({ error: 'date e time são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({ date, time, reason: reason || null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Horário já está bloqueado nesta data' });
      }
      throw error;
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /schedule/block-slot]', err.message);
    return res.status(500).json({ error: 'Erro ao bloquear horário' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/admin/schedule/block-slot/:id
// ------------------------------------------------------------------
router.delete('/block-slot/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /schedule/block-slot/:id]', err.message);
    return res.status(500).json({ error: 'Erro ao desbloquear horário' });
  }
});

module.exports = router;

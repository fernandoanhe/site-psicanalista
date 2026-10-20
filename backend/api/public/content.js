const express = require('express');
const supabase = require('../../lib/supabase');

const router = express.Router();

// GET /api/public/content — returns all site_content as { key: value } map (no auth required)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('key, value');

    if (error) throw error;

    const content = {};
    for (const item of data) {
      content[item.key] = item.value;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Access-Control-Allow-Origin', '*');
    return res.json(content);
  } catch (err) {
    console.error('[GET /public/content]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar conteúdo' });
  }
});

module.exports = router;

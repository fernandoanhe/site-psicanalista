const express = require('express');
const multer = require('multer');
const supabase = require('../../lib/supabase');
const authMiddleware = require('../../lib/auth');

const router = express.Router();

// Multer: in-memory storage, images only, max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'), false);
    }
  },
});

// All routes below require authentication
router.use(authMiddleware);

// ------------------------------------------------------------------
// GET /api/admin/content
// Return all site_content records ordered by section
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .order('section', { ascending: true })
      .order('key', { ascending: true });

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /content]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar conteúdo' });
  }
});

// ------------------------------------------------------------------
// GET /api/admin/content/:key
// Return a single content item by key
// ------------------------------------------------------------------
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Conteúdo não encontrado' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[GET /content/:key]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar conteúdo' });
  }
});

// ------------------------------------------------------------------
// PUT /api/admin/content/:key
// Update value and updated_at for a content item
// ------------------------------------------------------------------
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Campo "value" é obrigatório' });
    }

    const { data, error } = await supabase
      .from('site_content')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Conteúdo não encontrado' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /content/:key]', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar conteúdo' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/content/upload
// Upload image to Supabase Storage bucket 'site-images'
// ------------------------------------------------------------------
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `uploads/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(path);

    return res.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    console.error('[POST /content/upload]', err.message);
    return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
});

module.exports = router;

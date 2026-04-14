const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../../lib/supabase');
const authMiddleware = require('../../lib/auth');

const router = express.Router();

// ------------------------------------------------------------------
// POST /api/admin/auth/login
// ------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    // Find admin by email
    const { data: admin, error } = await supabase
      .from('admin_user')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Generate JWT (24h)
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ token, email: admin.email });
  } catch (err) {
    console.error('[POST /login]', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/auth/logout
// ------------------------------------------------------------------
// Token invalidation is handled client-side (just remove from localStorage)
router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

// ------------------------------------------------------------------
// GET /api/admin/auth/me
// ------------------------------------------------------------------
router.get('/me', authMiddleware, (req, res) => {
  return res.json({ adminId: req.admin.adminId, email: req.admin.email });
});

module.exports = router;

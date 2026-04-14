import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FDF5EE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Georgia, "Times New Roman", serif',
    padding: '24px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(44,26,14,0.10)',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  title: {
    fontSize: '28px',
    color: '#2C1A0E',
    fontWeight: 'normal',
    margin: '0 0 6px',
    letterSpacing: '1px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8B6B4A',
    margin: 0,
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#8B6B4A',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '15px',
    color: '#2C1A0E',
    backgroundColor: '#FEFBF8',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Georgia, serif',
    transition: 'border-color 0.15s',
  },
  inputFocus: {
    borderColor: '#C25E00',
  },
  btn: {
    width: '100%',
    backgroundColor: '#C25E00',
    color: '#FFFFFF',
    border: 'none',
    padding: '13px',
    borderRadius: '4px',
    fontSize: '15px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    marginTop: '8px',
    fontFamily: 'Georgia, serif',
    transition: 'background-color 0.15s',
  },
  btnHover: {
    backgroundColor: '#A34D00',
  },
  btnDisabled: {
    backgroundColor: '#D4956A',
    cursor: 'not-allowed',
  },
  error: {
    backgroundColor: '#FFF0EE',
    border: '1px solid #F5C6C0',
    borderRadius: '4px',
    padding: '12px 14px',
    color: '#C0392B',
    fontSize: '14px',
    marginBottom: '20px',
  },
  divider: {
    height: '1px',
    backgroundColor: '#F0E4D4',
    margin: '28px 0',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      localStorage.setItem('adminToken', data.token);
      navigate('/admin');
    } catch (err) {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const btnStyle = {
    ...styles.btn,
    ...(loading ? styles.btnDisabled : {}),
    ...(btnHover && !loading ? styles.btnHover : {}),
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>[NOME]</h1>
          <p style={styles.subtitle}>Área administrativa</p>
        </div>

        <div style={styles.divider} />

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                ...styles.input,
                ...(focusedField === 'email' ? styles.inputFocus : {}),
              }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              required
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                ...styles.input,
                ...(focusedField === 'password' ? styles.inputFocus : {}),
              }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            style={btnStyle}
            disabled={loading}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

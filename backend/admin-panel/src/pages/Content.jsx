import { useState, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };
}

const SECTION_LABELS = {
  hero:   'Hero',
  sobre:  'Sobre Mim',
  cta:    'Agendamento / CTA',
  rodape: 'Rodapé',
  config: 'Configurações',
};

const styles = {
  page: { fontFamily: 'Georgia, serif', color: '#2C1A0E' },
  pageTitle: { fontSize: '26px', fontWeight: 'normal', marginBottom: '8px' },
  pageSub: { color: '#8B6B4A', fontSize: '14px', marginBottom: '36px' },
  section: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    marginBottom: '28px',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '16px 24px',
    backgroundColor: '#F7EDE0',
    borderBottom: '1px solid #E8D5C0',
    fontSize: '13px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#8B6B4A',
  },
  itemRow: {
    padding: '20px 24px',
    borderBottom: '1px solid #F0E4D4',
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  labelCol: { width: '200px', minWidth: '160px', flexShrink: 0, paddingTop: '6px' },
  label: { fontSize: '13px', color: '#2C1A0E', display: 'block', marginBottom: '4px' },
  labelKey: { fontSize: '11px', color: '#8B6B4A', fontFamily: 'monospace' },
  inputCol: { flex: 1, minWidth: '200px' },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    color: '#2C1A0E',
    backgroundColor: '#FEFBF8',
    boxSizing: 'border-box',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    color: '#2C1A0E',
    backgroundColor: '#FEFBF8',
    boxSizing: 'border-box',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
  },
  actionRow: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' },
  btn: {
    backgroundColor: '#C25E00',
    color: '#FFF',
    border: 'none',
    padding: '8px 18px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    color: '#C25E00',
    border: '1px solid #C25E00',
    padding: '7px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
  },
  successMsg: { color: '#2E7D32', fontSize: '13px' },
  errorMsg: { color: '#C0392B', fontSize: '13px' },
  imagePreview: {
    width: '100px',
    height: '70px',
    objectFit: 'cover',
    borderRadius: '4px',
    border: '1px solid #E8D5C0',
    marginBottom: '8px',
  },
  loading: { padding: '40px', textAlign: 'center', color: '#8B6B4A' },
};

function ContentItem({ item, onSaved }) {
  const [value, setValue] = useState(item.value || '');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }

  function showFeedback(type, msg) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', uploadFile);
      const res = await fetch(`${BACKEND}/api/admin/content/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no upload');
      setValue(data.url);
      setUploadFile(null);
      showFeedback('success', 'Imagem enviada!');
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/content/${item.key}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      showFeedback('success', 'Salvo com sucesso!');
      onSaved && onSaved(data);
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.itemRow}>
      <div style={styles.labelCol}>
        <span style={styles.label}>{item.label}</span>
        <span style={styles.labelKey}>{item.key}</span>
      </div>

      <div style={styles.inputCol}>
        {item.type === 'image' ? (
          <>
            {value && (
              <img
                src={value}
                alt={item.label}
                style={styles.imagePreview}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="URL da imagem"
              style={styles.input}
            />
            <div style={{ ...styles.actionRow, marginTop: '8px' }}>
              <input
                type="file"
                accept="image/*"
                style={{ fontSize: '13px', flex: 1 }}
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
              />
              {uploadFile && (
                <button style={styles.btnSecondary} onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Enviando...' : 'Fazer upload'}
                </button>
              )}
            </div>
          </>
        ) : item.type === 'richtext' ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={styles.textarea}
          />
        ) : (
          <input
            type={item.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={styles.input}
          />
        )}

        <div style={styles.actionRow}>
          <button style={styles.btn} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {feedback && (
            <span style={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
              {feedback.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Content() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BACKEND}/api/admin/content`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setError(data.error || 'Erro ao carregar');
      })
      .catch(() => setError('Erro de conexão'))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated) {
    setItems((prev) => prev.map((it) => (it.key === updated.key ? updated : it)));
  }

  // Group by section
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const sectionOrder = ['hero', 'sobre', 'cta', 'rodape', 'config'];

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Conteúdo do Site</h1>
      <p style={styles.pageSub}>Edite os textos e imagens exibidos no site.</p>

      {loading && <div style={styles.loading}>Carregando...</div>}
      {error && <p style={{ color: '#C0392B' }}>{error}</p>}

      {sectionOrder.map((sectionKey) => {
        const sectionItems = grouped[sectionKey];
        if (!sectionItems || sectionItems.length === 0) return null;
        return (
          <div key={sectionKey} style={styles.section}>
            <div style={styles.sectionHeader}>
              {SECTION_LABELS[sectionKey] || sectionKey}
            </div>
            {sectionItems.map((item) => (
              <ContentItem key={item.key} item={item} onSaved={handleSaved} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
  };
}

function formatDatePT(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const STATUS_LABELS = {
  paid:     { label: 'Pago',      bg: '#D4EDDA', color: '#155724' },
  pending:  { label: 'Pendente',  bg: '#FFF3CD', color: '#856404' },
  failed:   { label: 'Falhou',    bg: '#F8D7DA', color: '#721C24' },
  refunded: { label: 'Reembolso', bg: '#D1ECF1', color: '#0C5460' },
};

const PAYMENT_LABELS = { pix: 'PIX', credit_card: 'Cartão' };

const styles = {
  page: { fontFamily: 'Georgia, serif', color: '#2C1A0E' },
  pageTitle: { fontSize: '26px', fontWeight: 'normal', marginBottom: '8px' },
  pageSub: { color: '#8B6B4A', fontSize: '14px', marginBottom: '28px' },
  filterBar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    backgroundColor: '#FFF',
    color: '#2C1A0E',
    outline: 'none',
  },
  inputDate: {
    padding: '8px 12px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    backgroundColor: '#FFF',
    color: '#2C1A0E',
    outline: 'none',
  },
  filterLabel: { fontSize: '13px', color: '#8B6B4A' },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: '11px',
    color: '#8B6B4A',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #F0E4D4',
    backgroundColor: '#FEFBF8',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '13px 14px',
    borderBottom: '1px solid #F7EDE0',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  trClickable: { cursor: 'pointer' },
  badge: (status) => ({
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: STATUS_LABELS[status]?.bg || '#EEE',
    color: STATUS_LABELS[status]?.color || '#333',
  }),
  expandedRow: {
    backgroundColor: '#FEFBF8',
    padding: '16px 20px',
    fontSize: '13px',
    color: '#5A3E2B',
    borderBottom: '1px solid #F0E4D4',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px 24px',
    marginBottom: '12px',
  },
  detailItem: {},
  detailLabel: { fontSize: '11px', color: '#8B6B4A', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' },
  detailValue: { fontSize: '14px', color: '#2C1A0E' },
  statusSelect: {
    padding: '6px 10px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
    outline: 'none',
    marginRight: '8px',
  },
  btnSm: {
    backgroundColor: '#C25E00',
    color: '#FFF',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
  },
  successMsg: { color: '#2E7D32', fontSize: '13px' },
  errorMsg: { color: '#C0392B', fontSize: '13px' },
  empty: { padding: '32px', textAlign: 'center', color: '#8B6B4A', fontSize: '14px' },
  loading: { padding: '40px', textAlign: 'center', color: '#8B6B4A' },
};

function ExpandedRow({ booking, onStatusUpdated }) {
  const [newStatus, setNewStatus] = useState(booking.payment_status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleStatusUpdate() {
    if (newStatus === booking.payment_status) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/bookings/${booking.id}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ payment_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setMsg({ type: 'success', msg: 'Status atualizado!' });
      onStatusUpdated(data);
    } catch (err) {
      setMsg({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div style={styles.expandedRow}>
      <div style={styles.detailGrid}>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>E-mail</div>
          <div style={styles.detailValue}>{booking.patient_email}</div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>Data completa</div>
          <div style={styles.detailValue}>
            {formatDatePT(booking.session_date)} às {booking.session_time?.slice(0, 5)}
          </div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>ID do pedido</div>
          <div style={styles.detailValue}>{booking.pagseguro_order_id || '—'}</div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>ID do pagamento</div>
          <div style={styles.detailValue}>{booking.payment_id || '—'}</div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>Lembrete enviado</div>
          <div style={styles.detailValue}>{booking.reminder_sent ? 'Sim' : 'Não'}</div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>Criado em</div>
          <div style={styles.detailValue}>
            {booking.created_at
              ? new Date(booking.created_at).toLocaleString('pt-BR')
              : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#8B6B4A' }}>Alterar status:</span>
        <select
          style={styles.statusSelect}
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="failed">Falhou</option>
          <option value="refunded">Reembolso</option>
        </select>
        <button style={styles.btnSm} onClick={handleStatusUpdate} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {msg && (
          <span style={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>
            {msg.msg}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  async function loadBookings() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'todos') params.set('status', statusFilter);
    if (dateFilter) params.set('date', dateFilter);

    try {
      const res = await fetch(
        `${BACKEND}/api/admin/bookings?${params.toString()}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (Array.isArray(data)) setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [statusFilter, dateFilter]);

  function handleStatusUpdated(updated) {
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Agendamentos</h1>
      <p style={styles.pageSub}>Lista de todas as sessões agendadas.</p>

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>Status:</span>
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="failed">Falhou</option>
          <option value="refunded">Reembolso</option>
        </select>

        <span style={styles.filterLabel}>Mês:</span>
        <input
          type="month"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={styles.inputDate}
        />
        {dateFilter && (
          <button
            style={{ ...styles.btnSm, backgroundColor: 'transparent', color: '#C25E00', border: '1px solid #C25E00' }}
            onClick={() => setDateFilter('')}
          >
            Limpar
          </button>
        )}
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={styles.loading}>Carregando...</div>
        ) : bookings.length === 0 ? (
          <div style={styles.empty}>Nenhum agendamento encontrado.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Horário</th>
                <th style={styles.th}>Paciente</th>
                <th style={styles.th}>Telefone</th>
                <th style={styles.th}>Valor</th>
                <th style={styles.th}>Método</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <>
                  <tr
                    key={b.id}
                    style={{
                      ...styles.trClickable,
                      backgroundColor: expandedId === b.id ? '#FEFBF8' : 'transparent',
                    }}
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  >
                    <td style={styles.td}>{formatDatePT(b.session_date)}</td>
                    <td style={styles.td}>{b.session_time?.slice(0, 5)}</td>
                    <td style={styles.td}>{b.patient_name}</td>
                    <td style={styles.td}>{b.patient_phone || '—'}</td>
                    <td style={styles.td}>
                      R$ {parseFloat(b.payment_amount || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td style={styles.td}>
                      {PAYMENT_LABELS[b.payment_method] || b.payment_method}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(b.payment_status)}>
                        {STATUS_LABELS[b.payment_status]?.label || b.payment_status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === b.id && (
                    <tr key={`exp-${b.id}`}>
                      <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid #F0E4D4' }}>
                        <ExpandedRow booking={b} onStatusUpdated={handleStatusUpdated} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

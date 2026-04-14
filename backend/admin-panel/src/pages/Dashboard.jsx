import { useState, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
  };
}

// ------- helpers -------
function todayStr() {
  return new Date().toLocaleDateString('sv-SE');
}

function thisWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toLocaleDateString('sv-SE'),
    end: sunday.toLocaleDateString('sv-SE'),
  };
}

function thisMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDatePT(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const styles = {
  page: { fontFamily: 'Georgia, serif', color: '#2C1A0E' },
  pageTitle: { fontSize: '26px', fontWeight: 'normal', marginBottom: '8px', color: '#2C1A0E' },
  pageSub: { color: '#8B6B4A', fontSize: '14px', marginBottom: '36px' },
  statsRow: { display: 'flex', gap: '20px', marginBottom: '36px', flexWrap: 'wrap' },
  statCard: {
    flex: '1 1 180px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    padding: '24px',
    minWidth: '160px',
  },
  statLabel: { fontSize: '12px', color: '#8B6B4A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' },
  statValue: { fontSize: '32px', color: '#C25E00', fontWeight: 'normal', margin: 0 },
  statSub: { fontSize: '12px', color: '#8B6B4A', marginTop: '4px' },
  section: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #F0E4D4',
    fontSize: '15px',
    color: '#2C1A0E',
    fontWeight: 'normal',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '11px',
    color: '#8B6B4A',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #F0E4D4',
    backgroundColor: '#FEFBF8',
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    borderBottom: '1px solid #F7EDE0',
    color: '#2C1A0E',
  },
  empty: { padding: '32px 24px', textAlign: 'center', color: '#8B6B4A', fontSize: '14px' },
  loading: { padding: '40px 24px', textAlign: 'center', color: '#8B6B4A' },
};

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/admin/bookings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBookings(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = todayStr();
  const week = thisWeekRange();
  const monthStr = thisMonthStr();

  const paidBookings = bookings.filter((b) => b.payment_status === 'paid');

  const sessionsToday = paidBookings.filter(
    (b) => b.session_date && b.session_date.slice(0, 10) === today
  ).length;

  const sessionsWeek = paidBookings.filter((b) => {
    const d = b.session_date ? b.session_date.slice(0, 10) : '';
    return d >= week.start && d <= week.end;
  }).length;

  const revenueMonth = paidBookings
    .filter((b) => {
      const d = b.session_date ? b.session_date.slice(0, 7) : '';
      return d === monthStr;
    })
    .reduce((acc, b) => acc + (parseFloat(b.payment_amount) || 0), 0);

  // Next upcoming paid session
  const upcoming = paidBookings
    .filter((b) => b.session_date && b.session_date.slice(0, 10) >= today)
    .sort((a, b) => {
      const da = a.session_date + 'T' + a.session_time;
      const db = b.session_date + 'T' + b.session_time;
      return da.localeCompare(db);
    });

  const nextSession = upcoming[0];
  const next5 = upcoming.slice(0, 5);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Dashboard</h1>
      <p style={styles.pageSub}>Visão geral dos agendamentos</p>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Sessões hoje</p>
          <p style={styles.statValue}>{loading ? '—' : sessionsToday}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Sessões esta semana</p>
          <p style={styles.statValue}>{loading ? '—' : sessionsWeek}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Receita do mês</p>
          <p style={styles.statValue}>
            {loading
              ? '—'
              : `R$ ${revenueMonth.toFixed(2).replace('.', ',')}`}
          </p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Próxima sessão</p>
          {loading ? (
            <p style={styles.statValue}>—</p>
          ) : nextSession ? (
            <>
              <p style={{ ...styles.statValue, fontSize: '18px' }}>
                {formatDatePT(nextSession.session_date.slice(0, 10))}
              </p>
              <p style={styles.statSub}>{nextSession.session_time.slice(0, 5)}</p>
            </>
          ) : (
            <p style={{ ...styles.statValue, fontSize: '18px' }}>Nenhuma</p>
          )}
        </div>
      </div>

      {/* Upcoming sessions table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Próximas sessões confirmadas</div>
        {loading ? (
          <div style={styles.loading}>Carregando...</div>
        ) : next5.length === 0 ? (
          <div style={styles.empty}>Nenhuma sessão próxima confirmada.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Horário</th>
                <th style={styles.th}>Paciente</th>
                <th style={styles.th}>Telefone</th>
                <th style={styles.th}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {next5.map((b) => (
                <tr key={b.id}>
                  <td style={styles.td}>{formatDatePT(b.session_date.slice(0, 10))}</td>
                  <td style={styles.td}>{b.session_time.slice(0, 5)}</td>
                  <td style={styles.td}>{b.patient_name}</td>
                  <td style={styles.td}>{b.patient_phone || '—'}</td>
                  <td style={styles.td}>
                    R$ {parseFloat(b.payment_amount || 0).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

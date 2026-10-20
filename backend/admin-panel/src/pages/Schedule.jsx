import { useState, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const styles = {
  page: { fontFamily: 'Georgia, serif', color: '#2C1A0E' },
  pageTitle: { fontSize: '26px', fontWeight: 'normal', marginBottom: '8px' },
  pageSub: { color: '#8B6B4A', fontSize: '14px', marginBottom: '28px' },
  tabs: { display: 'flex', borderBottom: '2px solid #E8D5C0', marginBottom: '28px' },
  tab: {
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '14px',
    border: 'none',
    background: 'none',
    color: '#8B6B4A',
    fontFamily: 'Georgia, serif',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
  },
  tabActive: { color: '#C25E00', borderBottomColor: '#C25E00' },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    overflow: 'hidden',
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
  td: { padding: '12px 16px', borderBottom: '1px solid #F7EDE0', fontSize: '14px' },
  input: {
    padding: '7px 10px',
    border: '1px solid #E8D5C0',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
    outline: 'none',
    backgroundColor: '#FEFBF8',
  },
  btn: {
    backgroundColor: '#C25E00',
    color: '#FFF',
    border: 'none',
    padding: '7px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
  },
  btnSm: {
    backgroundColor: 'transparent',
    color: '#C25E00',
    border: '1px solid #C25E00',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Georgia, serif',
  },
  btnDanger: {
    backgroundColor: 'transparent',
    color: '#C0392B',
    border: '1px solid #C0392B',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Georgia, serif',
  },
  toggle: { cursor: 'pointer', fontSize: '20px', userSelect: 'none' },
  formBox: { padding: '24px' },
  row: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fLabel: { fontSize: '12px', color: '#8B6B4A', letterSpacing: '1px', textTransform: 'uppercase' },
  successMsg: { color: '#2E7D32', fontSize: '13px', marginTop: '8px' },
  errorMsg: { color: '#C0392B', fontSize: '13px', marginTop: '8px' },
  // Calendar
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', padding: '16px' },
  calHeader: { textAlign: 'center', fontSize: '11px', color: '#8B6B4A', padding: '6px 0', letterSpacing: '1px', textTransform: 'uppercase' },
  calDay: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '14px',
    userSelect: 'none',
  },
  calDayBlocked: { backgroundColor: '#F5C6C0', color: '#C0392B' },
  calDayEmpty: { cursor: 'default' },
  calNavRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0' },
  calNavBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#C25E00',
    padding: '4px 8px',
  },
  calMonthLabel: { fontSize: '15px', fontWeight: 'normal', margin: 0 },
};

// ===================== TAB 1: Disponibilidade =====================
const stylesAv = {
  dayCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D5C0',
    borderRadius: '8px',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: '#F7EDE0',
    borderBottom: '1px solid #E8D5C0',
  },
  dayName: { fontSize: '15px', color: '#2C1A0E' },
  periodRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderBottom: '1px solid #F7EDE0',
    flexWrap: 'wrap',
  },
  newRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    backgroundColor: '#FEFBF8',
    flexWrap: 'wrap',
  },
  timeLabel: { fontSize: '12px', color: '#8B6B4A', marginRight: '4px' },
  emptyMsg: { padding: '14px 20px', fontSize: '13px', color: '#8B6B4A' },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#C0392B',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '0 4px',
  },
};

function DayRow({ dow, periods, onReload }) {
  const [newPeriod, setNewPeriod] = useState(null);
  const [msg, setMsg] = useState(null);

  function showMsg(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 2500);
  }

  async function handleToggle(period) {
    await fetch(`${BACKEND}/api/admin/schedule/availability/${period.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !period.is_active }),
    });
    onReload();
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este período?')) return;
    const res = await fetch(`${BACKEND}/api/admin/schedule/availability/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) onReload();
    else showMsg('error', 'Erro ao remover.');
  }

  async function handleSaveNew() {
    if (!newPeriod.start_time || !newPeriod.end_time) {
      showMsg('error', 'Preencha início e fim.');
      return;
    }
    const res = await fetch(`${BACKEND}/api/admin/schedule/availability`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_of_week: dow, ...newPeriod }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewPeriod(null);
      onReload();
      showMsg('success', 'Período adicionado!');
    } else {
      showMsg('error', data.error || 'Erro');
    }
  }

  return (
    <div style={stylesAv.dayCard}>
      <div style={stylesAv.dayHeader}>
        <span style={stylesAv.dayName}>{DAY_NAMES[dow]}</span>
        <button
          style={styles.btnSm}
          onClick={() => setNewPeriod({ start_time: '09:00', end_time: '12:00', slot_duration: 60, is_active: true })}
          disabled={newPeriod !== null}
        >
          + Adicionar período
        </button>
      </div>

      {periods.length === 0 && !newPeriod && (
        <div style={stylesAv.emptyMsg}>Nenhum período configurado.</div>
      )}

      {periods.map((p) => (
        <div key={p.id} style={stylesAv.periodRow}>
          <span
            style={{ ...styles.toggle, fontSize: '16px' }}
            title={p.is_active ? 'Clique para desativar' : 'Clique para ativar'}
            onClick={() => handleToggle(p)}
          >
            {p.is_active ? '🟢' : '⚫'}
          </span>
          <span style={stylesAv.timeLabel}>Início</span>
          <strong style={{ fontSize: '14px' }}>{p.start_time.slice(0, 5)}</strong>
          <span style={stylesAv.timeLabel}>Fim</span>
          <strong style={{ fontSize: '14px' }}>{p.end_time.slice(0, 5)}</strong>
          <span style={{ ...stylesAv.timeLabel, marginLeft: '8px' }}>
            {p.slot_duration} min/sessão
          </span>
          <button
            style={stylesAv.removeBtn}
            title="Remover período"
            onClick={() => handleDelete(p.id)}
          >
            ×
          </button>
        </div>
      ))}

      {newPeriod && (
        <div style={stylesAv.newRow}>
          <div style={styles.fieldGroup}>
            <span style={styles.fLabel}>Início</span>
            <input
              type="time"
              value={newPeriod.start_time}
              onChange={(e) => setNewPeriod((p) => ({ ...p, start_time: e.target.value }))}
              style={styles.input}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.fLabel}>Fim</span>
            <input
              type="time"
              value={newPeriod.end_time}
              onChange={(e) => setNewPeriod((p) => ({ ...p, end_time: e.target.value }))}
              style={styles.input}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.fLabel}>Duração (min)</span>
            <input
              type="number"
              value={newPeriod.slot_duration}
              min={15}
              max={120}
              step={5}
              onChange={(e) => setNewPeriod((p) => ({ ...p, slot_duration: Number(e.target.value) }))}
              style={{ ...styles.input, width: '70px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '1px' }}>
            <button style={styles.btn} onClick={handleSaveNew}>Salvar</button>
            <button style={styles.btnSm} onClick={() => setNewPeriod(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ padding: '8px 20px', fontSize: '13px', color: msg.type === 'success' ? '#2E7D32' : '#C0392B' }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

function AvailabilityTab({ availability, onReload }) {
  return (
    <div>
      {DAY_NAMES.map((_, dow) => (
        <DayRow
          key={dow}
          dow={dow}
          periods={availability
            .filter((a) => a.day_of_week === dow)
            .map((a) => ({ ...a, start_time: a.start_time.slice(0, 5), end_time: a.end_time.slice(0, 5) }))}
          onReload={onReload}
        />
      ))}
    </div>
  );
}

// ===================== TAB 2: Bloquear Datas =====================
const MONTH_NAMES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function BlockDatesTab({ blockedDates, onReload }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);

  const blockedSet = new Set(
    blockedDates.map((b) => b.date.slice(0, 10))
  );
  const blockedIdMap = {};
  for (const b of blockedDates) blockedIdMap[b.date.slice(0, 10)] = b.id;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function dateStr(d) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  async function toggleDate(d) {
    const ds = dateStr(d);
    if (blockedSet.has(ds)) {
      // Unblock
      const id = blockedIdMap[ds];
      const ok = window.confirm(`Desbloquear ${ds}?`);
      if (!ok) return;
      const res = await fetch(`${BACKEND}/api/admin/schedule/block-date/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) { onReload(); setMsg({ type: 'success', msg: `${ds} desbloqueado.` }); }
    } else {
      // Block
      const res = await fetch(`${BACKEND}/api/admin/schedule/block-date`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: ds, reason: reason || null }),
      });
      const data = await res.json();
      if (res.ok) { onReload(); setMsg({ type: 'success', msg: `${ds} bloqueado.` }); }
      else setMsg({ type: 'error', msg: data.error || 'Erro' });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={styles.card}>
      <div style={styles.calNavRow}>
        <button style={styles.calNavBtn} onClick={prevMonth}>‹</button>
        <h3 style={styles.calMonthLabel}>{MONTH_NAMES_PT[month]} {year}</h3>
        <button style={styles.calNavBtn} onClick={nextMonth}>›</button>
      </div>

      <div style={{ padding: '12px 16px 4px' }}>
        <label style={styles.fLabel}>Motivo (opcional):</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="ex: Feriado, viagem..."
          style={{ ...styles.input, width: '100%', marginTop: '6px', boxSizing: 'border-box' }}
        />
        <p style={{ fontSize: '12px', color: '#8B6B4A', margin: '6px 0 0' }}>
          Clique em um dia para bloquear ou desbloquear.
          <span style={{ color: '#C0392B', marginLeft: '8px' }}>■ Bloqueado</span>
        </p>
      </div>

      <div style={styles.calGrid}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
          <div key={d} style={styles.calHeader}>{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} />;
          const ds = dateStr(d);
          const blocked = blockedSet.has(ds);
          return (
            <div
              key={d}
              style={{
                ...styles.calDay,
                ...(blocked ? styles.calDayBlocked : {}),
                ':hover': { backgroundColor: '#F0E4D4' },
              }}
              onClick={() => toggleDate(d)}
              title={blocked ? `Clique para desbloquear ${ds}` : `Clique para bloquear ${ds}`}
            >
              {d}
            </div>
          );
        })}
      </div>

      {msg && (
        <p style={{ ...( msg.type === 'success' ? styles.successMsg : styles.errorMsg), padding: '0 16px 12px' }}>
          {msg.msg}
        </p>
      )}
    </div>
  );
}

// ===================== TAB 3: Bloquear Horários =====================
function BlockSlotsTab({ blockedSlots, onReload }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);

  const slotsForDate = date
    ? blockedSlots.filter((s) => s.date.slice(0, 10) === date)
    : [];

  async function handleBlock() {
    if (!date || !time) { setMsg({ type: 'error', msg: 'Selecione data e horário.' }); return; }
    const res = await fetch(`${BACKEND}/api/admin/schedule/block-slot`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time, reason: reason || null }),
    });
    const data = await res.json();
    if (res.ok) {
      onReload();
      setTime('');
      setReason('');
      setMsg({ type: 'success', msg: 'Horário bloqueado!' });
    } else {
      setMsg({ type: 'error', msg: data.error || 'Erro' });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete(id) {
    if (!window.confirm('Desbloquear este horário?')) return;
    const res = await fetch(`${BACKEND}/api/admin/schedule/block-slot/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) { onReload(); setMsg({ type: 'success', msg: 'Horário desbloqueado.' }); }
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={styles.card}>
      <div style={styles.formBox}>
        <div style={styles.row}>
          <div style={styles.fieldGroup}>
            <span style={styles.fLabel}>Data</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.fLabel}>Horário</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <span style={styles.fLabel}>Motivo (opcional)</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: Compromisso pessoal"
              style={styles.input}
            />
          </div>
          <button style={styles.btn} onClick={handleBlock}>
            Bloquear horário
          </button>
        </div>

        {msg && (
          <p style={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>
            {msg.msg}
          </p>
        )}

        {date && (
          <>
            <h4 style={{ fontSize: '14px', color: '#8B6B4A', margin: '20px 0 12px', fontWeight: 'normal' }}>
              Horários bloqueados em {date}:
            </h4>
            {slotsForDate.length === 0 ? (
              <p style={{ color: '#8B6B4A', fontSize: '13px' }}>Nenhum horário bloqueado nesta data.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Horário</th>
                    <th style={styles.th}>Motivo</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {slotsForDate.map((s) => (
                    <tr key={s.id}>
                      <td style={styles.td}>{s.time.slice(0, 5)}</td>
                      <td style={styles.td}>{s.reason || '—'}</td>
                      <td style={styles.td}>
                        <button style={styles.btnDanger} onClick={() => handleDelete(s.id)}>
                          Desbloquear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===================== MAIN =====================
export default function Schedule() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ availability: [], blocked_dates: [], blocked_slots: [] });
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BACKEND}/api/admin/schedule`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const tabs = ['Disponibilidade', 'Bloquear Datas', 'Bloquear Horários'];

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Agenda</h1>
      <p style={styles.pageSub}>Configure horários disponíveis e bloqueios.</p>

      <div style={styles.tabs}>
        {tabs.map((t, i) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === i ? styles.tabActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#8B6B4A' }}>Carregando...</p>
      ) : (
        <>
          {tab === 0 && <AvailabilityTab availability={data.availability} onReload={loadData} />}
          {tab === 1 && <BlockDatesTab blockedDates={data.blocked_dates} onReload={loadData} />}
          {tab === 2 && <BlockSlotsTab blockedSlots={data.blocked_slots} onReload={loadData} />}
        </>
      )}
    </div>
  );
}

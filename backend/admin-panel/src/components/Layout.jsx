import { NavLink, useNavigate } from 'react-router-dom';

const SIDEBAR_W = 240;

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Georgia, "Times New Roman", serif',
    backgroundColor: '#FDF5EE',
  },
  sidebar: {
    width: SIDEBAR_W,
    minWidth: SIDEBAR_W,
    backgroundColor: '#1E1510',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  logoArea: {
    padding: '32px 24px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoText: {
    color: '#C8A882',
    fontSize: '15px',
    fontWeight: 'normal',
    letterSpacing: '1px',
    margin: 0,
  },
  logoSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginTop: '4px',
  },
  nav: {
    flex: 1,
    padding: '16px 0',
  },
  navLinkBase: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 24px',
    color: 'rgba(255,255,255,0.65)',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.15s, background 0.15s',
    borderLeft: '3px solid transparent',
  },
  navLinkActive: {
    color: '#C25E00',
    backgroundColor: 'rgba(194,94,0,0.08)',
    borderLeft: '3px solid #C25E00',
  },
  navIcon: {
    fontSize: '15px',
    width: '18px',
    textAlign: 'center',
  },
  logoutArea: {
    padding: '16px 24px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  logoutBtn: {
    width: '100%',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.5)',
    padding: '9px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'border-color 0.15s, color 0.15s',
  },
  main: {
    flex: 1,
    padding: '40px',
    overflowY: 'auto',
    minWidth: 0,
  },
};

const navItems = [
  { to: '/admin',             label: 'Dashboard',      icon: '▦' },
  { to: '/admin/content',     label: 'Conteúdo',       icon: '✎' },
  { to: '/admin/agenda',      label: 'Agenda',         icon: '◷' },
  { to: '/admin/agendamentos',label: 'Agendamentos',   icon: '☰' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <p style={styles.logoText}>[NOME] · Admin</p>
          <p style={styles.logoSub}>Painel administrativo</p>
        </div>

        <nav style={styles.nav}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              style={({ isActive }) => ({
                ...styles.navLinkBase,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span style={styles.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.logoutArea}>
          <button
            style={styles.logoutBtn}
            onClick={handleLogout}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>{children}</main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { useSystemStatus } from '../../context/SystemStatusContext';
import { IconZap } from '../common/icons';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/panels', label: 'Panels', end: false },
  { to: '/alarms', label: 'Alarms', end: false },
  { to: '/scada', label: 'SCADA', end: false },
];

export function Sidebar() {
  const { isOnline } = useSystemStatus();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">
          <IconZap width={16} height={16} />
        </span>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">GRID UP</span>
          <span className="sidebar-brand-subtitle">Electrical Panel Monitoring</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>
          <div className="sidebar-footer-label">System Status</div>
          <div className={`system-status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="system-status-note">{isOnline ? 'All systems operational' : 'Connection issue detected'}</div>
        </div>

        <div className="sidebar-meta">
          <div className="sidebar-meta-line strong">Grid Up</div>
          <div className="sidebar-meta-line">Early Warning for a Safer Grid</div>
          <div className="sidebar-meta-line">v0.1.0</div>
        </div>
      </div>
    </aside>
  );
}

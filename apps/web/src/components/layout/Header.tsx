import { useEffect, useState } from 'react';
import { useSystemStatus } from '../../context/SystemStatusContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  autoRefreshMs?: number;
}

export function Header({ title, subtitle, autoRefreshMs }: HeaderProps) {
  const { isOnline, lastUpdated } = useSystemStatus();
  // Forces a re-render every second so the "Last updated" time stays fresh.
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="header-status">
        <span className={`live-indicator${isOnline ? '' : ' offline'}`}>
          <span className="live-dot" />
          {isOnline ? 'Live' : 'Offline'}
        </span>
        <span className="header-status-divider">•</span>
        <span className="last-update">
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-GB') : '—'}
        </span>
        {autoRefreshMs && (
          <>
            <span className="header-status-divider">•</span>
            <span className="auto-refresh">Auto refresh ({Math.round(autoRefreshMs / 1000)}s)</span>
          </>
        )}
      </div>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { Severity, type AlarmWithPanel } from '@grid-up/shared';
import { SEVERITY_CLASS, formatDateTime } from '../../utils/status';

const RECENT_ALARMS_LIMIT = 5;

export function RecentAlarmsCard({ alarms }: { alarms: AlarmWithPanel[] }) {
  const recent = [...alarms]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_ALARMS_LIMIT);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Recent Alarms</div>
          <div className="card-subtitle">Latest alerts across all panels</div>
        </div>
        <Link to="/alarms" className="card-link">
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="empty-hint">No active alarms.</p>
      ) : (
        <div className="recent-alarms-list">
          {recent.map((alarm) => (
            <div key={alarm.id} className="recent-alarm-row">
              <span className={`severity-pill ${SEVERITY_CLASS[alarm.severity as Severity]}`}>{alarm.severity}</span>
              <div className="recent-alarm-body">
                <div className="recent-alarm-title-row">
                  <span className="recent-alarm-title">{alarm.title}</span>
                  <span className={`alarm-status-tag ${alarm.status.toLowerCase()}`}>{alarm.status}</span>
                </div>
                <div className="recent-alarm-meta">
                  {alarm.panel.code} · {alarm.panel.site.name}
                </div>
              </div>
              <span className="recent-alarm-time">{formatDateTime(alarm.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

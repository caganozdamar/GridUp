import type { AlarmWithPanel } from '@grid-up/shared';
import { SEVERITY_CLASS, formatDateTime } from '../../utils/status';

export function AlarmsTable({ alarms }: { alarms: AlarmWithPanel[] }) {
  if (alarms.length === 0) {
    return <p className="empty-hint">No alarms found.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Panel</th>
            <th>Severity</th>
            <th>Alarm</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {alarms.map((alarm) => (
            <tr key={alarm.id} className={alarm.status === 'ACTIVE' && alarm.severity === 'CRITICAL' ? 'row-flag-critical' : undefined}>
              <td>
                <span className="table-strong">{alarm.panel.code}</span>
                <div className="table-subtext">{alarm.panel.site.name}</div>
              </td>
              <td>
                <span className={`severity-pill ${SEVERITY_CLASS[alarm.severity]}`}>{alarm.severity}</span>
              </td>
              <td>
                <div className="alarm-title">{alarm.title}</div>
                <div className="table-subtext">{alarm.message}</div>
              </td>
              <td>
                <span className={`status-pill ${alarm.status.toLowerCase()}`}>{alarm.status}</span>
              </td>
              <td>{formatDateTime(alarm.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

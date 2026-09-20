import type { AlarmWithPanel } from '@grid-up/shared';
import { SEVERITY_CLASS, formatDateTime } from '../../utils/status';

interface AlarmsTableProps {
  alarms: AlarmWithPanel[];
  /** Verilirse ACTIVE alarmlar icin "Acknowledge" butonu gosterilir. */
  onAcknowledge?: (alarmId: string) => void;
  acknowledgingId?: string | null;
}

export function AlarmsTable({ alarms, onAcknowledge, acknowledgingId }: AlarmsTableProps) {
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
            {onAcknowledge && <th></th>}
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
                <div className="alarm-title">
                  {alarm.title}
                  {alarm.kind === 'MODULE_OFFLINE' && <span className="kind-tag">MODULE OFFLINE</span>}
                </div>
                <div className="table-subtext">{alarm.message}</div>
              </td>
              <td>
                <span className={`status-pill ${alarm.status.toLowerCase()}`}>{alarm.status}</span>
                {alarm.acknowledgedAt && (
                  <div className="table-subtext">Acknowledged {formatDateTime(alarm.acknowledgedAt)}</div>
                )}
              </td>
              <td>{formatDateTime(alarm.createdAt)}</td>
              {onAcknowledge && (
                <td>
                  {alarm.status === 'ACTIVE' && (
                    <button
                      className="filter-chip"
                      type="button"
                      disabled={acknowledgingId === alarm.id}
                      onClick={() => onAcknowledge(alarm.id)}
                    >
                      {acknowledgingId === alarm.id ? 'Acknowledging…' : 'Acknowledge'}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

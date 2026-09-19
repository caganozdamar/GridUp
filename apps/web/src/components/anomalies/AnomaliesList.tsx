import type { Anomaly } from '@grid-up/shared';
import { SEVERITY_CLASS, formatDateTime } from '../../utils/status';

export function AnomaliesList({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) {
    return <p className="empty-hint">No anomalies recorded.</p>;
  }

  const sorted = [...anomalies].sort((a, b) => {
    const aActive = a.resolvedAt === null;
    const bActive = b.resolvedAt === null;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Severity</th>
            <th>Detected At</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((anomaly) => (
            <tr key={anomaly.id}>
              <td>{anomaly.type}</td>
              <td>
                <span className={`severity-pill ${SEVERITY_CLASS[anomaly.severity]}`}>{anomaly.severity}</span>
              </td>
              <td>{formatDateTime(anomaly.detectedAt)}</td>
              <td>
                <span className={`status-pill ${anomaly.resolvedAt === null ? 'active' : 'resolved'}`}>
                  {anomaly.resolvedAt === null ? 'ACTIVE' : 'RESOLVED'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { RiskLevel, SensorType, type PanelSummary } from '@grid-up/shared';
import { usePanelSensorSnapshot } from '../../hooks/usePanelSensorSnapshot';
import { formatTime } from '../../utils/status';
import { POLLING_INTERVALS } from '../../config';
import { RiskBadge } from '../status/RiskBadge';
import { DataHealthBadge } from '../decision-support/DataHealthBadge';

const DISPLAY_SENSORS: Array<{ type: SensorType; label: string }> = [
  { type: SensorType.CABLE_TEMPERATURE, label: 'Cable Temp' },
  { type: SensorType.CURRENT, label: 'Current' },
  { type: SensorType.HUMIDITY, label: 'Humidity' },
];

const ROW_FLAG_CLASS: Partial<Record<RiskLevel, string>> = {
  [RiskLevel.HIGH]: 'row-flag-high',
  [RiskLevel.CRITICAL]: 'row-flag-critical',
};

export function PanelStatusRow({ panel }: { panel: PanelSummary }) {
  const { snapshotByType } = usePanelSensorSnapshot(panel.id, POLLING_INTERVALS.overview);
  const level = panel.latestRiskScore?.level ?? RiskLevel.NORMAL;
  const score = panel.latestRiskScore?.score ?? 0;
  const rowFlag = ROW_FLAG_CLASS[level];

  return (
    <tr className={rowFlag}>
      <td>
        <Link to={`/panels/${panel.id}`} className="table-link">
          {panel.code}
        </Link>
        {panel.name !== panel.code && <div className="table-subtext">{panel.name}</div>}
      </td>
      <td>{panel.site.name}</td>
      <td>
        <span className={`status-pill ${panel.status === 'ONLINE' ? 'online' : 'offline'}`}>{panel.status}</span>
      </td>
      <td className="table-strong">{score}</td>
      <td>
        <RiskBadge level={level} />
      </td>
      <td>
        <div className="key-sensor-values">
          {DISPLAY_SENSORS.map(({ type, label }) => {
            const snapshot = snapshotByType.get(type);
            return (
              <div key={type} className="key-sensor-value-row">
                <span className="reading-label">{label}</span>
                <span className="reading-value">
                  {snapshot?.latestValue != null ? `${snapshot.latestValue.toFixed(1)} ${snapshot.sensor.unit}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </td>
      <td>
        {panel.activeAlarmCount > 0 ? (
          <span className="alarm-count-badge">{panel.activeAlarmCount}</span>
        ) : (
          <span className="alarm-count-zero">0</span>
        )}
      </td>
      <td>
        <DataHealthBadge dataHealth={panel.dataHealth} />
      </td>
      <td className="table-time">
        {panel.latestRiskScore ? formatTime(panel.latestRiskScore.calculatedAt) : '—'}
      </td>
    </tr>
  );
}

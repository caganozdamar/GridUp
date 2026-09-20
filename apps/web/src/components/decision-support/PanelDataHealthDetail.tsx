import type { PanelDataHealth } from '@grid-up/shared';
import { DataHealthBadge } from './DataHealthBadge';
import { formatRelativeTime } from '../../utils/status';

/** Asama 9 madde 13: Panel Detail'deki "Sensor Data Health" bloğu. */
export function PanelDataHealthDetail({ dataHealth }: { dataHealth: PanelDataHealth }) {
  return (
    <div className="data-health-detail">
      <div className="data-health-detail-row">
        <span className="data-health-detail-label">Sensor Data Health</span>
        <DataHealthBadge dataHealth={dataHealth} />
      </div>
      <p className="data-health-detail-meta">
        {dataHealth.lastSensorUpdate
          ? `Last update: ${formatRelativeTime(dataHealth.lastSensorUpdate)}`
          : 'No sensor data received yet.'}
      </p>
    </div>
  );
}

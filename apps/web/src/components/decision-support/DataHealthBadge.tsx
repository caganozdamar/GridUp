import { DataHealthStatus, type PanelDataHealth } from '@grid-up/shared';

const LABEL: Record<DataHealthStatus, string> = {
  [DataHealthStatus.VALID]: 'VALID',
  [DataHealthStatus.STALE]: 'STALE',
  [DataHealthStatus.NO_DATA]: 'NO DATA',
};

const CLASS: Record<DataHealthStatus, string> = {
  [DataHealthStatus.VALID]: 'status-normal',
  [DataHealthStatus.STALE]: 'status-warning',
  [DataHealthStatus.NO_DATA]: 'status-critical',
};

/** Asama 9 madde 13: Overview tablosu + Panel Detail icin paylasilan data health badge. */
export function DataHealthBadge({ dataHealth }: { dataHealth: PanelDataHealth }) {
  return <span className={`risk-badge ${CLASS[dataHealth.status]}`}>{LABEL[dataHealth.status]}</span>;
}

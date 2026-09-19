import type { RiskLevel } from '@grid-up/shared';
import { RISK_LEVEL_CLASS } from '../../utils/status';

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge ${RISK_LEVEL_CLASS[level]}`}>{level}</span>;
}

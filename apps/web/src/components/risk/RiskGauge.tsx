import type { CSSProperties } from 'react';
import type { RiskLevel } from '@grid-up/shared';
import { RISK_LEVEL_CLASS } from '../../utils/status';
import { RiskBadge } from '../status/RiskBadge';

interface GaugeStyle extends CSSProperties {
  '--pct': number;
}

export function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const style: GaugeStyle = { '--pct': Math.max(0, Math.min(100, score)) };

  return (
    <div className={`risk-gauge ${RISK_LEVEL_CLASS[level]}`} style={style}>
      <div className="risk-gauge-value">
        <span className="risk-gauge-score">{score}</span>
        <span className="risk-gauge-max">/ 100</span>
        <RiskBadge level={level} />
      </div>
    </div>
  );
}

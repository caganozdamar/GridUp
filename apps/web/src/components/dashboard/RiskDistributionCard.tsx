import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { RiskLevel } from '@grid-up/shared';

const TOOLTIP_STYLE = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
};

const SEGMENTS: Array<{ level: RiskLevel; label: string; color: string }> = [
  { level: RiskLevel.NORMAL, label: 'Normal', color: 'var(--status-normal)' },
  { level: RiskLevel.WARNING, label: 'Warning', color: 'var(--status-warning)' },
  { level: RiskLevel.HIGH, label: 'High', color: 'var(--status-high)' },
  { level: RiskLevel.CRITICAL, label: 'Critical', color: 'var(--status-critical)' },
];

export interface RiskDistributionCounts {
  normal: number;
  warning: number;
  high: number;
  critical: number;
}

export function RiskDistributionCard({ counts }: { counts: RiskDistributionCounts }) {
  const total = counts.normal + counts.warning + counts.high + counts.critical;
  const data = SEGMENTS.map((segment) => ({
    ...segment,
    value: counts[segment.level.toLowerCase() as keyof RiskDistributionCounts],
  }));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Risk Level Distribution</div>
          <div className="card-subtitle">Current risk levels across all panels</div>
        </div>
      </div>

      {total === 0 ? (
        <p className="empty-hint">No panel data available.</p>
      ) : (
        <div className="distribution-layout">
          <div className="distribution-donut-wrap">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={total > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((segment) => (
                    <Cell key={segment.level} fill={segment.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="distribution-donut-total">
              <span className="distribution-donut-total-value">{total}</span>
              <span className="distribution-donut-total-label">Panels</span>
            </div>
          </div>

          <div className="distribution-legend">
            {data.map((segment) => (
              <div key={segment.level} className="distribution-legend-row">
                <span className="distribution-legend-dot" style={{ background: segment.color }} />
                <span className="distribution-legend-label">{segment.label}</span>
                <span className="distribution-legend-value">{segment.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

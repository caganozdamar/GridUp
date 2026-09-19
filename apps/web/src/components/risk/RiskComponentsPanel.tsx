import type { RiskComponents } from '@grid-up/shared';

const LABELS: Record<keyof RiskComponents, string> = {
  temperature: 'Temperature',
  current: 'Current',
  humidity: 'Humidity',
  trend: 'Trend',
};

const KEYS = Object.keys(LABELS) as Array<keyof RiskComponents>;

export function RiskComponentsPanel({ components }: { components: RiskComponents }) {
  return (
    <div className="risk-components">
      {KEYS.map((key) => (
        <div key={key} className="risk-component-row">
          <span className="risk-component-label">{LABELS[key]}</span>
          <div className="risk-component-track">
            <div className="risk-component-fill" style={{ width: `${components[key]}%` }} />
          </div>
          <span className="risk-component-value">{components[key]}</span>
        </div>
      ))}
    </div>
  );
}

import type { OperationalMetrics } from '@grid-up/shared';

/**
 * Asama 9 madde 20-23: gercek DB aggregate'lerinden gelen, kanitlanamayan
 * iddialar icermeyen (bkz. docs/decision-support.md) kompakt bir bolum.
 * Ana KPI kartlarindan (Total Panels/Normal/... ) daha dusuk hiyerarsidedir.
 */
export function EarlyWarningActivityCard({ metrics }: { metrics: OperationalMetrics | null }) {
  return (
    <div className="card early-warning-card">
      <div className="card-head">
        <div>
          <div className="card-title">Early Warning Activity</div>
          <div className="card-subtitle">Trend-based early warning outcomes across all panels</div>
        </div>
      </div>
      <div className="early-warning-stats">
        <div className="early-warning-stat">
          <div className="early-warning-stat-value">{metrics?.earlyWarningsGenerated ?? '—'}</div>
          <div className="early-warning-stat-label">Early Warnings</div>
        </div>
        <div className="early-warning-stat">
          <div className="early-warning-stat-value">{metrics?.criticalEscalationsDetected ?? '—'}</div>
          <div className="early-warning-stat-label">Critical Escalations</div>
        </div>
        <div className="early-warning-stat">
          <div className="early-warning-stat-value">{metrics?.notificationsDelivered ?? '—'}</div>
          <div className="early-warning-stat-label">Notifications Delivered</div>
        </div>
      </div>
    </div>
  );
}

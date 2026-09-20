import { TrendEstimateStatus, type TrendEstimate } from '@grid-up/shared';

const TONE_CLASS: Record<TrendEstimateStatus, string> = {
  [TrendEstimateStatus.RISING]: 'tone-rising',
  [TrendEstimateStatus.CRITICAL]: 'tone-critical',
  [TrendEstimateStatus.STABLE]: 'tone-neutral',
  [TrendEstimateStatus.INSUFFICIENT_DATA]: 'tone-neutral',
};

function headlineFor(trendEstimate: TrendEstimate): string {
  if (trendEstimate.status === TrendEstimateStatus.RISING && trendEstimate.estimatedMinutesToCritical !== null) {
    return `≈ ${trendEstimate.estimatedMinutesToCritical} min`;
  }
  if (trendEstimate.status === TrendEstimateStatus.CRITICAL) return 'Reached';
  return '—';
}

/**
 * Asama 9 madde 1-6: trend-based (ML/AI DEGIL) Critical Threshold Estimate.
 * Buyuk kirmizi countdown/animasyon kasitli olarak kullanilmaz.
 */
export function TrendEstimateCard({ trendEstimate }: { trendEstimate?: TrendEstimate }) {
  if (!trendEstimate) return null;

  return (
    <div className="trend-estimate">
      <div className="trend-estimate-head">
        <span className="trend-estimate-label">Critical Threshold Estimate</span>
        {trendEstimate.quality && <span className="trend-quality-tag">Trend quality: {trendEstimate.quality}</span>}
      </div>
      <div className={`trend-estimate-value ${TONE_CLASS[trendEstimate.status]}`}>{headlineFor(trendEstimate)}</div>
      <p className="trend-estimate-message">{trendEstimate.message}</p>
      <p className="trend-estimate-disclaimer">
        Estimate assumes the recent trend continues and is not a failure prediction.
      </p>
    </div>
  );
}

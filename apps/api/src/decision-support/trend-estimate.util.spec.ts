import { describe, expect, it } from 'vitest';
import { TrendEstimateStatus, TrendQuality } from '@grid-up/shared';
import { computeTrendEstimate, type RiskScoreSample } from './trend-estimate.util.js';

const BASE = new Date('2026-01-01T00:00:00.000Z').getTime();
const MINUTE = 60_000;

/** `scoresChronological[0]` en eski, son eleman en yeni ornektir; 1 dakika araliklarla. */
function samplesFromChronological(scoresChronological: number[]): RiskScoreSample[] {
  return scoresChronological
    .map((score, index) => ({ score, calculatedAt: new Date(BASE + index * MINUTE) }))
    .reverse(); // desc (en yeni ilk) - computeTrendEstimate'in bekledigi sira.
}

describe('computeTrendEstimate', () => {
  it('returns RISING with a positive estimatedMinutesToCritical when risk is climbing steadily', () => {
    const result = computeTrendEstimate(samplesFromChronological([40, 47, 55, 63]));
    expect(result.status).toBe(TrendEstimateStatus.RISING);
    expect(result.riskSlopePerMinute).not.toBeNull();
    expect(result.riskSlopePerMinute!).toBeGreaterThan(0);
    expect(result.estimatedMinutesToCritical).not.toBeNull();
    expect(result.estimatedMinutesToCritical!).toBeGreaterThan(0);
    expect(result.quality).not.toBeNull();
  });

  it('returns STABLE ("no critical escalation trend") when risk is flat', () => {
    const result = computeTrendEstimate(samplesFromChronological([20, 20, 20, 20]));
    expect(result.status).toBe(TrendEstimateStatus.STABLE);
    expect(result.message).toBe('No critical escalation trend.');
    expect(result.estimatedMinutesToCritical).toBeNull();
  });

  it('returns STABLE when risk is falling', () => {
    const result = computeTrendEstimate(samplesFromChronological([50, 40, 30, 20]));
    expect(result.status).toBe(TrendEstimateStatus.STABLE);
    expect(result.riskSlopePerMinute!).toBeLessThanOrEqual(0);
    expect(result.estimatedMinutesToCritical).toBeNull();
  });

  it('returns INSUFFICIENT_DATA when there are fewer than the minimum required samples', () => {
    const result = computeTrendEstimate(samplesFromChronological([40, 45]));
    expect(result.status).toBe(TrendEstimateStatus.INSUFFICIENT_DATA);
    expect(result.message).toBe('Insufficient trend data.');
    expect(result.riskSlopePerMinute).toBeNull();
    expect(result.quality).toBeNull();
  });

  it('returns INSUFFICIENT_DATA with no samples at all', () => {
    const result = computeTrendEstimate([]);
    expect(result.status).toBe(TrendEstimateStatus.INSUFFICIENT_DATA);
  });

  it('returns CRITICAL ("critical threshold reached") once the current score is at/above the critical threshold', () => {
    const result = computeTrendEstimate(samplesFromChronological([60, 70, 85]));
    expect(result.status).toBe(TrendEstimateStatus.CRITICAL);
    expect(result.message).toBe('Critical threshold reached.');
    expect(result.estimatedMinutesToCritical).toBeNull();
  });

  it('does not treat a score of 79 as critical (threshold boundary comes from shared RISK_LEVEL_THRESHOLDS, min=80)', () => {
    const result = computeTrendEstimate(samplesFromChronological([70, 74, 79]));
    expect(result.status).not.toBe(TrendEstimateStatus.CRITICAL);
  });

  it('treats a tiny/noisy slope as STABLE instead of producing a ridiculous estimate', () => {
    // 0.01 puan/dakika gibi bir egimle "4800 dakika sonra kritik" gibi
    // anlamsiz bir sonuc URETILMEMELI.
    const samples: RiskScoreSample[] = [
      { score: 10.0, calculatedAt: new Date(BASE) },
      { score: 10.01, calculatedAt: new Date(BASE + MINUTE) },
      { score: 10.02, calculatedAt: new Date(BASE + 2 * MINUTE) },
    ].reverse();
    const result = computeTrendEstimate(samples);
    expect(result.status).toBe(TrendEstimateStatus.STABLE);
    expect(result.estimatedMinutesToCritical).toBeNull();
  });

  it('shows "no near-term critical escalation" when the estimate is beyond the display horizon', () => {
    // Egim gurultu esiginin (1 puan/dk) hemen ustunde (1.2/dk) ama skor hala
    // dusuk oldugu icin kritige ulasmak saatler surer - bu "yakin donemde
    // escalasyon yok" olarak gosterilmeli, saatlerce suren bir countdown
    // olarak degil.
    const samples: RiskScoreSample[] = [
      { score: 1.0, calculatedAt: new Date(BASE) },
      { score: 2.2, calculatedAt: new Date(BASE + MINUTE) },
      { score: 3.4, calculatedAt: new Date(BASE + 2 * MINUTE) },
    ].reverse();
    const result = computeTrendEstimate(samples);
    expect(result.status).toBe(TrendEstimateStatus.STABLE);
    expect(result.message).toBe('No near-term critical escalation.');
    expect(result.estimatedMinutesToCritical).toBeNull();
  });

  it('classifies trend quality deterministically from sample count/duration/consistency', () => {
    // Cok, duzenli, uzun sureli bir pencere -> HIGH.
    const scores = [30, 34, 38, 42, 46, 50, 54, 58];
    const result = computeTrendEstimate(samplesFromChronological(scores));
    expect(result.quality).toBe(TrendQuality.HIGH);
  });

  it('is fully explainable: no reference to ML/AI confidence anywhere in the output', () => {
    const result = computeTrendEstimate(samplesFromChronological([40, 47, 55, 63]));
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain('confidence');
    expect(serialized).not.toContain('%');
  });
});

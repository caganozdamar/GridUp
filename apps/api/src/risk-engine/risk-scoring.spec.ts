import { describe, expect, it } from 'vitest';
import { getRiskLevel, RiskLevel, SensorType } from '@grid-up/shared';
import type { SensorStats } from './risk-math.util.js';
import { computeRiskExplanation } from './risk-scoring.js';

function stats(overrides: Partial<SensorStats>): SensorStats {
  return {
    latest: 0,
    average: 0,
    minimum: 0,
    maximum: 0,
    delta: 0,
    trendPerMinute: 0,
    sampleCount: 10,
    ...overrides,
  };
}

const NORMAL_STATS: Partial<Record<SensorType, SensorStats>> = {
  [SensorType.AMBIENT_TEMPERATURE]: stats({ latest: 28, average: 28 }),
  [SensorType.CABLE_TEMPERATURE]: stats({ latest: 38, average: 37 }),
  [SensorType.HUMIDITY]: stats({ latest: 45, average: 45 }),
  [SensorType.CURRENT]: stats({ latest: 85, average: 85 }),
};

describe('getRiskLevel mapping', () => {
  it('maps score bands to the correct level', () => {
    expect(getRiskLevel(0)).toBe(RiskLevel.NORMAL);
    expect(getRiskLevel(29)).toBe(RiskLevel.NORMAL);
    expect(getRiskLevel(30)).toBe(RiskLevel.WARNING);
    expect(getRiskLevel(59)).toBe(RiskLevel.WARNING);
    expect(getRiskLevel(60)).toBe(RiskLevel.HIGH);
    expect(getRiskLevel(79)).toBe(RiskLevel.HIGH);
    expect(getRiskLevel(80)).toBe(RiskLevel.CRITICAL);
    expect(getRiskLevel(100)).toBe(RiskLevel.CRITICAL);
  });
});

describe('computeRiskExplanation', () => {
  it('always returns a score between 0 and 100, even for extreme inputs', () => {
    const extremeValues = [-1000, -50, 0, 50, 1000, 100000];

    for (const cable of extremeValues) {
      for (const current of extremeValues) {
        for (const humidity of extremeValues) {
          const result = computeRiskExplanation({
            [SensorType.CABLE_TEMPERATURE]: stats({ latest: cable, trendPerMinute: cable }),
            [SensorType.CURRENT]: stats({ latest: current, trendPerMinute: current }),
            [SensorType.HUMIDITY]: stats({ latest: humidity, trendPerMinute: humidity }),
          });
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          expect(result.level).toBe(getRiskLevel(result.score));
        }
      }
    }
  });

  it('returns a low risk score for readings within the normal baseline', () => {
    const result = computeRiskExplanation(NORMAL_STATS);
    expect(result.score).toBeLessThan(30);
    expect(result.level).toBe(RiskLevel.NORMAL);
  });

  it('produces no active flags or anomaly-worthy reasons for normal data', () => {
    const result = computeRiskExplanation(NORMAL_STATS);
    expect(result.flags.highTemperature).toBe(false);
    expect(result.flags.overcurrent).toBe(false);
    expect(result.flags.highHumidity).toBe(false);
    expect(result.flags.multiSensorRisk).toBe(false);
  });

  it('raises the score as cable temperature increases', () => {
    const low = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 40 }),
    });
    const high = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 78 }),
    });

    expect(high.components.temperature).toBeGreaterThan(low.components.temperature);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.flags.highTemperature).toBe(true);
  });

  it('raises the score and flags overcurrent as current increases', () => {
    const low = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CURRENT]: stats({ latest: 90 }),
    });
    const high = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CURRENT]: stats({ latest: 145 }),
    });

    expect(high.components.current).toBeGreaterThan(low.components.current);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.flags.overcurrent).toBe(true);
  });

  it('raises the score and flags high humidity as humidity increases', () => {
    const low = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.HUMIDITY]: stats({ latest: 50 }),
    });
    const high = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.HUMIDITY]: stats({ latest: 78 }),
    });

    expect(high.components.humidity).toBeGreaterThan(low.components.humidity);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.flags.highHumidity).toBe(true);
  });

  it('produces an early-warning trend score for a rapidly rising cable temperature, before it is critical', () => {
    // Latest value (46) is still in the "low/rising" band, but the rate of
    // change is fast -> trend component should already be elevated.
    const result = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 46, trendPerMinute: 50 }),
    });

    expect(result.components.temperature).toBeLessThan(60);
    expect(result.components.trend).toBeGreaterThan(50);
    expect(result.flags.temperatureRise).toBe(true);
    expect(result.reasons).toContain('Cable temperature is rising rapidly');
  });

  it('ignores a falling trend (does not treat cooling as risk)', () => {
    const result = computeRiskExplanation({
      ...NORMAL_STATS,
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 40, trendPerMinute: -5 }),
    });
    expect(result.components.trend).toBe(0);
    expect(result.flags.temperatureRise).toBe(false);
  });

  it('applies a correlation bonus when current and cable temperature rise together', () => {
    const cableOnly = computeRiskExplanation({
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 60 }),
      [SensorType.CURRENT]: stats({ latest: 90 }),
      [SensorType.HUMIDITY]: stats({ latest: 45 }),
    });
    const combined = computeRiskExplanation({
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 60 }),
      [SensorType.CURRENT]: stats({ latest: 135 }),
      [SensorType.HUMIDITY]: stats({ latest: 45 }),
    });

    expect(combined.flags.multiSensorRisk).toBe(true);
    expect(combined.reasons).toContain('Current and cable temperature are rising together');

    // The combined score should be higher than just swapping in the higher
    // current component alone would predict from weights, because of the bonus.
    const currentOnlyDelta = combined.components.current - cableOnly.components.current;
    const weightedDeltaWithoutBonus = currentOnlyDelta * 0.25;
    const actualDelta = combined.score - cableOnly.score;
    expect(actualDelta).toBeGreaterThan(weightedDeltaWithoutBonus);
  });

  it('applies a correlation bonus when humidity and cable temperature are both elevated', () => {
    const withoutHumidity = computeRiskExplanation({
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 62 }),
      [SensorType.CURRENT]: stats({ latest: 85 }),
      [SensorType.HUMIDITY]: stats({ latest: 40 }),
    });
    const withHumidity = computeRiskExplanation({
      [SensorType.CABLE_TEMPERATURE]: stats({ latest: 62 }),
      [SensorType.CURRENT]: stats({ latest: 85 }),
      [SensorType.HUMIDITY]: stats({ latest: 82 }),
    });

    expect(withHumidity.flags.multiSensorRisk).toBe(true);
    expect(withHumidity.reasons.some((reason) => reason.includes('humidity combined with elevated cable'))).toBe(
      true,
    );
    expect(withHumidity.score).toBeGreaterThan(withoutHumidity.score);
  });

  it('falls back to a neutral score when no sensor data is available', () => {
    const result = computeRiskExplanation({});
    expect(result.score).toBe(0);
    expect(result.level).toBe(RiskLevel.NORMAL);
    expect(result.reasons).toContain('All monitored sensors are within normal operating range');
  });
});

import { describe, expect, it } from 'vitest';
import { DataHealthStatus } from '@grid-up/shared';
import { computeDataHealth, type SensorFreshness } from './data-health.util.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const STALE_MS = 10_000;

describe('computeDataHealth', () => {
  it('returns VALID when all sensors have fresh readings', () => {
    const sensors: SensorFreshness[] = [
      { sensorId: 'a', lastReadingAt: new Date(NOW.getTime() - 1000) },
      { sensorId: 'b', lastReadingAt: new Date(NOW.getTime() - 2000) },
    ];
    const health = computeDataHealth(sensors, NOW, STALE_MS);
    expect(health.status).toBe(DataHealthStatus.VALID);
    expect(health.staleSensorCount).toBe(0);
    expect(health.lastSensorUpdate).toBe(new Date(NOW.getTime() - 1000).toISOString());
  });

  it('returns STALE when at least one required sensor reading is older than the threshold', () => {
    const sensors: SensorFreshness[] = [
      { sensorId: 'a', lastReadingAt: new Date(NOW.getTime() - 1000) },
      { sensorId: 'b', lastReadingAt: new Date(NOW.getTime() - STALE_MS - 1) },
    ];
    const health = computeDataHealth(sensors, NOW, STALE_MS);
    expect(health.status).toBe(DataHealthStatus.STALE);
    expect(health.staleSensorCount).toBe(1);
  });

  it('returns NO_DATA when no required reading is available at all', () => {
    const sensors: SensorFreshness[] = [
      { sensorId: 'a', lastReadingAt: null },
      { sensorId: 'b', lastReadingAt: null },
    ];
    const health = computeDataHealth(sensors, NOW, STALE_MS);
    expect(health.status).toBe(DataHealthStatus.NO_DATA);
    expect(health.lastSensorUpdate).toBeNull();
  });

  it('returns NO_DATA when the panel has no sensors at all', () => {
    const health = computeDataHealth([], NOW, STALE_MS);
    expect(health.status).toBe(DataHealthStatus.NO_DATA);
  });

  it('treats the exact staleMs boundary as still fresh', () => {
    const sensors: SensorFreshness[] = [{ sensorId: 'a', lastReadingAt: new Date(NOW.getTime() - STALE_MS) }];
    const health = computeDataHealth(sensors, NOW, STALE_MS);
    expect(health.status).toBe(DataHealthStatus.VALID);
  });

  it('flips VALID -> STALE once the simulator stops and time passes beyond staleMs (no refresh needed)', () => {
    const lastReadingAt = new Date(NOW.getTime());
    const sensors: SensorFreshness[] = [{ sensorId: 'a', lastReadingAt }];

    const whileFresh = computeDataHealth(sensors, new Date(NOW.getTime() + STALE_MS - 1), STALE_MS);
    expect(whileFresh.status).toBe(DataHealthStatus.VALID);

    const afterStale = computeDataHealth(sensors, new Date(NOW.getTime() + STALE_MS + 1), STALE_MS);
    expect(afterStale.status).toBe(DataHealthStatus.STALE);
  });

  it('flips STALE -> VALID once the simulator restarts and a fresh reading arrives', () => {
    const stale = computeDataHealth(
      [{ sensorId: 'a', lastReadingAt: new Date(NOW.getTime() - STALE_MS - 5000) }],
      NOW,
      STALE_MS,
    );
    expect(stale.status).toBe(DataHealthStatus.STALE);

    const recovered = computeDataHealth([{ sensorId: 'a', lastReadingAt: NOW }], NOW, STALE_MS);
    expect(recovered.status).toBe(DataHealthStatus.VALID);
  });
});

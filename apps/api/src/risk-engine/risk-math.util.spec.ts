import { describe, expect, it } from 'vitest';
import { clamp, computeSensorStats, piecewiseLinearScore, type Anchor } from './risk-math.util.js';

describe('clamp', () => {
  it('keeps values inside the range unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps values below the minimum', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('clamps values above the maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
});

describe('piecewiseLinearScore', () => {
  const anchors: Anchor[] = [
    [30, 0],
    [45, 20],
    [55, 50],
    [65, 75],
    [75, 92],
    [85, 100],
  ];

  it('clamps to the first score below the first anchor', () => {
    expect(piecewiseLinearScore(0, anchors)).toBe(0);
    expect(piecewiseLinearScore(30, anchors)).toBe(0);
  });

  it('clamps to the last score above the last anchor', () => {
    expect(piecewiseLinearScore(85, anchors)).toBe(100);
    expect(piecewiseLinearScore(200, anchors)).toBe(100);
  });

  it('interpolates linearly between two anchors', () => {
    // Halfway between (45, 20) and (55, 50) => 35.
    expect(piecewiseLinearScore(50, anchors)).toBeCloseTo(35, 5);
  });

  it('does not produce a large jump across a band boundary', () => {
    const below = piecewiseLinearScore(54.9, anchors);
    const above = piecewiseLinearScore(55.1, anchors);
    expect(Math.abs(above - below)).toBeLessThan(1);
  });

  it('returns 0 for an empty anchor list', () => {
    expect(piecewiseLinearScore(42, [])).toBe(0);
  });
});

describe('computeSensorStats', () => {
  function reading(value: number, secondsFromStart: number, start = 0) {
    return { value, timestamp: new Date(start + secondsFromStart * 1000) };
  }

  it('returns null for an empty window', () => {
    expect(computeSensorStats([])).toBeNull();
  });

  it('computes latest/average/min/max/delta from a chronological window', () => {
    // Newest-first order, as Prisma's `orderBy: { timestamp: 'desc' }` returns.
    const readingsDesc = [reading(46, 40), reading(43, 30), reading(41, 20), reading(39, 10), reading(38, 0)];

    const stats = computeSensorStats(readingsDesc)!;
    expect(stats.latest).toBe(46);
    expect(stats.minimum).toBe(38);
    expect(stats.maximum).toBe(46);
    expect(stats.delta).toBe(8);
    expect(stats.average).toBeCloseTo((46 + 43 + 41 + 39 + 38) / 5, 5);
    expect(stats.sampleCount).toBe(5);
  });

  it('computes a positive trendPerMinute for a rising series', () => {
    // 8 degree rise over 40 seconds => 12 degrees/minute.
    const readingsDesc = [reading(46, 40), reading(38, 0)];
    const stats = computeSensorStats(readingsDesc)!;
    expect(stats.trendPerMinute).toBeCloseTo(12, 1);
  });

  it('treats a near-zero duration window as flat instead of dividing by ~0', () => {
    const readingsDesc = [reading(50, 0), reading(38, 0)];
    const stats = computeSensorStats(readingsDesc)!;
    expect(stats.trendPerMinute).toBe(0);
    expect(Number.isFinite(stats.trendPerMinute)).toBe(true);
  });

  it('handles a single-reading window', () => {
    const stats = computeSensorStats([reading(42, 0)])!;
    expect(stats.latest).toBe(42);
    expect(stats.delta).toBe(0);
    expect(stats.trendPerMinute).toBe(0);
  });
});

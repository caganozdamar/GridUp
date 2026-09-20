import { afterEach, describe, expect, it } from 'vitest';
import { alarmPolicy } from './alarm-policy.config.js';

describe('alarmPolicy', () => {
  afterEach(() => {
    delete process.env.ALARM_RESOLVE_AFTER_TICKS;
    delete process.env.MODULE_OFFLINE_AFTER_MS;
    delete process.env.MODULE_OFFLINE_CHECK_INTERVAL_MS;
  });

  it('has defaults: 5 calm ticks, offline after 60 s, checked every 15 s', () => {
    expect(alarmPolicy()).toEqual({ resolveAfterTicks: 5, moduleOfflineAfterMs: 60_000, moduleOfflineCheckIntervalMs: 15_000 });
  });

  it('reads overrides from the environment', () => {
    process.env.ALARM_RESOLVE_AFTER_TICKS = '3';
    process.env.MODULE_OFFLINE_AFTER_MS = '90000';
    process.env.MODULE_OFFLINE_CHECK_INTERVAL_MS = '0';
    expect(alarmPolicy()).toEqual({ resolveAfterTicks: 3, moduleOfflineAfterMs: 90_000, moduleOfflineCheckIntervalMs: 0 });
  });

  it('never lets the resolve window drop below one tick', () => {
    process.env.ALARM_RESOLVE_AFTER_TICKS = '0';
    expect(alarmPolicy().resolveAfterTicks).toBe(1);
  });
});

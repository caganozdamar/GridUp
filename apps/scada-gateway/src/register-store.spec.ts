import { describe, expect, it } from 'vitest';
import { getRegisterStartAddress } from './register-map.js';
import { RegisterStore } from './register-store.js';
import type { ScadaPanelSnapshot } from './types.js';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const STALE_MS = 10_000;

function snapshot(overrides: Partial<ScadaPanelSnapshot> = {}): ScadaPanelSnapshot {
  return {
    panelCode: 'PANO-003',
    panelStatus: 'ONLINE',
    online: true,
    riskScore: 94,
    riskLevel: 'CRITICAL',
    ambientTemperature: 28.1,
    cableTemperature: 81.4,
    humidity: 76.2,
    current: 168.4,
    activeAlarm: true,
    activeAnomalyCount: 4,
    lastReadingAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('RegisterStore', () => {
  it('writes a panel snapshot into its own 10-register block and leaves others at 0', () => {
    const store = new RegisterStore();
    store.updateSnapshots([snapshot()]);
    store.recompute(NOW, STALE_MS);

    const start = getRegisterStartAddress(2); // PANO-003
    expect(store.readRegister(start)).toBe(94); // risk score
    expect(store.readRegister(start + 1)).toBe(3); // CRITICAL

    // Neighbouring block (PANO-002) untouched.
    const neighbourStart = getRegisterStartAddress(1);
    for (let i = 0; i < 10; i++) {
      expect(store.readRegister(neighbourStart + i)).toBe(0);
    }
  });

  it('reports and skips panel codes that do not fit the Modbus mapping', () => {
    const store = new RegisterStore();
    const newlyUnsupported = store.updateSnapshots([snapshot({ panelCode: 'PANO-101' })]);
    expect(newlyUnsupported).toEqual(['PANO-101']);
    expect(store.knownPanelCount).toBe(0);

    // Reported only once across repeated ticks with the same unknown code.
    const second = store.updateSnapshots([snapshot({ panelCode: 'PANO-101' })]);
    expect(second).toEqual([]);
  });

  it('flips data quality to INVALID once the cached reading goes stale, without any new fetch', () => {
    const store = new RegisterStore();
    store.updateSnapshots([snapshot({ lastReadingAt: new Date(NOW).toISOString() })]);

    store.recompute(NOW, STALE_MS);
    const start = getRegisterStartAddress(2);
    expect(store.readRegister(start + 9)).toBe(1); // VALID

    // Simulator stopped: no new updateSnapshots call, only wall-clock advances.
    store.recompute(NOW + STALE_MS + 1, STALE_MS);
    expect(store.readRegister(start + 9)).toBe(0); // INVALID
  });

  it('recovers to VALID once fresh data arrives again', () => {
    const store = new RegisterStore();
    store.updateSnapshots([snapshot({ lastReadingAt: new Date(NOW).toISOString() })]);
    store.recompute(NOW + STALE_MS + 1, STALE_MS);

    const start = getRegisterStartAddress(2);
    expect(store.readRegister(start + 9)).toBe(0); // INVALID after stale window

    const recoveredAt = NOW + STALE_MS + 5_000;
    store.updateSnapshots([snapshot({ lastReadingAt: new Date(recoveredAt).toISOString() })]);
    store.recompute(recoveredAt, STALE_MS);
    expect(store.readRegister(start + 9)).toBe(1); // VALID again
  });

  it('returns 0 for out-of-range register addresses instead of throwing', () => {
    const store = new RegisterStore();
    expect(store.readRegister(-1)).toBe(0);
    expect(store.readRegister(999_999)).toBe(0);
  });
});

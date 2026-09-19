import { describe, expect, it } from 'vitest';
import { encodePanelRegisters, isSnapshotFresh } from './encode.js';
import { MODBUS_BOOL, MODBUS_DATA_QUALITY, MODBUS_PANEL_STATUS, MODBUS_RISK_LEVEL, RegisterOffset } from './register-map.js';
import type { ScadaPanelSnapshot } from './types.js';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const STALE_MS = 10_000;

function baseSnapshot(overrides: Partial<ScadaPanelSnapshot> = {}): ScadaPanelSnapshot {
  return {
    panelCode: 'PANO-003',
    panelStatus: 'ONLINE',
    online: true,
    riskScore: 12,
    riskLevel: 'NORMAL',
    ambientTemperature: 27.4,
    cableTemperature: 36.8,
    humidity: 44.1,
    current: 82.6,
    activeAlarm: false,
    activeAnomalyCount: 0,
    lastReadingAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('encodePanelRegisters', () => {
  it('scales decimal sensor values by x10 and rounds', () => {
    const registers = encodePanelRegisters(baseSnapshot(), NOW, STALE_MS);
    expect(registers[RegisterOffset.AMBIENT_TEMPERATURE_X10]).toBe(274);
    expect(registers[RegisterOffset.CABLE_TEMPERATURE_X10]).toBe(368);
    expect(registers[RegisterOffset.HUMIDITY_X10]).toBe(441);
    expect(registers[RegisterOffset.CURRENT_X10]).toBe(826);
  });

  it('maps risk level enums to the documented Modbus integers', () => {
    expect(encodePanelRegisters(baseSnapshot({ riskLevel: 'NORMAL' }), NOW, STALE_MS)[RegisterOffset.RISK_LEVEL]).toBe(
      MODBUS_RISK_LEVEL.NORMAL,
    );
    expect(encodePanelRegisters(baseSnapshot({ riskLevel: 'WARNING' }), NOW, STALE_MS)[RegisterOffset.RISK_LEVEL]).toBe(
      MODBUS_RISK_LEVEL.WARNING,
    );
    expect(encodePanelRegisters(baseSnapshot({ riskLevel: 'HIGH' }), NOW, STALE_MS)[RegisterOffset.RISK_LEVEL]).toBe(
      MODBUS_RISK_LEVEL.HIGH,
    );
    expect(
      encodePanelRegisters(baseSnapshot({ riskLevel: 'CRITICAL' }), NOW, STALE_MS)[RegisterOffset.RISK_LEVEL],
    ).toBe(MODBUS_RISK_LEVEL.CRITICAL);
  });

  it('maps panel status enums to the documented Modbus integers', () => {
    expect(
      encodePanelRegisters(baseSnapshot({ panelStatus: 'OFFLINE' }), NOW, STALE_MS)[RegisterOffset.PANEL_STATUS],
    ).toBe(MODBUS_PANEL_STATUS.OFFLINE);
    expect(
      encodePanelRegisters(baseSnapshot({ panelStatus: 'ONLINE' }), NOW, STALE_MS)[RegisterOffset.PANEL_STATUS],
    ).toBe(MODBUS_PANEL_STATUS.ONLINE);
    expect(
      encodePanelRegisters(baseSnapshot({ panelStatus: 'MAINTENANCE' }), NOW, STALE_MS)[RegisterOffset.PANEL_STATUS],
    ).toBe(MODBUS_PANEL_STATUS.MAINTENANCE);
  });

  it('clamps risk score to 0-100', () => {
    expect(encodePanelRegisters(baseSnapshot({ riskScore: 142 }), NOW, STALE_MS)[RegisterOffset.RISK_SCORE]).toBe(100);
    expect(encodePanelRegisters(baseSnapshot({ riskScore: -7 }), NOW, STALE_MS)[RegisterOffset.RISK_SCORE]).toBe(0);
    expect(encodePanelRegisters(baseSnapshot({ riskScore: null }), NOW, STALE_MS)[RegisterOffset.RISK_SCORE]).toBe(0);
  });

  it('never writes NaN/Infinity into a register, defaulting to 0 instead', () => {
    const registers = encodePanelRegisters(
      baseSnapshot({ cableTemperature: Number.NaN, current: Number.POSITIVE_INFINITY, riskScore: Number.NaN }),
      NOW,
      STALE_MS,
    );
    expect(Number.isFinite(registers[RegisterOffset.CABLE_TEMPERATURE_X10])).toBe(true);
    expect(registers[RegisterOffset.CABLE_TEMPERATURE_X10]).toBe(0);
    expect(registers[RegisterOffset.CURRENT_X10]).toBe(0);
    expect(registers[RegisterOffset.RISK_SCORE]).toBe(0);
    expect(registers.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('maps activeAlarm boolean to 0/1', () => {
    expect(encodePanelRegisters(baseSnapshot({ activeAlarm: true }), NOW, STALE_MS)[RegisterOffset.ACTIVE_ALARM]).toBe(
      MODBUS_BOOL.YES,
    );
    expect(
      encodePanelRegisters(baseSnapshot({ activeAlarm: false }), NOW, STALE_MS)[RegisterOffset.ACTIVE_ALARM],
    ).toBe(MODBUS_BOOL.NO);
  });

  it('marks data quality VALID when the last reading is within the stale threshold', () => {
    const fresh = baseSnapshot({ lastReadingAt: new Date(NOW - 5_000).toISOString() });
    expect(encodePanelRegisters(fresh, NOW, STALE_MS)[RegisterOffset.DATA_QUALITY]).toBe(MODBUS_DATA_QUALITY.VALID);
  });

  it('marks data quality INVALID once the last reading exceeds the stale threshold', () => {
    const stale = baseSnapshot({ lastReadingAt: new Date(NOW - 15_000).toISOString() });
    expect(encodePanelRegisters(stale, NOW, STALE_MS)[RegisterOffset.DATA_QUALITY]).toBe(
      MODBUS_DATA_QUALITY.INVALID,
    );
  });

  it('marks data quality INVALID when there is no reading at all', () => {
    const noData = baseSnapshot({ lastReadingAt: null });
    expect(encodePanelRegisters(noData, NOW, STALE_MS)[RegisterOffset.DATA_QUALITY]).toBe(
      MODBUS_DATA_QUALITY.INVALID,
    );
  });
});

describe('isSnapshotFresh', () => {
  it('returns false for null timestamps', () => {
    expect(isSnapshotFresh(null, NOW, STALE_MS)).toBe(false);
  });

  it('is inclusive at exactly the stale threshold', () => {
    expect(isSnapshotFresh(new Date(NOW - STALE_MS).toISOString(), NOW, STALE_MS)).toBe(true);
    expect(isSnapshotFresh(new Date(NOW - STALE_MS - 1).toISOString(), NOW, STALE_MS)).toBe(false);
  });
});

import {
  MODBUS_BOOL,
  MODBUS_DATA_QUALITY,
  MODBUS_PANEL_STATUS,
  MODBUS_RISK_LEVEL,
  REGISTERS_PER_PANEL,
  RegisterOffset,
} from './register-map.js';
import type { ApiPanelStatus, ApiRiskLevel, ScadaPanelSnapshot } from './types.js';

const UINT16_MAX = 65535;

/** NaN/Infinity/negatif gibi guvensiz degerleri 0-65535 araligina sikistirir. */
function clampUint16(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(UINT16_MAX, Math.max(0, Math.round(value)));
}

/** Risk score'u 0-100 araligina sikistirir (Asama 7 madde 6). */
function clampRiskScore(score: number | null): number {
  if (score === null || !Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** °C / % / A gibi ondalikli degerleri x10 olceklendirir (27.4 -> 274). */
function scaleX10(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return clampUint16(value * 10);
}

function encodeRiskLevel(level: ApiRiskLevel | null): number {
  if (level === null) return MODBUS_RISK_LEVEL.NORMAL;
  return MODBUS_RISK_LEVEL[level] ?? MODBUS_RISK_LEVEL.NORMAL;
}

function encodePanelStatus(status: ApiPanelStatus): number {
  return MODBUS_PANEL_STATUS[status] ?? MODBUS_PANEL_STATUS.OFFLINE;
}

/**
 * Bir panonun sensor verisi "taze" mi? lastReadingAt bilinmiyorsa (hic
 * reading gelmemis) ya da SCADA_DATA_STALE_MS'den daha eskiyse veri
 * INVALID sayilir (Asama 7 madde 7).
 */
export function isSnapshotFresh(lastReadingAt: string | null, now: number, staleMs: number): boolean {
  if (lastReadingAt === null) return false;
  const readingTime = Date.parse(lastReadingAt);
  if (Number.isNaN(readingTime)) return false;
  return now - readingTime <= staleMs;
}

/**
 * Bir panelin snapshot'ini 10 elemanlik holding register dizisine cevirir.
 * Register offset'leri register-map.ts'te merkezi olarak tanimlidir.
 */
export function encodePanelRegisters(snapshot: ScadaPanelSnapshot, now: number, staleMs: number): number[] {
  const registers = Array.from<number>({ length: REGISTERS_PER_PANEL }).fill(0);

  registers[RegisterOffset.RISK_SCORE] = clampRiskScore(snapshot.riskScore);
  registers[RegisterOffset.RISK_LEVEL] = encodeRiskLevel(snapshot.riskLevel);
  registers[RegisterOffset.AMBIENT_TEMPERATURE_X10] = scaleX10(snapshot.ambientTemperature);
  registers[RegisterOffset.CABLE_TEMPERATURE_X10] = scaleX10(snapshot.cableTemperature);
  registers[RegisterOffset.HUMIDITY_X10] = scaleX10(snapshot.humidity);
  registers[RegisterOffset.CURRENT_X10] = scaleX10(snapshot.current);
  registers[RegisterOffset.ACTIVE_ALARM] = snapshot.activeAlarm ? MODBUS_BOOL.YES : MODBUS_BOOL.NO;
  registers[RegisterOffset.PANEL_STATUS] = encodePanelStatus(snapshot.panelStatus);
  registers[RegisterOffset.ACTIVE_ANOMALY_COUNT] = clampUint16(snapshot.activeAnomalyCount);
  registers[RegisterOffset.DATA_QUALITY] = isSnapshotFresh(snapshot.lastReadingAt, now, staleMs)
    ? MODBUS_DATA_QUALITY.VALID
    : MODBUS_DATA_QUALITY.INVALID;

  return registers;
}

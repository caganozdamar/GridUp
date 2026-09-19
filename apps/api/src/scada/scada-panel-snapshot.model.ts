import type { PanelStatus, RiskLevel } from '@prisma/client';

/**
 * GET /scada/panels response sekli. Sadece Asama 7 (SCADA/Modbus gateway)
 * icin var olan Panel/Sensor/RiskScore/Alarm/Anomaly verisini birlestiren
 * bir "read model" DTO'sudur; hicbir Prisma modelini degistirmez.
 */
export interface ScadaPanelSnapshot {
  panelCode: string;
  panelStatus: PanelStatus;
  online: boolean;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  ambientTemperature: number | null;
  cableTemperature: number | null;
  humidity: number | null;
  current: number | null;
  /** Ark flash optik yogunlugu (%), sensor yoksa null. */
  arcFlash: number | null;
  /** Akustik seviye (dB), sensor yoksa null. */
  acoustic: number | null;
  /** Aktif (resolve edilmemis) ARC_FLASH anomalisi var mi. */
  arcFlashActive: boolean;
  /** Aktif (resolve edilmemis) PARTIAL_DISCHARGE anomalisi var mi. */
  partialDischargeActive: boolean;
  activeAlarm: boolean;
  activeAnomalyCount: number;
  /** Bu panonun sensorlerinden gelen en guncel reading'in ISO timestamp'i (yoksa null). SCADA Gateway staleness hesabi icin kullanilir. */
  lastReadingAt: string | null;
}

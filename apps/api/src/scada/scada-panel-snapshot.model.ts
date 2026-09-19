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
  activeAlarm: boolean;
  activeAnomalyCount: number;
  /** Bu panonun sensorlerinden gelen en guncel reading'in ISO timestamp'i (yoksa null). SCADA Gateway staleness hesabi icin kullanilir. */
  lastReadingAt: string | null;
}

// GET /scada/panels response sekli (bkz. apps/api/src/scada/scada-panel-snapshot.model.ts).
// Simulator'daki ApiPanel/ApiSensor pattern'inde oldugu gibi, gateway bu tipi
// kendi basina, @grid-up/shared'a bagimli olmadan tanimlar.
export type ApiPanelStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
export type ApiRiskLevel = 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface ScadaPanelSnapshot {
  panelCode: string;
  panelStatus: ApiPanelStatus;
  online: boolean;
  riskScore: number | null;
  riskLevel: ApiRiskLevel | null;
  ambientTemperature: number | null;
  cableTemperature: number | null;
  humidity: number | null;
  current: number | null;
  activeAlarm: boolean;
  activeAnomalyCount: number;
  lastReadingAt: string | null;
}

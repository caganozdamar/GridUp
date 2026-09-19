import type { RiskScore } from './risk';
import type { Sensor } from './sensor';

export enum PanelStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
}

export interface Panel {
  id: string;
  siteId: string;
  name: string;
  code: string;
  description: string | null;
  status: PanelStatus;
  createdAt: string;
  updatedAt: string;
}

// Asama 5: GET /panels ve GET /panels/:id response sekilleri.
export interface PanelSite {
  id: string;
  name: string;
  code: string;
}

export interface PanelSummary extends Panel {
  site: PanelSite;
  sensorCount: number;
  latestRiskScore: RiskScore | null;
  activeAlarmCount: number;
}

export interface PanelDetail extends PanelSummary {
  sensors: Sensor[];
}

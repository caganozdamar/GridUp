import { Severity } from './anomaly';

export enum AlarmStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum AlarmKind {
  RISK = 'RISK',
  MODULE_OFFLINE = 'MODULE_OFFLINE',
}

export interface Alarm {
  id: string;
  panelId: string;
  anomalyId: string | null;
  severity: Severity;
  title: string;
  message: string;
  kind: AlarmKind;
  status: AlarmStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

// Asama 5: GET /alarms (global) response sekli - panel/site bilgisiyle birlikte.
export interface AlarmWithPanel extends Alarm {
  panel: {
    id: string;
    code: string;
    name: string;
    site: {
      id: string;
      code: string;
      name: string;
    };
  };
}

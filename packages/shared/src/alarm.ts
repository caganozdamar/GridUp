import { Severity } from './anomaly';

export enum AlarmStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export interface Alarm {
  id: string;
  panelId: string;
  anomalyId: string | null;
  severity: Severity;
  title: string;
  message: string;
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

// Asama 9: decision support / early warning intelligence DTO'lari.
// Bu dosya yalnizca API response sekilleridir; risk score formulu,
// threshold'lari veya anomaly/alarm lifecycle'ini degistirmez (bkz.
// docs/decision-support.md).

import type { AnomalyType, Severity } from './anomaly';
import type { RiskLevel } from './risk';
import type { NotificationChannel } from './notification';

// ---------- A) Time-to-Critical (trend-based estimate) ----------

export enum TrendEstimateStatus {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  STABLE = 'STABLE',
  RISING = 'RISING',
  CRITICAL = 'CRITICAL',
}

export enum TrendQuality {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface TrendEstimate {
  status: TrendEstimateStatus;
  riskSlopePerMinute: number | null;
  estimatedMinutesToCritical: number | null;
  message: string;
  quality: TrendQuality | null;
}

// ---------- B) Recommended actions ----------

export enum ActionPriority {
  ROUTINE = 'ROUTINE',
  PROMPT = 'PROMPT',
  URGENT = 'URGENT',
}

export interface RecommendedAction {
  source: AnomalyType;
  priority: ActionPriority;
  message: string;
}

// ---------- C) Sensor / panel data health ----------

export enum DataHealthStatus {
  VALID = 'VALID',
  STALE = 'STALE',
  NO_DATA = 'NO_DATA',
}

export interface PanelDataHealth {
  status: DataHealthStatus;
  lastSensorUpdate: string | null;
  staleSensorCount: number;
}

// ---------- D) Panel event timeline ----------

export enum TimelineEventType {
  RISK_LEVEL_CHANGED = 'RISK_LEVEL_CHANGED',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  ANOMALY_RESOLVED = 'ANOMALY_RESOLVED',
  ALARM_CREATED = 'ALARM_CREATED',
  ALARM_ACKNOWLEDGED = 'ALARM_ACKNOWLEDGED',
  ALARM_RESOLVED = 'ALARM_RESOLVED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
}

export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: string;
  title: string;
  detail: string;
  level?: RiskLevel;
  previousLevel?: RiskLevel;
  severity?: Severity;
  anomalyType?: AnomalyType;
  channel?: NotificationChannel;
}

export interface PanelTimelineResponse {
  panelId: string;
  events: TimelineEvent[];
}

// ---------- E) Operational / early warning metrics ----------

export interface OperationalMetrics {
  earlyWarningsGenerated: number;
  criticalEscalationsDetected: number;
  notificationsDelivered: number;
}

// Asama 9 madde 15-19: Panel Event Timeline.
//
// Yeni bir event database modeli YOKTUR. Mevcut RiskScore / Anomaly / Alarm /
// Notification kayitlarindan (zaten persist edilen veri) chronological bir
// event listesi turetilir - bu saf, side-effect'siz bir fonksiyondur.

import {
  type AnomalyType,
  type NotificationChannel,
  NotificationStatus,
  type RiskLevel,
  type Severity,
  TimelineEventType,
  type TimelineEvent,
} from '@grid-up/shared';

export interface RiskScoreRow {
  score: number;
  level: RiskLevel;
  calculatedAt: Date;
}

export interface AnomalyRow {
  type: AnomalyType;
  severity: Severity;
  message: string;
  detectedAt: Date;
  resolvedAt: Date | null;
}

export interface AlarmRow {
  severity: Severity;
  title: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface NotificationRow {
  channel: NotificationChannel;
  status: NotificationStatus;
  createdAt: Date;
  sentAt: Date | null;
}

export interface TimelineSourceData {
  riskScores: RiskScoreRow[];
  anomalies: AnomalyRow[];
  alarms: AlarmRow[];
  notifications: NotificationRow[];
}

/**
 * Ayni level'daki her RiskScore kaydini degil, yalnizca gercek
 * transition'lari (Asama 9 madde 17) event'e cevirir. Ilk kayit icin
 * "onceki seviye" bilinmedigi icin bir transition uretilmez.
 */
function riskLevelTransitionEvents(riskScoresDesc: RiskScoreRow[]): TimelineEvent[] {
  const chronological = [...riskScoresDesc].sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime());
  const events: TimelineEvent[] = [];
  let previousLevel: RiskLevel | null = null;

  for (const row of chronological) {
    if (previousLevel !== null && row.level !== previousLevel) {
      events.push({
        type: TimelineEventType.RISK_LEVEL_CHANGED,
        timestamp: row.calculatedAt.toISOString(),
        title: `Risk level changed ${previousLevel} → ${row.level}`,
        detail: `Risk score reached ${row.score}`,
        level: row.level,
        previousLevel,
      });
    }
    previousLevel = row.level;
  }

  return events;
}

function anomalyEvents(anomalies: AnomalyRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const anomaly of anomalies) {
    events.push({
      type: TimelineEventType.ANOMALY_DETECTED,
      timestamp: anomaly.detectedAt.toISOString(),
      title: 'Anomaly detected',
      detail: anomaly.message,
      severity: anomaly.severity,
      anomalyType: anomaly.type,
    });
    if (anomaly.resolvedAt) {
      events.push({
        type: TimelineEventType.ANOMALY_RESOLVED,
        timestamp: anomaly.resolvedAt.toISOString(),
        title: 'Anomaly resolved',
        detail: anomaly.message,
        severity: anomaly.severity,
        anomalyType: anomaly.type,
      });
    }
  }
  return events;
}

function alarmEvents(alarms: AlarmRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const alarm of alarms) {
    events.push({
      type: TimelineEventType.ALARM_CREATED,
      timestamp: alarm.createdAt.toISOString(),
      title: 'Alarm created',
      detail: alarm.title,
      severity: alarm.severity,
    });
    if (alarm.resolvedAt) {
      events.push({
        type: TimelineEventType.ALARM_RESOLVED,
        timestamp: alarm.resolvedAt.toISOString(),
        title: 'Alarm resolved',
        detail: alarm.title,
        severity: alarm.severity,
      });
    }
  }
  return events;
}

/** PENDING bildirimler henuz teslim edilmedigi/basarisiz olmadigi icin gosterilmez. */
function notificationEvents(notifications: NotificationRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const notification of notifications) {
    if (notification.status === NotificationStatus.SENT) {
      events.push({
        type: TimelineEventType.NOTIFICATION_SENT,
        timestamp: (notification.sentAt ?? notification.createdAt).toISOString(),
        title: 'Notification sent',
        detail: `${notification.channel} notification delivered`,
        channel: notification.channel,
      });
    } else if (notification.status === NotificationStatus.FAILED) {
      events.push({
        type: TimelineEventType.NOTIFICATION_FAILED,
        timestamp: notification.createdAt.toISOString(),
        title: 'Notification failed',
        detail: `${notification.channel} notification failed to send`,
        channel: notification.channel,
      });
    }
  }
  return events;
}

export function deriveTimeline(source: TimelineSourceData, limit: number): TimelineEvent[] {
  const events = [
    ...riskLevelTransitionEvents(source.riskScores),
    ...anomalyEvents(source.anomalies),
    ...alarmEvents(source.alarms),
    ...notificationEvents(source.notifications),
  ];

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}

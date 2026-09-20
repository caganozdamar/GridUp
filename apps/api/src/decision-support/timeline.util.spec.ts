import { describe, expect, it } from 'vitest';
import { AnomalyType, NotificationChannel, NotificationStatus, RiskLevel, Severity, TimelineEventType } from '@grid-up/shared';
import { deriveTimeline, type AlarmRow, type AnomalyRow, type NotificationRow, type RiskScoreRow } from './timeline.util.js';

const BASE = new Date('2026-01-01T00:00:00.000Z').getTime();
const SEC = 1000;
const at = (offsetSeconds: number) => new Date(BASE + offsetSeconds * SEC);

describe('deriveTimeline', () => {
  it('emits only real RISK_LEVEL_CHANGED transitions, not one per same-level sample', () => {
    const riskScores: RiskScoreRow[] = [
      { score: 5, level: RiskLevel.NORMAL, calculatedAt: at(0) },
      { score: 8, level: RiskLevel.NORMAL, calculatedAt: at(2) },
      { score: 34, level: RiskLevel.WARNING, calculatedAt: at(4) },
      { score: 38, level: RiskLevel.WARNING, calculatedAt: at(6) },
      { score: 64, level: RiskLevel.HIGH, calculatedAt: at(8) },
      { score: 68, level: RiskLevel.HIGH, calculatedAt: at(10) },
      { score: 87, level: RiskLevel.CRITICAL, calculatedAt: at(12) },
    ];

    const events = deriveTimeline({ riskScores, anomalies: [], alarms: [], notifications: [] }, 30);
    const transitions = events.filter((event) => event.type === TimelineEventType.RISK_LEVEL_CHANGED);

    expect(transitions).toHaveLength(3);
    // Newest-first (Asama 9 madde 18).
    expect(transitions.map((event) => `${event.previousLevel}->${event.level}`)).toEqual([
      'HIGH->CRITICAL',
      'WARNING->HIGH',
      'NORMAL->WARNING',
    ]);
  });

  it('includes anomaly detected/resolved, alarm created/resolved and notification sent/failed events', () => {
    const anomalies: AnomalyRow[] = [
      {
        type: AnomalyType.HIGH_TEMPERATURE,
        severity: Severity.HIGH,
        message: 'Cable temperature has reached a high-risk level',
        detectedAt: at(0),
        resolvedAt: at(20),
      },
    ];
    const alarms: AlarmRow[] = [
      { severity: Severity.CRITICAL, title: 'Critical overheating risk detected', createdAt: at(5), resolvedAt: at(25) },
    ];
    const notifications: NotificationRow[] = [
      { channel: NotificationChannel.SMS, status: NotificationStatus.SENT, createdAt: at(6), sentAt: at(7) },
      { channel: NotificationChannel.WHATSAPP, status: NotificationStatus.FAILED, createdAt: at(6), sentAt: null },
      { channel: NotificationChannel.SMS, status: NotificationStatus.PENDING, createdAt: at(6), sentAt: null },
    ];

    const events = deriveTimeline({ riskScores: [], anomalies, alarms, notifications }, 30);
    const types = events.map((event) => event.type);

    expect(types).toContain(TimelineEventType.ANOMALY_DETECTED);
    expect(types).toContain(TimelineEventType.ANOMALY_RESOLVED);
    expect(types).toContain(TimelineEventType.ALARM_CREATED);
    expect(types).toContain(TimelineEventType.ALARM_RESOLVED);
    expect(types).toContain(TimelineEventType.NOTIFICATION_SENT);
    expect(types).toContain(TimelineEventType.NOTIFICATION_FAILED);
    // PENDING bildirim bir event olarak gorunmemeli.
    expect(events.filter((event) => event.channel === NotificationChannel.SMS)).toHaveLength(1);
  });

  it('adds an acknowledge event between the alarm being created and resolved', () => {
    const alarms: AlarmRow[] = [
      { severity: Severity.HIGH, title: 'Elevated overheating risk detected', createdAt: at(0), acknowledgedAt: at(5), resolvedAt: at(20) },
    ];

    const events = deriveTimeline({ riskScores: [], anomalies: [], alarms, notifications: [] }, 30);

    expect(events.map((event) => event.type)).toEqual([
      TimelineEventType.ALARM_RESOLVED,
      TimelineEventType.ALARM_ACKNOWLEDGED,
      TimelineEventType.ALARM_CREATED,
    ]);
    expect(events[1].title).toBe('Alarm acknowledged');
  });

  it('orders all events newest-first regardless of source table', () => {
    const riskScores: RiskScoreRow[] = [
      { score: 10, level: RiskLevel.NORMAL, calculatedAt: at(0) },
      { score: 40, level: RiskLevel.WARNING, calculatedAt: at(10) },
    ];
    const alarms: AlarmRow[] = [{ severity: Severity.HIGH, title: 'Elevated risk detected', createdAt: at(5), resolvedAt: null }];

    const events = deriveTimeline({ riskScores, anomalies: [], alarms, notifications: [] }, 30);
    const timestamps = events.map((event) => new Date(event.timestamp).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it('respects the requested limit', () => {
    const riskScores: RiskScoreRow[] = [
      { score: 10, level: RiskLevel.NORMAL, calculatedAt: at(0) },
      { score: 34, level: RiskLevel.WARNING, calculatedAt: at(2) },
      { score: 64, level: RiskLevel.HIGH, calculatedAt: at(4) },
      { score: 87, level: RiskLevel.CRITICAL, calculatedAt: at(6) },
    ];
    const events = deriveTimeline({ riskScores, anomalies: [], alarms: [], notifications: [] }, 2);
    expect(events).toHaveLength(2);
    // En yeni 2 transition kalmali.
    expect(events[0].previousLevel).toBe(RiskLevel.HIGH);
    expect(events[1].previousLevel).toBe(RiskLevel.WARNING);
  });
});

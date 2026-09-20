import { TimelineEventType, type TimelineEvent } from '@grid-up/shared';
import { formatDateTime } from '../../utils/status';

const TYPE_LABEL: Record<TimelineEventType, string> = {
  [TimelineEventType.RISK_LEVEL_CHANGED]: 'RISK',
  [TimelineEventType.ANOMALY_DETECTED]: 'ANOMALY',
  [TimelineEventType.ANOMALY_RESOLVED]: 'ANOMALY',
  [TimelineEventType.ALARM_CREATED]: 'ALARM',
  [TimelineEventType.ALARM_RESOLVED]: 'ALARM',
  [TimelineEventType.NOTIFICATION_SENT]: 'NOTIFY',
  [TimelineEventType.NOTIFICATION_FAILED]: 'NOTIFY',
};

const TYPE_CLASS: Record<TimelineEventType, string> = {
  [TimelineEventType.RISK_LEVEL_CHANGED]: 'timeline-tag-risk',
  [TimelineEventType.ANOMALY_DETECTED]: 'timeline-tag-anomaly',
  [TimelineEventType.ANOMALY_RESOLVED]: 'timeline-tag-anomaly',
  [TimelineEventType.ALARM_CREATED]: 'timeline-tag-alarm',
  [TimelineEventType.ALARM_RESOLVED]: 'timeline-tag-alarm',
  [TimelineEventType.NOTIFICATION_SENT]: 'timeline-tag-notify',
  [TimelineEventType.NOTIFICATION_FAILED]: 'timeline-tag-notify',
};

/** Asama 9 madde 15-19: compact, enterprise-style event log (newest-first). */
export function PanelTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="empty-hint">No events recorded yet.</p>;
  }

  return (
    <ul className="timeline-list">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.timestamp}-${index}`} className="timeline-row">
          <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
          <span className={`timeline-tag ${TYPE_CLASS[event.type]}`}>{TYPE_LABEL[event.type]}</span>
          <span className="timeline-detail">
            <span className="timeline-title">{event.title}</span>
            <span className="timeline-subtext">{event.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

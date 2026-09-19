import type { NotificationWithAlarm } from '@grid-up/shared';
import { formatDateTime } from '../../utils/status';

const STATUS_CLASS: Record<string, string> = {
  SENT: 'sent',
  FAILED: 'failed',
  PENDING: 'pending',
};

const MESSAGE_PREVIEW_LENGTH = 60;

function messagePreview(message: string): string {
  const firstLine = message.split('\n')[0]?.trim() ?? message;
  return firstLine.length > MESSAGE_PREVIEW_LENGTH
    ? `${firstLine.slice(0, MESSAGE_PREVIEW_LENGTH)}…`
    : firstLine;
}

export function NotificationDeliveryTable({ notifications }: { notifications: NotificationWithAlarm[] }) {
  if (notifications.length === 0) {
    return <p className="empty-hint">No notifications sent yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Panel</th>
            <th>Channel</th>
            <th>Recipient</th>
            <th>Message</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification) => (
            <tr key={notification.id}>
              <td className="table-time">{formatDateTime(notification.createdAt)}</td>
              <td>
                <span className="table-strong">{notification.alarm.panel.code}</span>
                <div className="table-subtext">{notification.alarm.panel.site.name}</div>
              </td>
              <td>
                <span className="channel-badge">{notification.channel}</span>
              </td>
              <td>{notification.recipient}</td>
              <td title={notification.message}>{messagePreview(notification.message)}</td>
              <td>
                <span className={`status-pill ${STATUS_CLASS[notification.status] ?? ''}`}>{notification.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

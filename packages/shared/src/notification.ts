import { AlarmStatus } from './alarm';
import { Severity } from './anomaly';

export enum NotificationChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface Notification {
  id: string;
  alarmId: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  status: NotificationStatus;
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

// Asama 6 madde 10: GET /notifications (global) ve GET /alarms/:id/notifications
// dashboard-friendly response sekli - alarm/panel/site bilgisiyle birlikte.
export interface NotificationWithAlarm extends Notification {
  alarm: {
    id: string;
    severity: Severity;
    title: string;
    status: AlarmStatus;
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
  };
}

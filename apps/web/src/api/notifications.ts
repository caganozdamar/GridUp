import type { Notification, NotificationChannel, NotificationStatus, NotificationWithAlarm } from '@grid-up/shared';
import { apiGet } from './client';

export const notificationsApi = {
  list: (params: { status?: NotificationStatus; channel?: NotificationChannel } = {}) =>
    apiGet<NotificationWithAlarm[]>('/notifications', params),

  byAlarm: (alarmId: string) => apiGet<Notification[]>(`/alarms/${alarmId}/notifications`),
};

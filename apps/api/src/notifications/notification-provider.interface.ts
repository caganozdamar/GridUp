import type { NotificationChannel } from '@prisma/client';

// Asama 6 madde 2-3: gercek SMS/WhatsApp gateway'i (Twilio, Meta WhatsApp API,
// vb.) bu arayuzu implemente eden yeni bir provider ile, NotificationsService'i
// veya RiskEngineService'i degistirmeden takilabilir.
export interface NotificationSendInput {
  channel: NotificationChannel;
  recipient: string;
  message: string;
}

export interface NotificationSendResult {
  providerMessageId: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
}

export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

import { NotificationChannel, Severity } from '@prisma/client';

// Asama 6 madde 4: notification configuration'i tek, merkezi bir yerde toplar.
// Gercek telefon numarasi / API key / credential burada YOK; sadece demo
// provider'in log/alici etiketi icin okunabilir bir isim.
export const NOTIFICATION_PROVIDER_NAME = process.env.NOTIFICATION_PROVIDER ?? 'demo';
export const SMS_RECIPIENT = process.env.SMS_RECIPIENT ?? 'Operations Team';
export const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT ?? 'Operations Team';

// Asama 6 madde 5: severity -> kanal mapping. NORMAL/WARNING seviyesinde alarm
// zaten olusmaz (bkz. RiskEngineService.reconcileAlarms); LOW/MEDIUM severity
// burada da guvenlik icin bos dizi olarak tanimlandi.
export const SEVERITY_CHANNEL_MAP: Record<Severity, NotificationChannel[]> = {
  [Severity.LOW]: [],
  [Severity.MEDIUM]: [],
  [Severity.HIGH]: [NotificationChannel.SMS],
  [Severity.CRITICAL]: [NotificationChannel.SMS, NotificationChannel.WHATSAPP],
};

export function recipientForChannel(channel: NotificationChannel): string {
  return channel === NotificationChannel.SMS ? SMS_RECIPIENT : WHATSAPP_RECIPIENT;
}

import { NotificationChannel, Severity } from '@prisma/client';

// Asama 6 madde 4: notification configuration'i tek, merkezi bir yerde toplar.
// Gercek telefon numarasi / API key / credential kod icinde YOK; hepsi
// ortam degiskenlerinden (.env) okunur.
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

// Virgullerle ayrilmis alici listesi ("+905551112233, +905554445566"). Bos
// birakilirsa tek bir varsayilan etiket doner; boylece alarm bildirimi hicbir
// zaman alicisiz kalip sessizce kaybolmaz.
export function parseRecipients(raw: string | undefined, fallback: string): string[] {
  const recipients = (raw ?? '')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0);
  return recipients.length > 0 ? [...new Set(recipients)] : [fallback];
}

export function recipientsForChannel(channel: NotificationChannel): string[] {
  return channel === NotificationChannel.SMS
    ? parseRecipients(process.env.SMS_RECIPIENT, 'Operations Team')
    : parseRecipients(process.env.WHATSAPP_RECIPIENT, 'Operations Team');
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Ag uzerinden giden provider (http) icin yeniden deneme ayarlari. Ortam
// degiskenleri her cagrida okunur ki testler degeri degistirebilsin.
export function deliveryConfig() {
  return {
    maxAttempts: positiveInt(process.env.NOTIFICATION_MAX_ATTEMPTS, 3),
    retryBackoffMs: positiveInt(process.env.NOTIFICATION_RETRY_BACKOFF_MS, 500),
  };
}

export function gatewayConfig() {
  return {
    url: process.env.NOTIFICATION_GATEWAY_URL ?? '',
    token: process.env.NOTIFICATION_GATEWAY_TOKEN ?? '',
    timeoutMs: positiveInt(process.env.NOTIFICATION_GATEWAY_TIMEOUT_MS, 3000),
  };
}

// "inline": gonderim bitene kadar beklenir (demo provider agsiz oldugu icin
// aninda biter). "background": ag kullanan provider, ingestion/risk hattini
// yavaslatmasin diye arka planda calisir. NOTIFICATION_DISPATCH ile zorlanabilir.
export type DispatchMode = 'inline' | 'background';

export function dispatchMode(providerName: string): DispatchMode {
  const forced = process.env.NOTIFICATION_DISPATCH;
  if (forced === 'inline' || forced === 'background') return forced;
  return providerName === 'demo' ? 'inline' : 'background';
}

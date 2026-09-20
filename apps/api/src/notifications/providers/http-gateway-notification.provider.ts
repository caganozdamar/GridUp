import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from '../notification-provider.interface.js';
import { gatewayConfig } from '../notifications.config.js';
import { maskRecipient } from '../mask-recipient.util.js';

// Yapilandirilabilir HTTP gateway provider'i. Belirli bir SMS/WhatsApp
// saglayicisina bagli DEGILDIR: sirket ici bir GSM modem/SMS gateway'i ya da
// bir SMS API'si, ayni istegi kabul eden ince bir adaptorle takilabilir.
//
// Istek:  POST NOTIFICATION_GATEWAY_URL
//         Authorization: Bearer <NOTIFICATION_GATEWAY_TOKEN>   (token varsa)
//         { "channel": "SMS" | "WHATSAPP", "to": "<alici>", "message": "<metin>" }
// Yanit:  2xx; govdede JSON { "id": "<mesaj id>" } varsa o kullanilir.
//         2xx disindaki her yanit hata sayilir ve service tarafindan tekrar denenir.
@Injectable()
export class HttpGatewayNotificationProvider implements NotificationProvider {
  readonly name = 'http';

  private readonly logger = new Logger('HttpGatewayNotificationProvider');

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const { url, token, timeoutMs } = gatewayConfig();
    if (!url) {
      throw new Error('NOTIFICATION_GATEWAY_URL is not configured');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ channel: input.channel, to: input.recipient, message: input.message }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // Yanit govdesi hata mesajina girer ama kisaltilir; token/istek asla yazilmaz.
      const body = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`Gateway responded with HTTP ${response.status}${body ? `: ${body}` : ''}`);
    }

    const providerMessageId = await this.readMessageId(response);
    this.logger.log(`${input.channel} sent to ${maskRecipient(input.recipient)} (${providerMessageId})`);
    return { providerMessageId };
  }

  private async readMessageId(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { id?: unknown; messageId?: unknown };
      const id = body.id ?? body.messageId;
      if (typeof id === 'string' || typeof id === 'number') return String(id);
    } catch {
      // Govde JSON degil ya da bos: basarili kabul edilir, id uretilir.
    }
    return `gw-${randomUUID()}`;
  }
}

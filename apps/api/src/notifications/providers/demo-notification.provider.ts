import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from '../notification-provider.interface.js';

// Asama 6 madde 3: gercek SMS/WhatsApp GONDERMEZ, gercek credential kullanmaz.
// Hackathon demosu icin notification lifecycle'ini terminale okunabilir
// sekilde loglayan, calisan bir "provider" simulasyonu.
@Injectable()
export class DemoNotificationProvider implements NotificationProvider {
  readonly name = 'demo';

  private readonly logger = new Logger('DemoNotificationProvider');

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const providerMessageId = `demo-${randomUUID()}`;

    this.logger.log(this.formatLog(input, providerMessageId));

    return { providerMessageId };
  }

  private formatLog(input: NotificationSendInput, providerMessageId: string): string {
    const divider = '-'.repeat(50);
    return [
      '',
      divider,
      'GRID UP EMERGENCY NOTIFICATION',
      '',
      `Channel: ${input.channel}`,
      `Recipient: ${input.recipient}`,
      '',
      input.message,
      '',
      'Status: SENT',
      `Provider Message ID: ${providerMessageId}`,
      divider,
    ].join('\n');
  }
}

import { Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
import { Alarm, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from './notification-provider.interface.js';
import { SEVERITY_CHANNEL_MAP, deliveryConfig, dispatchMode, recipientsForChannel } from './notifications.config.js';
import { maskRecipient } from './mask-recipient.util.js';
import { buildNotificationMessage, type AlarmNotificationContext } from './notification-message.util.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export interface AlarmRiskContext {
  score: number;
  reasons: string[];
}

const NOTIFICATION_LIST_INCLUDE = {
  alarm: {
    select: {
      id: true,
      severity: true,
      title: true,
      status: true,
      panel: {
        select: {
          id: true,
          code: true,
          name: true,
          site: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  // Arka planda suren gonderimler; kapanista ve testlerde beklenebilsin diye izlenir.
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
  ) {}

  // Asama 6 madde 6: sadece yeni alarm CREATE event'inde (RiskEngineService.reconcileAlarms
  // icinden) cagrilir; 2 saniyelik ingestion tick'lerinde tekrar tetiklenmez.
  // Asama 6 madde 9: bu metod hicbir zaman throw etmez - notification/provider
  // hatasi ingestion/risk pipeline'ini asla bozmamali.
  async notifyAlarmCreated(alarm: Alarm, riskContext: AlarmRiskContext): Promise<void> {
    try {
      const channels = SEVERITY_CHANNEL_MAP[alarm.severity] ?? [];
      if (channels.length === 0) return;

      const panel = await this.prisma.panel.findUnique({
        where: { id: alarm.panelId },
        include: { site: { select: { name: true } } },
      });
      if (!panel) return;

      const context: AlarmNotificationContext = {
        panelCode: panel.code,
        siteName: panel.site.name,
        severity: alarm.severity,
        score: riskContext.score,
        reasons: riskContext.reasons,
      };

      const deliveries: Promise<void>[] = [];
      for (const channel of channels) {
        for (const recipient of recipientsForChannel(channel)) {
          const notification = await this.createPending(alarm.id, channel, recipient, context);
          if (notification) deliveries.push(this.track(this.deliver(notification.id, channel, recipient, notification.message)));
        }
      }
      // Ag kullanan provider ingestion/risk hattini bekletmesin; demo provider
      // aninda bittigi icin beklenir (kayit durumu hemen SENT olur).
      if (dispatchMode(this.provider.name) === 'inline') await Promise.all(deliveries);
    } catch (error) {
      this.logger.error(`Notification dispatch failed for alarm ${alarm.id}: ${(error as Error).message}`);
    }
  }

  async findAll(status?: NotificationStatus, channel?: NotificationChannel) {
    return this.prisma.notification.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: NOTIFICATION_LIST_INCLUDE,
    });
  }

  async findByAlarm(alarmId: string) {
    const alarm = await this.prisma.alarm.findUnique({ where: { id: alarmId }, select: { id: true } });
    if (!alarm) {
      throw new NotFoundException(`Alarm not found: ${alarmId}`);
    }

    return this.prisma.notification.findMany({
      where: { alarmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Tum arka plan gonderimlerinin bitmesini bekler (kapanis ve testler icin).
  async drain(): Promise<void> {
    await Promise.allSettled(this.inFlight);
  }

  async onModuleDestroy(): Promise<void> {
    await this.drain();
  }

  private track(delivery: Promise<void>): Promise<void> {
    this.inFlight.add(delivery);
    void delivery.finally(() => this.inFlight.delete(delivery));
    return delivery;
  }

  // Bildirimi PENDING olarak kaydeder. Ayni alarm+kanal+alici icin kayit zaten
  // varsa (DB seviyesindeki unique kisit) null doner ve tekrar gonderilmez.
  private async createPending(
    alarmId: string,
    channel: NotificationChannel,
    recipient: string,
    context: AlarmNotificationContext,
  ): Promise<{ id: string; message: string } | null> {
    const message = buildNotificationMessage(channel, context);
    try {
      const notification = await this.prisma.notification.create({
        data: { alarmId, channel, recipient, message, status: NotificationStatus.PENDING, provider: this.provider.name },
      });
      return { id: notification.id, message };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        return null;
      }
      throw error;
    }
  }

  // Bu metod hicbir zaman throw etmez: hata FAILED olarak kaydedilir.
  private async deliver(
    notificationId: string,
    channel: NotificationChannel,
    recipient: string,
    message: string,
  ): Promise<void> {
    const { maxAttempts, retryBackoffMs } = deliveryConfig();
    let lastError = 'unknown error';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.provider.send({ channel, recipient, message });
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
            attempts: attempt,
            errorMessage: null,
          },
        });
        return;
      } catch (error) {
        lastError = (error as Error).message;
        this.logger.warn(
          `${channel} to ${maskRecipient(recipient)} failed (attempt ${attempt}/${maxAttempts}): ${lastError}`,
        );
        if (attempt < maxAttempts) await sleep(retryBackoffMs * 2 ** (attempt - 1));
      }
    }

    try {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.FAILED, errorMessage: lastError, attempts: maxAttempts },
      });
    } catch (error) {
      this.logger.error(`Could not record FAILED notification ${notificationId}: ${(error as Error).message}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

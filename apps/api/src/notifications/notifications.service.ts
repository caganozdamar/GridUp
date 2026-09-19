import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Alarm, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from './notification-provider.interface.js';
import { NOTIFICATION_PROVIDER_NAME, SEVERITY_CHANNEL_MAP, recipientForChannel } from './notifications.config.js';
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
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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

      for (const channel of channels) {
        await this.sendChannelNotification(alarm.id, channel, context);
      }
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

  private async sendChannelNotification(
    alarmId: string,
    channel: NotificationChannel,
    context: AlarmNotificationContext,
  ): Promise<void> {
    const recipient = recipientForChannel(channel);
    const message = buildNotificationMessage(channel, context);

    let notification;
    try {
      // Asama 6 madde 7: DB seviyesindeki @@unique([alarmId, channel]) burada
      // devreye girer - uygulama seviyesi kontrole ek guvence saglar.
      notification = await this.prisma.notification.create({
        data: {
          alarmId,
          channel,
          recipient,
          message,
          status: NotificationStatus.PENDING,
          provider: NOTIFICATION_PROVIDER_NAME,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        return;
      }
      throw error;
    }

    try {
      const result = await this.provider.send({ channel, recipient, message });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), providerMessageId: result.providerMessageId },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, errorMessage: (error as Error).message },
      });
    }
  }
}

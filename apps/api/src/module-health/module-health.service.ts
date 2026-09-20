import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AlarmKind, AlarmStatus, Severity } from '@prisma/client';
import { DataHealthStatus } from '@grid-up/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { DecisionSupportService } from '../decision-support/decision-support.service.js';
import { DATA_STALE_MS } from '../decision-support/decision-support.config.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { alarmPolicy } from '../risk-engine/alarm-policy.config.js';

// Susan modul tespiti. Risk motoru yalnizca veri GELDIGINDE calisir, bu yuzden
// veri kesildiginde hicbir sey tetiklemez; bu servis periyodik olarak her
// panonun EN YENI okumasinin yasina bakar. Veri sagligi rozeti (Asama 9)
// yalnizca gosterge idi, bu servis onu alarma ve bildirime cevirir.
//
// Kural: panonun HICBIR sensorunden `moduleOfflineAfterMs`'dir okuma gelmediyse
// MODULE_OFFLINE alarmi acilir; okuma tekrar gelince (en yeni okuma taze) alarm
// cozulur. Hic veri gelmemis pano (NO_DATA) alarm uretmez: henuz kurulmamis bir
// modul kimseyi uyandirmamali. Tek bir sensorun susmasi (diger sensorler canliyken)
// bu servisin kapsami degildir; o durumda pano yalnizca STALE gorunur.
@Injectable()
export class ModuleHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModuleHealthService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly decisionSupport: DecisionSupportService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const { moduleOfflineCheckIntervalMs } = alarmPolicy();
    if (moduleOfflineCheckIntervalMs === 0) {
      this.logger.log('Module offline check is disabled (MODULE_OFFLINE_CHECK_INTERVAL_MS=0)');
      return;
    }
    this.timer = setInterval(() => void this.checkSafely(), moduleOfflineCheckIntervalMs);
    // Bekleyen zamanlayici, surecin kapanmasini engellemesin.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async checkSafely(): Promise<void> {
    if (this.running) return; // onceki kontrol bitmeden yenisi baslamaz
    this.running = true;
    try {
      await this.checkOnce();
    } catch (error) {
      this.logger.error(`Module offline check failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  // Testler `now`'u ve bakilacak panolari kendisi verebilsin diye public
  // (panoId filtresi, testlerin gelistirme DB'sindeki gercek demo panolarina
  // alarm acmasini engeller). Zamanlayici her zaman tum panolara bakar.
  async checkOnce(now: Date = new Date(), onlyPanelIds?: string[]): Promise<void> {
    const { moduleOfflineAfterMs } = alarmPolicy();
    const panels = await this.prisma.panel.findMany({
      where: onlyPanelIds ? { id: { in: onlyPanelIds } } : undefined,
      select: { id: true },
    });
    const health = await this.decisionSupport.getDataHealthForPanels(panels.map((panel) => panel.id));

    for (const { id: panelId } of panels) {
      const panelHealth = health.get(panelId);
      if (!panelHealth || panelHealth.status === DataHealthStatus.NO_DATA || !panelHealth.lastSensorUpdate) continue;

      const silentForMs = now.getTime() - new Date(panelHealth.lastSensorUpdate).getTime();
      const openAlarm = await this.prisma.alarm.findFirst({
        where: {
          panelId,
          kind: AlarmKind.MODULE_OFFLINE,
          status: { in: [AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (silentForMs > moduleOfflineAfterMs) {
        if (!openAlarm) await this.openAlarm(panelId, silentForMs);
      } else if (openAlarm && silentForMs <= DATA_STALE_MS) {
        await this.prisma.alarm.update({
          where: { id: openAlarm.id },
          data: { status: AlarmStatus.RESOLVED, resolvedAt: now },
        });
        this.logger.log(`Module of panel ${panelId} is reporting again; offline alarm resolved`);
      }
    }
  }

  private async openAlarm(panelId: string, silentForMs: number): Promise<void> {
    const minutes = Math.max(1, Math.round(silentForMs / 60_000));
    const alarm = await this.prisma.alarm.create({
      data: {
        panelId,
        kind: AlarmKind.MODULE_OFFLINE,
        severity: Severity.HIGH,
        title: 'Field module offline',
        message: `No sensor data for ${minutes} min. The panel is not being monitored.`,
      },
    });
    this.logger.warn(`Panel ${panelId} module offline (silent ${Math.round(silentForMs / 1000)} s); alarm ${alarm.id} opened`);

    // notifyAlarmCreated hicbir zaman throw etmez.
    await this.notifications.notifyAlarmCreated(alarm, { score: 0, reasons: [], silentForMs });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma, Severity } from '@prisma/client';
import { DataHealthStatus, type OperationalMetrics, type PanelDataHealth, type PanelTimelineResponse, type RiskLevel as SharedRiskLevel } from '@grid-up/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { DATA_STALE_MS, TIMELINE_DEFAULT_LIMIT, TIMELINE_MAX_LIMIT, TIMELINE_RAW_FETCH_CAP } from './decision-support.config.js';
import { computeDataHealth, type SensorFreshness } from './data-health.util.js';
import { deriveTimeline, type AlarmRow, type AnomalyRow, type NotificationRow } from './timeline.util.js';

interface LatestReadingTimestampRow {
  sensorId: string;
  timestamp: Date;
}

@Injectable()
export class DecisionSupportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asama 9 madde 11-13: birden fazla panel icin tek seferde (batched) data
   * health hesaplar - ScadaService.getPanelsSnapshot'taki N+1-onleme
   * yaklasimiyla ayni desen (bkz. apps/api/src/scada/scada.service.ts).
   */
  async getDataHealthForPanels(panelIds: string[]): Promise<Map<string, PanelDataHealth>> {
    if (panelIds.length === 0) return new Map();

    const sensors = await this.prisma.sensor.findMany({
      where: { panelId: { in: panelIds }, isActive: true },
      select: { id: true, panelId: true },
    });
    const sensorIds = sensors.map((sensor) => sensor.id);
    const latestReadings = await this.findLatestReadingTimestamps(sensorIds);
    const latestBySensorId = new Map(latestReadings.map((row) => [row.sensorId, row.timestamp]));

    const sensorsByPanelId = new Map<string, SensorFreshness[]>();
    for (const sensor of sensors) {
      const list = sensorsByPanelId.get(sensor.panelId) ?? [];
      list.push({ sensorId: sensor.id, lastReadingAt: latestBySensorId.get(sensor.id) ?? null });
      sensorsByPanelId.set(sensor.panelId, list);
    }

    const now = new Date();
    const result = new Map<string, PanelDataHealth>();
    for (const panelId of panelIds) {
      result.set(panelId, computeDataHealth(sensorsByPanelId.get(panelId) ?? [], now, DATA_STALE_MS));
    }
    return result;
  }

  async getDataHealthForPanel(panelId: string): Promise<PanelDataHealth> {
    const map = await this.getDataHealthForPanels([panelId]);
    return map.get(panelId) ?? { status: DataHealthStatus.NO_DATA, lastSensorUpdate: null, staleSensorCount: 0 };
  }

  private async findLatestReadingTimestamps(sensorIds: string[]): Promise<LatestReadingTimestampRow[]> {
    if (sensorIds.length === 0) return [];

    return this.prisma.$queryRaw<LatestReadingTimestampRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("sensorId") "sensorId", timestamp
      FROM sensor_readings
      WHERE "sensorId" IN (${Prisma.join(sensorIds)})
      ORDER BY "sensorId", timestamp DESC
    `);
  }

  /**
   * Asama 9 madde 15-19: Panel Event Timeline. Her kaynak tablodan sabit ve
   * makul bir ustsinirla (TIMELINE_RAW_FETCH_CAP) satir cekilir - tum
   * gecmisi memory'e yuklemez (Asama 9 madde 36).
   */
  async getPanelTimeline(panelId: string, limitInput?: number): Promise<PanelTimelineResponse> {
    await this.ensurePanelExists(panelId);

    const limit = this.resolveTimelineLimit(limitInput);

    const [riskScoreRows, anomalyRows, alarmRows] = await Promise.all([
      this.prisma.riskScore.findMany({
        where: { panelId },
        orderBy: { calculatedAt: 'desc' },
        take: TIMELINE_RAW_FETCH_CAP,
        select: { score: true, level: true, calculatedAt: true },
      }),
      this.prisma.anomaly.findMany({
        where: { panelId },
        orderBy: { detectedAt: 'desc' },
        take: TIMELINE_RAW_FETCH_CAP,
        select: { type: true, severity: true, message: true, detectedAt: true, resolvedAt: true },
      }),
      this.prisma.alarm.findMany({
        where: { panelId },
        orderBy: { createdAt: 'desc' },
        take: TIMELINE_RAW_FETCH_CAP,
        select: { id: true, severity: true, title: true, createdAt: true, acknowledgedAt: true, resolvedAt: true },
      }),
    ]);

    const alarmIds = alarmRows.map((alarm) => alarm.id);
    const notificationRows = alarmIds.length
      ? await this.prisma.notification.findMany({
          where: { alarmId: { in: alarmIds } },
          orderBy: { createdAt: 'desc' },
          take: TIMELINE_RAW_FETCH_CAP,
          select: { channel: true, status: true, createdAt: true, sentAt: true },
        })
      : [];

    const events = deriveTimeline(
      {
        riskScores: riskScoreRows.map((row) => ({
          score: row.score,
          level: row.level as unknown as SharedRiskLevel,
          calculatedAt: row.calculatedAt,
        })),
        // Prisma'nin generate ettigi enum'lar (AnomalyType/Severity/NotificationChannel/
        // NotificationStatus), packages/shared'daki enum'larla ayni string
        // degerlerini paylasir (schema.prisma <-> shared/src elle senkron
        // tutulur, bkz. risk-engine.service.ts); bu yuzden cast guvenlidir.
        anomalies: anomalyRows as unknown as AnomalyRow[],
        alarms: alarmRows as unknown as AlarmRow[],
        notifications: notificationRows as unknown as NotificationRow[],
      },
      limit,
    );

    return { panelId, events };
  }

  /** Asama 9 madde 20-23: Operational / Early Warning Metrics. */
  async getOperationalMetrics(): Promise<OperationalMetrics> {
    const [earlyWarningsGenerated, criticalEscalationsDetected, notificationsDelivered] = await Promise.all([
      this.prisma.alarm.count({ where: { severity: Severity.HIGH } }),
      this.prisma.alarm.count({ where: { severity: Severity.CRITICAL } }),
      this.prisma.notification.count({ where: { status: NotificationStatus.SENT } }),
    ]);

    return { earlyWarningsGenerated, criticalEscalationsDetected, notificationsDelivered };
  }

  private resolveTimelineLimit(limitInput: number | undefined): number {
    if (limitInput === undefined || !Number.isFinite(limitInput)) return TIMELINE_DEFAULT_LIMIT;
    return Math.min(TIMELINE_MAX_LIMIT, Math.max(1, Math.trunc(limitInput)));
  }

  private async ensurePanelExists(panelId: string): Promise<void> {
    const panel = await this.prisma.panel.findUnique({ where: { id: panelId }, select: { id: true } });
    if (!panel) {
      throw new NotFoundException(`Panel not found: ${panelId}`);
    }
  }
}

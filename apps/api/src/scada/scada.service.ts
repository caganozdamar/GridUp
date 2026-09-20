import { Injectable } from '@nestjs/common';
import { AnomalyType, Prisma, SensorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ScadaPanelSnapshot } from './scada-panel-snapshot.model.js';

interface LatestReadingRow {
  sensorId: string;
  value: number;
  timestamp: Date;
}

interface LatestRiskScoreRow {
  panelId: string;
  score: number;
  level: ScadaPanelSnapshot['riskLevel'];
  calculatedAt: Date;
}

@Injectable()
export class ScadaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SCADA Gateway (apps/scada-gateway) icin tek, batched snapshot.
   *
   * Panel sayisiyla orantili N+1 query olusturmamak icin: panel basina
   * ayri sorgu atmak yerine, tum panoların sensor/reading/risk/alarm/anomaly
   * verisi sabit sayida (6) toplu sorguyla cekilip bellekte birlestirilir.
   */
  async getPanelsSnapshot(): Promise<ScadaPanelSnapshot[]> {
    const panels = await this.prisma.panel.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, status: true },
    });
    if (panels.length === 0) return [];

    const panelIds = panels.map((panel) => panel.id);

    const sensors = await this.prisma.sensor.findMany({
      where: { panelId: { in: panelIds }, isActive: true },
      select: { id: true, panelId: true, type: true },
    });
    const sensorIds = sensors.map((sensor) => sensor.id);

    const [latestReadings, latestRiskScores, activeAlarmGroups, activeAnomalyGroups] = await Promise.all([
      this.findLatestReadingsBySensor(sensorIds),
      this.findLatestRiskScoresByPanel(panelIds),
      this.prisma.alarm.groupBy({
        by: ['panelId'],
        where: { panelId: { in: panelIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.anomaly.groupBy({
        by: ['panelId', 'type'],
        where: { panelId: { in: panelIds }, resolvedAt: null },
        _count: { _all: true },
      }),
    ]);

    const latestReadingBySensorId = new Map(latestReadings.map((row) => [row.sensorId, row]));
    const riskScoreByPanelId = new Map(latestRiskScores.map((row) => [row.panelId, row]));
    const activeAlarmCountByPanelId = new Map(activeAlarmGroups.map((row) => [row.panelId, row._count._all]));
    const activeAnomalyCountByPanelId = new Map<string, number>();
    const activeAnomalyTypesByPanelId = new Map<string, Set<AnomalyType>>();
    for (const row of activeAnomalyGroups) {
      activeAnomalyCountByPanelId.set(row.panelId, (activeAnomalyCountByPanelId.get(row.panelId) ?? 0) + row._count._all);
      const types = activeAnomalyTypesByPanelId.get(row.panelId) ?? new Set<AnomalyType>();
      types.add(row.type);
      activeAnomalyTypesByPanelId.set(row.panelId, types);
    }

    const sensorsByPanelId = new Map<string, typeof sensors>();
    for (const sensor of sensors) {
      const list = sensorsByPanelId.get(sensor.panelId) ?? [];
      list.push(sensor);
      sensorsByPanelId.set(sensor.panelId, list);
    }

    return panels.map((panel) => {
      const panelSensors = sensorsByPanelId.get(panel.id) ?? [];

      let ambientTemperature: number | null = null;
      let cableTemperature: number | null = null;
      let humidity: number | null = null;
      let current: number | null = null;
      let arcFlash: number | null = null;
      let acoustic: number | null = null;
      let lastReadingAt: Date | null = null;

      for (const sensor of panelSensors) {
        const reading = latestReadingBySensorId.get(sensor.id);
        if (!reading) continue;

        if (!lastReadingAt || reading.timestamp > lastReadingAt) {
          lastReadingAt = reading.timestamp;
        }

        switch (sensor.type) {
          case SensorType.AMBIENT_TEMPERATURE:
            ambientTemperature = reading.value;
            break;
          case SensorType.CABLE_TEMPERATURE:
            cableTemperature = reading.value;
            break;
          case SensorType.HUMIDITY:
            humidity = reading.value;
            break;
          case SensorType.CURRENT:
            current = reading.value;
            break;
          case SensorType.ARC_FLASH:
            arcFlash = reading.value;
            break;
          case SensorType.ACOUSTIC:
            acoustic = reading.value;
            break;
        }
      }

      const riskRow = riskScoreByPanelId.get(panel.id);
      const activeAlarmCount = activeAlarmCountByPanelId.get(panel.id) ?? 0;

      const snapshot: ScadaPanelSnapshot = {
        panelCode: panel.code,
        panelStatus: panel.status,
        online: panel.status === 'ONLINE',
        riskScore: riskRow?.score ?? null,
        riskLevel: riskRow?.level ?? null,
        ambientTemperature,
        cableTemperature,
        humidity,
        current,
        arcFlash,
        acoustic,
        arcFlashActive: activeAnomalyTypesByPanelId.get(panel.id)?.has(AnomalyType.ARC_FLASH) ?? false,
        partialDischargeActive: activeAnomalyTypesByPanelId.get(panel.id)?.has(AnomalyType.PARTIAL_DISCHARGE) ?? false,
        activeAlarm: activeAlarmCount > 0,
        activeAnomalyCount: activeAnomalyCountByPanelId.get(panel.id) ?? 0,
        lastReadingAt: lastReadingAt ? lastReadingAt.toISOString() : null,
      };
      return snapshot;
    });
  }

  private async findLatestReadingsBySensor(sensorIds: string[]): Promise<LatestReadingRow[]> {
    if (sensorIds.length === 0) return [];

    return this.prisma.$queryRaw<LatestReadingRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("sensorId") "sensorId", value, timestamp
      FROM sensor_readings
      WHERE "sensorId" IN (${Prisma.join(sensorIds)})
      ORDER BY "sensorId", timestamp DESC
    `);
  }

  private async findLatestRiskScoresByPanel(panelIds: string[]): Promise<LatestRiskScoreRow[]> {
    if (panelIds.length === 0) return [];

    return this.prisma.$queryRaw<LatestRiskScoreRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("panelId") "panelId", score, level, "calculatedAt"
      FROM risk_scores
      WHERE "panelId" IN (${Prisma.join(panelIds)})
      ORDER BY "panelId", "calculatedAt" DESC
    `);
  }
}

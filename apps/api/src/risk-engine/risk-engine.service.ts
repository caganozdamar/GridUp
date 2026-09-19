import { Injectable, Logger } from '@nestjs/common';
import {
  AlarmStatus,
  AnomalyType,
  Severity,
  SensorType as PrismaSensorType,
  RiskLevel as PrismaRiskLevel,
} from '@prisma/client';
import { RiskLevel, SensorType, type RiskComponents } from '@grid-up/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ANALYSIS_WINDOW_SIZE } from './risk-engine.config.js';
import { computeSensorStats, type SensorStats } from './risk-math.util.js';
import { computeRiskExplanation, type RiskExplanationResult } from './risk-scoring.js';

const RELEVANT_SENSOR_TYPES: PrismaSensorType[] = [
  PrismaSensorType.AMBIENT_TEMPERATURE,
  PrismaSensorType.CABLE_TEMPERATURE,
  PrismaSensorType.HUMIDITY,
  PrismaSensorType.CURRENT,
];

export interface PanelRiskAnalysis extends RiskExplanationResult {
  panelId: string;
  calculatedAt: string;
  sensorIdByType: Partial<Record<SensorType, string>>;
}

// Prisma'nin generate ettigi SensorType/RiskLevel, packages/shared'daki
// enum'larla ayni string degerlerini paylasir (schema.prisma <-> shared/src
// elle senkronize tutulur); bu yuzden aradaki donusum guvenli bir cast'tir.
function toSharedSensorType(type: PrismaSensorType): SensorType {
  return type as unknown as SensorType;
}

function toPrismaRiskLevel(level: RiskLevel): PrismaRiskLevel {
  return level as unknown as PrismaRiskLevel;
}

function severityFromScore(score: number): Severity {
  if (score >= 80) return Severity.CRITICAL;
  if (score >= 60) return Severity.HIGH;
  if (score >= 30) return Severity.MEDIUM;
  return Severity.LOW;
}

interface AnomalyDecision {
  type: AnomalyType;
  active: boolean;
  severityScore: number;
  sensorType?: SensorType;
  message: string;
}

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Panelin son ANALYSIS_WINDOW_SIZE reading'inden aciklanabilir bir risk
   * analizi uretir. Hicbir sey persist etmez (GET /panels/:id/risk "latest"
   * icin canli/on-demand hesaplama amaciyla kullanilir).
   */
  async computeAnalysis(panelId: string): Promise<PanelRiskAnalysis | null> {
    const sensors = await this.prisma.sensor.findMany({
      where: { panelId, isActive: true, type: { in: RELEVANT_SENSOR_TYPES } },
    });
    if (sensors.length === 0) return null;

    const statsByType: Partial<Record<SensorType, SensorStats>> = {};
    const sensorIdByType: Partial<Record<SensorType, string>> = {};

    for (const sensor of sensors) {
      const readings = await this.prisma.sensorReading.findMany({
        where: { sensorId: sensor.id },
        orderBy: { timestamp: 'desc' },
        take: ANALYSIS_WINDOW_SIZE,
      });

      const stats = computeSensorStats(
        readings.map((reading) => ({ value: reading.value, timestamp: reading.timestamp })),
      );
      if (stats) {
        const sharedType = toSharedSensorType(sensor.type);
        statsByType[sharedType] = stats;
        sensorIdByType[sharedType] = sensor.id;
      }
    }

    const explanation = computeRiskExplanation(statsByType);

    return {
      ...explanation,
      panelId,
      calculatedAt: new Date().toISOString(),
      sensorIdByType,
    };
  }

  /**
   * Ingestion pipeline'in giris noktasi: sadece verilen panolari analiz eder
   * (Asama 4 madde 6 - "tum database'deki panolari her seferinde analiz
   * etme"), RiskScore kaydeder ve anomaly/alarm lifecycle'ini isletir.
   */
  async analyzePanels(panelIds: Iterable<string>): Promise<void> {
    const uniqueIds = [...new Set(panelIds)];
    for (const panelId of uniqueIds) {
      try {
        await this.analyzePanel(panelId);
      } catch (error) {
        this.logger.error(`Risk analysis failed for panel ${panelId}: ${(error as Error).message}`);
      }
    }
  }

  private async analyzePanel(panelId: string): Promise<void> {
    const analysis = await this.computeAnalysis(panelId);
    if (!analysis) return;

    await this.prisma.riskScore.create({
      data: { panelId, score: analysis.score, level: toPrismaRiskLevel(analysis.level) },
    });

    await this.reconcileAnomalies(analysis);
    await this.reconcileAlarms(analysis);
  }

  private async reconcileAnomalies(analysis: PanelRiskAnalysis): Promise<void> {
    const decisions: AnomalyDecision[] = [
      {
        type: AnomalyType.HIGH_TEMPERATURE,
        active: analysis.flags.highTemperature,
        severityScore: analysis.components.temperature,
        sensorType: SensorType.CABLE_TEMPERATURE,
        message: 'Cable temperature has reached a high-risk level',
      },
      {
        type: AnomalyType.TEMPERATURE_RISE,
        active: analysis.flags.temperatureRise,
        severityScore: analysis.components.trend,
        sensorType: SensorType.CABLE_TEMPERATURE,
        message: 'Cable temperature is rising rapidly',
      },
      {
        type: AnomalyType.OVERCURRENT,
        active: analysis.flags.overcurrent,
        severityScore: analysis.components.current,
        sensorType: SensorType.CURRENT,
        message: 'Current draw exceeds safe operating levels',
      },
      {
        type: AnomalyType.HIGH_HUMIDITY,
        active: analysis.flags.highHumidity,
        severityScore: analysis.components.humidity,
        sensorType: SensorType.HUMIDITY,
        message: 'Humidity has reached a high-risk level',
      },
      {
        type: AnomalyType.MULTI_SENSOR_RISK,
        active: analysis.flags.multiSensorRisk,
        severityScore: analysis.score,
        message: 'Multiple sensors are indicating correlated risk',
      },
    ];

    for (const decision of decisions) {
      const existingActive = await this.prisma.anomaly.findFirst({
        where: { panelId: analysis.panelId, type: decision.type, resolvedAt: null },
      });

      if (decision.active && !existingActive) {
        await this.prisma.anomaly.create({
          data: {
            panelId: analysis.panelId,
            sensorId: decision.sensorType ? (analysis.sensorIdByType[decision.sensorType] ?? null) : null,
            type: decision.type,
            severity: severityFromScore(decision.severityScore),
            message: decision.message,
          },
        });
      } else if (!decision.active && existingActive) {
        await this.prisma.anomaly.update({
          where: { id: existingActive.id },
          data: { resolvedAt: new Date() },
        });
      }
    }
  }

  private async reconcileAlarms(analysis: PanelRiskAnalysis): Promise<void> {
    const shouldAlarm = analysis.level === RiskLevel.HIGH || analysis.level === RiskLevel.CRITICAL;

    const activeAlarm = await this.prisma.alarm.findFirst({
      where: { panelId: analysis.panelId, status: AlarmStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (!shouldAlarm) {
      if (activeAlarm) {
        await this.prisma.alarm.update({
          where: { id: activeAlarm.id },
          data: { status: AlarmStatus.RESOLVED, resolvedAt: new Date() },
        });
      }
      return;
    }

    const severity = analysis.level === RiskLevel.CRITICAL ? Severity.CRITICAL : Severity.HIGH;

    if (activeAlarm) {
      if (activeAlarm.severity === severity) {
        // Ayni seviyede aktif alarm zaten var; duplicate olusturma.
        return;
      }
      // Seviye degisti (orn. HIGH -> CRITICAL ya da CRITICAL -> HIGH):
      // eskiyi kapat, guncel seviyeyi yansitan yeni bir alarm ac.
      await this.prisma.alarm.update({
        where: { id: activeAlarm.id },
        data: { status: AlarmStatus.RESOLVED, resolvedAt: new Date() },
      });
    }

    const relatedAnomaly = await this.prisma.anomaly.findFirst({
      where: { panelId: analysis.panelId, resolvedAt: null },
      orderBy: { detectedAt: 'desc' },
    });

    const createdAlarm = await this.prisma.alarm.create({
      data: {
        panelId: analysis.panelId,
        anomalyId: relatedAnomaly?.id ?? null,
        severity,
        title: this.buildAlarmTitle(analysis.components, severity),
        message: analysis.reasons[0] ?? `Panel risk score reached ${analysis.score} (${analysis.level}).`,
      },
    });

    // Asama 6 madde 6/9: notification dispatch yeni alarm CREATE event'ine
    // bagli, ayri bir side effect'tir; RiskEngineService provider
    // implementation'ini bilmez ve bu cagri hicbir zaman throw etmez, bu
    // yuzden ingestion/risk pipeline'i notification hatasindan etkilenmez.
    try {
      await this.notificationsService.notifyAlarmCreated(createdAlarm, {
        score: analysis.score,
        reasons: analysis.reasons,
      });
    } catch (error) {
      this.logger.error(`Notification trigger failed for alarm ${createdAlarm.id}: ${(error as Error).message}`);
    }
  }

  private buildAlarmTitle(components: RiskComponents, severity: Severity): string {
    const prefix = severity === Severity.CRITICAL ? 'Critical' : 'Elevated';
    const dominant = Math.max(components.temperature, components.current, components.humidity);

    if (dominant > 0 && dominant === components.temperature) return `${prefix} overheating risk detected`;
    if (dominant > 0 && dominant === components.current) return `${prefix} overcurrent risk detected`;
    if (dominant > 0 && dominant === components.humidity) return `${prefix} humidity risk detected`;
    return `${prefix} panel risk detected`;
  }
}

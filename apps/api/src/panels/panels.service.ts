import { Injectable, NotFoundException } from '@nestjs/common';
import type { PanelDataHealth } from '@grid-up/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RiskEngineService } from '../risk-engine/risk-engine.service.js';
import { DecisionSupportService } from '../decision-support/decision-support.service.js';
import { computeTrendEstimate } from '../decision-support/trend-estimate.util.js';
import { buildRecommendedActions } from '../decision-support/recommended-actions.util.js';
import { TREND_SAMPLE_WINDOW } from '../decision-support/decision-support.config.js';

@Injectable()
export class PanelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngineService: RiskEngineService,
    private readonly decisionSupportService: DecisionSupportService,
  ) {}

  async ensureExists(id: string): Promise<void> {
    const panel = await this.prisma.panel.findUnique({ where: { id }, select: { id: true } });
    if (!panel) {
      throw new NotFoundException(`Panel not found: ${id}`);
    }
  }

  async findAll() {
    const panels = await this.prisma.panel.findMany({
      orderBy: { code: 'asc' },
      include: {
        site: { select: { id: true, name: true, code: true } },
        _count: { select: { sensors: true } },
      },
    });

    // Asama 9 madde 11-13: data health, panel basina ayri sorgu yerine tum
    // panoller icin tek seferde (batched) hesaplanir (N+1 onlemek icin).
    const dataHealthByPanelId = await this.decisionSupportService.getDataHealthForPanels(
      panels.map((panel) => panel.id),
    );

    return Promise.all(
      panels.map((panel) => this.toSummary(panel, dataHealthByPanelId.get(panel.id))),
    );
  }

  async findOne(id: string) {
    const panel = await this.prisma.panel.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true, code: true } },
        sensors: { orderBy: { code: 'asc' } },
        _count: { select: { sensors: true } },
      },
    });

    if (!panel) {
      throw new NotFoundException(`Panel not found: ${id}`);
    }

    const { sensors, ...summary } = panel;
    const dataHealth = await this.decisionSupportService.getDataHealthForPanel(id);
    return {
      ...(await this.toSummary(summary, dataHealth)),
      sensors,
    };
  }

  async getRisk(panelId: string, limit = 50) {
    await this.ensureExists(panelId);

    const [history, trendSamples, analysis] = await Promise.all([
      this.prisma.riskScore.findMany({
        where: { panelId },
        orderBy: { calculatedAt: 'desc' },
        take: limit,
      }),
      // Asama 9 madde 2: Time-to-Critical, `limit` query param'indan bagimsiz,
      // sabit bir pencere (TREND_SAMPLE_WINDOW) uzerinden hesaplanir.
      this.prisma.riskScore.findMany({
        where: { panelId },
        orderBy: { calculatedAt: 'desc' },
        take: TREND_SAMPLE_WINDOW,
        select: { score: true, calculatedAt: true },
      }),
      this.riskEngineService.computeAnalysis(panelId),
    ]);

    // "latest", panelin guncel sensor okumalarindan canli olarak yeniden
    // hesaplanir; boylece score/level'in yani sira components/reasons de
    // donebilir (Asama 4 madde 7 - explainability). RiskScore Prisma modeli
    // bu alanlari kalici tutmaz, "history" DB'deki gecmis skorlari yansitir.
    const latest = analysis
      ? {
          score: analysis.score,
          level: analysis.level,
          calculatedAt: analysis.calculatedAt,
          components: analysis.components,
          reasons: analysis.reasons,
        }
      : (history[0] ?? null);

    return {
      latest,
      history,
      // Asama 9 madde 5 / 10: backwards-compatible decision support eklentileri.
      trendEstimate: computeTrendEstimate(trendSamples),
      recommendedActions: analysis ? buildRecommendedActions(analysis) : [],
    };
  }

  private async toSummary<
    T extends {
      id: string;
      _count: { sensors: number };
    },
  >(panel: T, dataHealth: PanelDataHealth | undefined) {
    const [latestRiskScore, activeAlarmCount] = await Promise.all([
      this.prisma.riskScore.findFirst({
        where: { panelId: panel.id },
        orderBy: { calculatedAt: 'desc' },
      }),
      this.prisma.alarm.count({
        where: { panelId: panel.id, status: 'ACTIVE' },
      }),
    ]);

    const { _count, ...rest } = panel;
    return {
      ...rest,
      sensorCount: _count.sensors,
      latestRiskScore,
      activeAlarmCount,
      dataHealth: dataHealth ?? (await this.decisionSupportService.getDataHealthForPanel(panel.id)),
    };
  }
}

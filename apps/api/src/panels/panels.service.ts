import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RiskEngineService } from '../risk-engine/risk-engine.service.js';

@Injectable()
export class PanelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngineService: RiskEngineService,
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

    return Promise.all(panels.map((panel) => this.toSummary(panel)));
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
    return {
      ...(await this.toSummary(summary)),
      sensors,
    };
  }

  async getRisk(panelId: string, limit = 50) {
    await this.ensureExists(panelId);

    const history = await this.prisma.riskScore.findMany({
      where: { panelId },
      orderBy: { calculatedAt: 'desc' },
      take: limit,
    });

    // "latest", panelin guncel sensor okumalarindan canli olarak yeniden
    // hesaplanir; boylece score/level'in yani sira components/reasons de
    // donebilir (Asama 4 madde 7 - explainability). RiskScore Prisma modeli
    // bu alanlari kalici tutmaz, "history" DB'deki gecmis skorlari yansitir.
    const analysis = await this.riskEngineService.computeAnalysis(panelId);
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
    };
  }

  private async toSummary<
    T extends {
      id: string;
      _count: { sensors: number };
    },
  >(panel: T) {
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
    };
  }
}

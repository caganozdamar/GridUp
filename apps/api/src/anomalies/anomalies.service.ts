import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PanelsService } from '../panels/panels.service.js';

@Injectable()
export class AnomaliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panelsService: PanelsService,
  ) {}

  async findByPanel(panelId: string, resolved?: boolean) {
    await this.panelsService.ensureExists(panelId);

    return this.prisma.anomaly.findMany({
      where: {
        panelId,
        ...(resolved === undefined
          ? {}
          : resolved
            ? { resolvedAt: { not: null } }
            : { resolvedAt: null }),
      },
      orderBy: { detectedAt: 'desc' },
    });
  }
}

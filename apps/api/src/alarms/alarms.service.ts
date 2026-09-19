import { Injectable } from '@nestjs/common';
import { AlarmStatus, Severity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PanelsService } from '../panels/panels.service.js';

@Injectable()
export class AlarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panelsService: PanelsService,
  ) {}

  async findByPanel(panelId: string, status?: AlarmStatus) {
    await this.panelsService.ensureExists(panelId);

    return this.prisma.alarm.findMany({
      where: {
        panelId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Asama 5 madde 10: dashboard'daki global /alarms ekrani icin, panel/site
  // bilgisiyle birlikte tum alarmlari dondurur.
  async findAll(status?: AlarmStatus, severity?: Severity) {
    return this.prisma.alarm.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        panel: {
          select: {
            id: true,
            code: true,
            name: true,
            site: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }
}

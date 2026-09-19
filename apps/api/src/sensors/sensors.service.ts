import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PanelsService } from '../panels/panels.service.js';

@Injectable()
export class SensorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panelsService: PanelsService,
  ) {}

  async findByPanel(panelId: string) {
    await this.panelsService.ensureExists(panelId);

    return this.prisma.sensor.findMany({
      where: { panelId },
      orderBy: { code: 'asc' },
    });
  }
}

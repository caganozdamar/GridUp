import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const sites = await this.prisma.site.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { panels: true } } },
    });

    return sites.map(({ _count, ...site }) => ({
      ...site,
      panelCount: _count.panels,
    }));
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { _count: { select: { panels: true } } },
    });

    if (!site) {
      throw new NotFoundException(`Site not found: ${id}`);
    }

    const { _count, ...rest } = site;
    return { ...rest, panelCount: _count.panels };
  }
}

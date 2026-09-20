import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  // Operator alarmi gordugunu onaylar (ACTIVE -> ACKNOWLEDGED). Alarm acik
  // kalir: risk motoru onaylanmis alarmi da "acik alarm" sayar, bu yuzden ayni
  // durum icin yeni alarm/bildirim uretmez; risk normale donunce RESOLVED olur.
  // Ikinci onay istegi zararsizdir (ayni kayit doner); cozulmus alarm onaylanamaz.
  async acknowledge(alarmId: string) {
    const alarm = await this.prisma.alarm.findUnique({ where: { id: alarmId } });
    if (!alarm) {
      throw new NotFoundException(`Alarm not found: ${alarmId}`);
    }
    if (alarm.status === AlarmStatus.RESOLVED) {
      throw new ConflictException('A resolved alarm cannot be acknowledged');
    }
    if (alarm.status === AlarmStatus.ACKNOWLEDGED) {
      return alarm;
    }

    return this.prisma.alarm.update({
      where: { id: alarmId },
      data: { status: AlarmStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
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

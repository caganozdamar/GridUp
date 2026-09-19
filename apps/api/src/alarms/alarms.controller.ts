import { Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { AlarmStatus } from '@prisma/client';
import { AlarmsService } from './alarms.service.js';

@Controller('panels/:panelId/alarms')
export class AlarmsController {
  constructor(private readonly alarmsService: AlarmsService) {}

  @Get()
  findByPanel(
    @Param('panelId') panelId: string,
    @Query('status', new ParseEnumPipe(AlarmStatus, { optional: true })) status?: AlarmStatus,
  ) {
    return this.alarmsService.findByPanel(panelId, status);
  }
}

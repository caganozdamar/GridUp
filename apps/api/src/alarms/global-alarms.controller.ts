import { Controller, Get, Param, ParseEnumPipe, Patch, Query } from '@nestjs/common';
import { AlarmStatus, Severity } from '@prisma/client';
import { AlarmsService } from './alarms.service.js';

// Asama 5 madde 10: /alarms sayfasi icin global (panel-agnostik) endpoint.
@Controller('alarms')
export class GlobalAlarmsController {
  constructor(private readonly alarmsService: AlarmsService) {}

  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(AlarmStatus, { optional: true })) status?: AlarmStatus,
    @Query('severity', new ParseEnumPipe(Severity, { optional: true })) severity?: Severity,
  ) {
    return this.alarmsService.findAll(status, severity);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.alarmsService.acknowledge(id);
  }
}

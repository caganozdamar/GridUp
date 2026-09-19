import { Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service.js';

// Asama 6 madde 10: global bildirim teslimat gecmisi + alarm-bazli bildirimler.
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  findAll(
    @Query('status', new ParseEnumPipe(NotificationStatus, { optional: true })) status?: NotificationStatus,
    @Query('channel', new ParseEnumPipe(NotificationChannel, { optional: true })) channel?: NotificationChannel,
  ) {
    return this.notificationsService.findAll(status, channel);
  }

  @Get('alarms/:alarmId/notifications')
  findByAlarm(@Param('alarmId') alarmId: string) {
    return this.notificationsService.findByAlarm(alarmId);
  }
}

import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DemoNotificationProvider } from './providers/demo-notification.provider.js';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DemoNotificationProvider,
    { provide: NOTIFICATION_PROVIDER, useExisting: DemoNotificationProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { DecisionSupportModule } from '../decision-support/decision-support.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ModuleHealthService } from './module-health.service.js';

@Module({
  imports: [DecisionSupportModule, NotificationsModule],
  providers: [ModuleHealthService],
  exports: [ModuleHealthService],
})
export class ModuleHealthModule {}

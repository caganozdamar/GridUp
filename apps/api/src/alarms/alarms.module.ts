import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { AlarmsController } from './alarms.controller.js';
import { GlobalAlarmsController } from './global-alarms.controller.js';
import { AlarmsService } from './alarms.service.js';

@Module({
  imports: [PanelsModule],
  controllers: [AlarmsController, GlobalAlarmsController],
  providers: [AlarmsService],
})
export class AlarmsModule {}

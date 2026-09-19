import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { SensorsController } from './sensors.controller.js';
import { SensorsService } from './sensors.service.js';

@Module({
  imports: [PanelsModule],
  controllers: [SensorsController],
  providers: [SensorsService],
})
export class SensorsModule {}

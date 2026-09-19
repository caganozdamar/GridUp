import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { AnomaliesController } from './anomalies.controller.js';
import { AnomaliesService } from './anomalies.service.js';

@Module({
  imports: [PanelsModule],
  controllers: [AnomaliesController],
  providers: [AnomaliesService],
})
export class AnomaliesModule {}

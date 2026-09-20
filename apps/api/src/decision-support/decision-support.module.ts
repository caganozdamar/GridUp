import { Module } from '@nestjs/common';
import { DecisionSupportService } from './decision-support.service.js';
import { PanelTimelineController } from './panel-timeline.controller.js';
import { OperationalMetricsController } from './operational-metrics.controller.js';

@Module({
  controllers: [PanelTimelineController, OperationalMetricsController],
  providers: [DecisionSupportService],
  exports: [DecisionSupportService],
})
export class DecisionSupportModule {}

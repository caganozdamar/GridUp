import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { DecisionSupportService } from './decision-support.service.js';

// Asama 9 madde 15-19: GET /panels/:panelId/timeline
@Controller('panels/:panelId/timeline')
export class PanelTimelineController {
  constructor(private readonly decisionSupportService: DecisionSupportService) {}

  @Get()
  getTimeline(
    @Param('panelId') panelId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.decisionSupportService.getPanelTimeline(panelId, limit);
  }
}

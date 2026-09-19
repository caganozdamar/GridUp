import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnomaliesService } from './anomalies.service.js';

@Controller('panels/:panelId/anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  findByPanel(@Param('panelId') panelId: string, @Query('resolved') resolved?: string) {
    const resolvedFilter = resolved === undefined ? undefined : resolved === 'true';
    return this.anomaliesService.findByPanel(panelId, resolvedFilter);
  }
}

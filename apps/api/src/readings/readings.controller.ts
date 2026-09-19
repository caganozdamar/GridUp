import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ReadingsService } from './readings.service.js';

@Controller('panels/:panelId/readings')
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Get()
  findByPanel(
    @Param('panelId') panelId: string,
    @Query('sensorId') sensorId?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.readingsService.findByPanel(panelId, sensorId, limit);
  }
}

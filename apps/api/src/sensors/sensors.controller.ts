import { Controller, Get, Param } from '@nestjs/common';
import { SensorsService } from './sensors.service.js';

@Controller('panels/:panelId/sensors')
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get()
  findByPanel(@Param('panelId') panelId: string) {
    return this.sensorsService.findByPanel(panelId);
  }
}

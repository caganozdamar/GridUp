import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PanelsService } from './panels.service.js';

@Controller('panels')
export class PanelsController {
  constructor(private readonly panelsService: PanelsService) {}

  @Get()
  findAll() {
    return this.panelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.panelsService.findOne(id);
  }

  @Get(':id/risk')
  getRisk(
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.panelsService.getRisk(id, limit);
  }
}

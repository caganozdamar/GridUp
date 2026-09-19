import { Body, Controller, Post } from '@nestjs/common';
import { ReadingsService } from './readings.service.js';

@Controller('readings')
export class ReadingsIngestController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.readingsService.create(body);
  }

  @Post('batch')
  createBatch(@Body() body: unknown) {
    return this.readingsService.createBatch(body);
  }
}

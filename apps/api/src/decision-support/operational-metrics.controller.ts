import { Controller, Get } from '@nestjs/common';
import { DecisionSupportService } from './decision-support.service.js';

// Asama 9 madde 20-23: GET /metrics/operations
@Controller('metrics')
export class OperationalMetricsController {
  constructor(private readonly decisionSupportService: DecisionSupportService) {}

  @Get('operations')
  getOperationalMetrics() {
    return this.decisionSupportService.getOperationalMetrics();
  }
}

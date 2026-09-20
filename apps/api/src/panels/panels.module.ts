import { Module } from '@nestjs/common';
import { RiskEngineModule } from '../risk-engine/risk-engine.module.js';
import { DecisionSupportModule } from '../decision-support/decision-support.module.js';
import { PanelsController } from './panels.controller.js';
import { PanelsService } from './panels.service.js';

@Module({
  imports: [RiskEngineModule, DecisionSupportModule],
  controllers: [PanelsController],
  providers: [PanelsService],
  exports: [PanelsService],
})
export class PanelsModule {}

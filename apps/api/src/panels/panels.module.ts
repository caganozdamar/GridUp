import { Module } from '@nestjs/common';
import { RiskEngineModule } from '../risk-engine/risk-engine.module.js';
import { PanelsController } from './panels.controller.js';
import { PanelsService } from './panels.service.js';

@Module({
  imports: [RiskEngineModule],
  controllers: [PanelsController],
  providers: [PanelsService],
  exports: [PanelsService],
})
export class PanelsModule {}

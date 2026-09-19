import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { RiskEngineModule } from '../risk-engine/risk-engine.module.js';
import { ReadingsController } from './readings.controller.js';
import { ReadingsIngestController } from './readings-ingest.controller.js';
import { ReadingsService } from './readings.service.js';

@Module({
  imports: [PanelsModule, RiskEngineModule],
  controllers: [ReadingsController, ReadingsIngestController],
  providers: [ReadingsService],
})
export class ReadingsModule {}

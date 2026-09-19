import { Module } from '@nestjs/common';
import { ScadaController } from './scada.controller.js';
import { ScadaService } from './scada.service.js';

@Module({
  controllers: [ScadaController],
  providers: [ScadaService],
})
export class ScadaModule {}

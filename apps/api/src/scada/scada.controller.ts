import { Controller, Get } from '@nestjs/common';
import { ScadaService } from './scada.service.js';

// Asama 7: SCADA Gateway (apps/scada-gateway) bu tek endpoint'i belirli
// araliklarla poll eder; veritabanina dogrudan baglanmaz.
@Controller('scada')
export class ScadaController {
  constructor(private readonly scadaService: ScadaService) {}

  @Get('panels')
  getPanels() {
    return this.scadaService.getPanelsSnapshot();
  }
}

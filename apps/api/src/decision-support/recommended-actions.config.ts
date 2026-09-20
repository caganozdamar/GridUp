// Asama 9 madde 7-9: deterministic inspection guidance mapping. Merkezi ve
// tek yerde tutulur; AnomalyType enum degerleri @grid-up/shared'dan (Prisma
// schema.prisma ile senkron) birebir kullanilir, uydurma enum yoktur.
//
// Asama 9 madde 8 (action safety): bu mesajlar yalnizca INSPECTION-ORIENTED,
// NON-INVASIVE, MONITORING-ORIENTED olmalidir. Energized ekipmana mudahale,
// breaker ac/kapat, protection relay ayari, bypass veya equipment control
// oneren hicbir metin buraya EKLENMEMELIDIR.

import { AnomalyType } from '@grid-up/shared';

export const RECOMMENDED_ACTION_MESSAGES: Record<AnomalyType, string> = {
  [AnomalyType.HIGH_TEMPERATURE]: 'Inspect cable terminations, connection points and local heat sources.',
  [AnomalyType.TEMPERATURE_RISE]: 'Check for increasing load or developing thermal hotspots.',
  [AnomalyType.OVERCURRENT]: 'Inspect conductor loading and compare current with expected operating conditions.',
  [AnomalyType.HIGH_HUMIDITY]: 'Inspect enclosure moisture, ventilation and environmental sealing.',
  [AnomalyType.MULTI_SENSOR_RISK]: 'Prioritize inspection: multiple sensor conditions are increasing simultaneously.',
};

export const RECOMMENDED_ACTIONS_SAFETY_NOTE = 'Inspection guidance only. Follow authorized electrical safety procedures.';

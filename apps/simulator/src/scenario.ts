// Asama 4: her senaryo icin gercek (kademeli) ariza davranisi
// sensor-generator.ts icinde implemente edilmistir.
export enum SimulationScenario {
  NORMAL = 'NORMAL',
  OVERHEATING = 'OVERHEATING',
  OVERCURRENT = 'OVERCURRENT',
  HIGH_HUMIDITY = 'HIGH_HUMIDITY',
  ARC_FLASH = 'ARC_FLASH',
  COMBINED_FAILURE = 'COMBINED_FAILURE',
}

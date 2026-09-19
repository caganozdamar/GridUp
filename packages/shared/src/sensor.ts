// Not: PARTIAL_DISCHARGE, ARC_FLASH, ACOUSTIC gelecekte buraya eklenebilir.
export enum SensorType {
  AMBIENT_TEMPERATURE = 'AMBIENT_TEMPERATURE',
  CABLE_TEMPERATURE = 'CABLE_TEMPERATURE',
  HUMIDITY = 'HUMIDITY',
  CURRENT = 'CURRENT',
}

export const SENSOR_UNITS: Record<SensorType, string> = {
  [SensorType.AMBIENT_TEMPERATURE]: '°C',
  [SensorType.CABLE_TEMPERATURE]: '°C',
  [SensorType.HUMIDITY]: '%',
  [SensorType.CURRENT]: 'A',
};

export interface Sensor {
  id: string;
  panelId: string;
  name: string;
  code: string;
  type: SensorType;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  timestamp: string;
}

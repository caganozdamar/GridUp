// ARC_FLASH: optik yogunluk (% - ani isik patlamasi). ACOUSTIC: pano ici ses
// seviyesi (dB) - kismi desarj / ark carpma sesi gostergesi.
export enum SensorType {
  AMBIENT_TEMPERATURE = 'AMBIENT_TEMPERATURE',
  CABLE_TEMPERATURE = 'CABLE_TEMPERATURE',
  HUMIDITY = 'HUMIDITY',
  CURRENT = 'CURRENT',
  ARC_FLASH = 'ARC_FLASH',
  ACOUSTIC = 'ACOUSTIC',
}

export const SENSOR_UNITS: Record<SensorType, string> = {
  [SensorType.AMBIENT_TEMPERATURE]: '°C',
  [SensorType.CABLE_TEMPERATURE]: '°C',
  [SensorType.HUMIDITY]: '%',
  [SensorType.CURRENT]: 'A',
  [SensorType.ARC_FLASH]: '%',
  [SensorType.ACOUSTIC]: 'dB',
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

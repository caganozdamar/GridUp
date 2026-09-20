import { PanelStatus, SensorType } from '@grid-up/shared';

export interface ApiPanel {
  id: string;
  code: string;
  name: string;
  status: PanelStatus;
}

export interface ApiSensor {
  id: string;
  panelId: string;
  code: string;
  type: SensorType;
  isActive: boolean;
}

export interface DiscoveredPanel {
  id: string;
  code: string;
  sensorsByType: Partial<Record<SensorType, ApiSensor>>;
}

export interface PanelSensorState {
  ambientTemperature: number;
  cableTemperature: number;
  humidity: number;
  current: number;
  /** Ark flash optik yogunlugu (%). */
  arcFlash: number;
  /** Akustik seviye (dB) - kismi desarj / ark gostergesi. */
  acoustic: number;
}

export interface BatchReadingInput {
  sensorId: string;
  value: number;
  timestamp: string;
}

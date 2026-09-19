export enum AnomalyType {
  TEMPERATURE_RISE = 'TEMPERATURE_RISE',
  HIGH_TEMPERATURE = 'HIGH_TEMPERATURE',
  HIGH_HUMIDITY = 'HIGH_HUMIDITY',
  OVERCURRENT = 'OVERCURRENT',
  MULTI_SENSOR_RISK = 'MULTI_SENSOR_RISK',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Anomaly {
  id: string;
  panelId: string;
  sensorId: string | null;
  type: AnomalyType;
  severity: Severity;
  message: string;
  detectedAt: string;
  resolvedAt: string | null;
}

import { SENSOR_UNITS, SensorType, type Sensor } from '@grid-up/shared';

const SENSOR_LABELS: Record<SensorType, string> = {
  [SensorType.AMBIENT_TEMPERATURE]: 'Ambient Temperature',
  [SensorType.CABLE_TEMPERATURE]: 'Cable Temperature',
  [SensorType.HUMIDITY]: 'Humidity',
  [SensorType.CURRENT]: 'Current',
};

export function SensorCard({ sensor, value }: { sensor: Sensor; value: number | null }) {
  return (
    <div className="sensor-card">
      <div className="sensor-card-label">{SENSOR_LABELS[sensor.type]}</div>
      <div className="sensor-card-value">
        {value !== null ? value.toFixed(1) : '—'}
        <span className="sensor-card-unit">{SENSOR_UNITS[sensor.type]}</span>
      </div>
    </div>
  );
}

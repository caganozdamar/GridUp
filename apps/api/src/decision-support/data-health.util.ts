// Asama 9 madde 11-14: Sensor / Module Health.
//
// Fikir SCADA Gateway'deki stale-data mekanizmasindan (bkz.
// apps/scada-gateway/src/encode.ts#isSnapshotFresh) alinmistir, ancak
// register-encoding logic'i buraya kopyalanmamistir - bu, aynı "en son
// reading ne kadar eski?" sorusuna panel-seviyesinde cevap veren, bagimsiz
// kucuk bir derived model'dir.

import { DataHealthStatus, type PanelDataHealth } from '@grid-up/shared';

export interface SensorFreshness {
  sensorId: string;
  lastReadingAt: Date | null;
}

export function computeDataHealth(sensors: SensorFreshness[], now: Date, staleMs: number): PanelDataHealth {
  if (sensors.length === 0) {
    return { status: DataHealthStatus.NO_DATA, lastSensorUpdate: null, staleSensorCount: 0 };
  }

  let lastSensorUpdate: Date | null = null;
  let staleSensorCount = 0;

  for (const sensor of sensors) {
    if (sensor.lastReadingAt === null) {
      staleSensorCount++;
      continue;
    }
    if (!lastSensorUpdate || sensor.lastReadingAt > lastSensorUpdate) {
      lastSensorUpdate = sensor.lastReadingAt;
    }
    if (now.getTime() - sensor.lastReadingAt.getTime() > staleMs) {
      staleSensorCount++;
    }
  }

  const status: DataHealthStatus =
    lastSensorUpdate === null
      ? DataHealthStatus.NO_DATA
      : staleSensorCount === 0
        ? DataHealthStatus.VALID
        : DataHealthStatus.STALE;

  return {
    status,
    lastSensorUpdate: lastSensorUpdate ? lastSensorUpdate.toISOString() : null,
    staleSensorCount,
  };
}

import { useEffect, useState } from 'react';
import type { Sensor, SensorType } from '@grid-up/shared';
import { panelsApi } from '../api/panels';
import { usePolling } from './usePolling';

export interface SensorSnapshot {
  sensor: Sensor;
  latestValue: number | null;
  latestTimestamp: string | null;
}

const READINGS_SNAPSHOT_LIMIT = 20;

/**
 * Bir panonun sensor konfigurasyonunu (statik, tek seferlik) ve en son
 * sensor degerlerini (polled) birlestirip SensorType -> SensorSnapshot
 * haritasi uretir. Overview kartlari ve Panel Detail sensor kartlari
 * tarafindan paylasilir.
 */
export function usePanelSensorSnapshot(panelId: string, intervalMs: number) {
  const [sensors, setSensors] = useState<Sensor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    panelsApi
      .sensors(panelId)
      .then((result) => {
        if (!cancelled) setSensors(result);
      })
      .catch(() => {
        if (!cancelled) setSensors(null);
      });
    return () => {
      cancelled = true;
    };
  }, [panelId]);

  const readingsPoll = usePolling(
    () => panelsApi.readings(panelId, { limit: READINGS_SNAPSHOT_LIMIT }),
    intervalMs,
    [panelId],
  );

  const snapshotByType = new Map<SensorType, SensorSnapshot>();
  if (sensors && readingsPoll.data) {
    const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]));
    const seen = new Set<string>();
    for (const reading of readingsPoll.data) {
      if (seen.has(reading.sensorId)) continue;
      seen.add(reading.sensorId);
      const sensor = sensorById.get(reading.sensorId);
      if (!sensor) continue;
      snapshotByType.set(sensor.type, {
        sensor,
        latestValue: reading.value,
        latestTimestamp: reading.timestamp,
      });
    }
  }

  return { sensors, snapshotByType, ...readingsPoll };
}

// Kucuk, saf (side-effect'siz) matematik yardimcilari.
// Prisma/NestJS'e bagimliligi yok, bu yuzden Prisma client generate edilmeden
// de unit test edilebilir.

export type Anchor = readonly [value: number, score: number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `anchors` icindeki (value, score) noktalari arasinda linear interpolation
 * yaparak 0-100 araliginda kademeli bir skor uretir. Ilk noktadan kucuk
 * degerler ilk skora, son noktadan buyuk degerler son skora clamplanir.
 * Bant sinirlarinda ani sicramalar olmamasini saglar (orn. 54.9 ile 55.1
 * arasinda anlamli bir fark olmaz).
 */
export function piecewiseLinearScore(value: number, anchors: readonly Anchor[]): number {
  if (anchors.length === 0) return 0;

  const first = anchors[0];
  if (value <= first[0]) return first[1];

  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (value >= x0 && value <= x1) {
      const ratio = (value - x0) / (x1 - x0);
      return y0 + ratio * (y1 - y0);
    }
  }

  return last[1];
}

export interface TimedValue {
  value: number;
  timestamp: Date;
}

export interface SensorStats {
  latest: number;
  average: number;
  minimum: number;
  maximum: number;
  delta: number;
  trendPerMinute: number;
  sampleCount: number;
}

/**
 * `readingsDesc`, en yeni ilk sirada olacak sekilde siralanmis olmalidir
 * (Prisma'nin `orderBy: { timestamp: 'desc' }` sonucu gibi).
 */
export function computeSensorStats(readingsDesc: TimedValue[]): SensorStats | null {
  if (readingsDesc.length === 0) return null;

  const chronological = [...readingsDesc].reverse();
  const values = chronological.map((reading) => reading.value);

  const latest = values[values.length - 1];
  const first = values[0];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const delta = latest - first;

  const firstTimestamp = chronological[0].timestamp.getTime();
  const lastTimestamp = chronological[chronological.length - 1].timestamp.getTime();
  const durationMinutes = (lastTimestamp - firstTimestamp) / 60_000;

  // Ornekler arasindaki sure cok kisaysa (ayni tick, ayni timestamp gibi)
  // oran kararsizlasir; bu durumda trend'i duz kabul et.
  const trendPerMinute = durationMinutes > 0.001 ? delta / durationMinutes : 0;

  return { latest, average, minimum, maximum, delta, trendPerMinute, sampleCount: values.length };
}

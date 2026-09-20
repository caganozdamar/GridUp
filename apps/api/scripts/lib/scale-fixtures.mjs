// Olcek/kaynak testlerinin ortak fikstur yardimcilari. Gercek bir API'ye karsi
// calisan test betikleri, izole ve gecici bir "Site + Panolar + Sensorler"
// olusturup sonunda siler; mevcut demo verisine dokunmaz.

export const SENSOR_TYPES = [
  { suffix: 'AMB-TEMP', type: 'AMBIENT_TEMPERATURE', unit: '°C', range: [24, 32] },
  { suffix: 'CABLE-TEMP', type: 'CABLE_TEMPERATURE', unit: '°C', range: [30, 45] },
  { suffix: 'HUM', type: 'HUMIDITY', unit: '%', range: [35, 60] },
  { suffix: 'CURRENT', type: 'CURRENT', unit: 'A', range: [60, 110] },
  // Normal calisma araliklari (simulator NORMAL senaryosuyla ayni): alarm uretmez.
  { suffix: 'ARC', type: 'ARC_FLASH', unit: '%', range: [0, 3] },
  { suffix: 'ACOUSTIC', type: 'ACOUSTIC', unit: 'dB', range: [35, 45] },
];

export function randomInRange([min, max]) {
  return min + Math.random() * (max - min);
}

export async function setupFixtures(prisma, { panelCount, prefix, runId }) {
  const site = await prisma.site.create({
    data: { name: `${prefix} Site ${runId}`, code: `${prefix}-SITE-${runId}` },
  });

  const panels = [];
  for (let i = 1; i <= panelCount; i++) {
    const panelCode = `${prefix}-${runId}-${String(i).padStart(3, '0')}`;
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: panelCode, code: panelCode, status: 'ONLINE' },
    });

    const sensors = [];
    for (const def of SENSOR_TYPES) {
      const sensor = await prisma.sensor.create({
        data: { panelId: panel.id, name: def.suffix, code: `${panelCode}-${def.suffix}`, type: def.type, unit: def.unit },
      });
      sensors.push({ id: sensor.id, range: def.range });
    }
    panels.push({ id: panel.id, sensors });
  }

  return { site, panels };
}

export async function cleanupFixtures(prisma, site) {
  const panels = await prisma.panel.findMany({ where: { siteId: site.id }, select: { id: true } });
  const panelIds = panels.map((p) => p.id);

  await prisma.sensor.deleteMany({ where: { panelId: { in: panelIds } } });
  await prisma.panel.deleteMany({ where: { id: { in: panelIds } } });
  await prisma.site.delete({ where: { id: site.id } });
}

export function buildTickReadings(panels, timestamp = new Date().toISOString()) {
  const readings = [];
  for (const panel of panels) {
    for (const sensor of panel.sensors) {
      readings.push({ sensorId: sensor.id, value: randomInRange(sensor.range), timestamp });
    }
  }
  return readings;
}

export async function postBatch(apiBaseUrl, readings) {
  const start = performance.now();
  const res = await fetch(`${apiBaseUrl}/readings/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readings }),
  });
  const elapsedMs = performance.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, elapsedMs, error: `${res.status} ${res.statusText} ${text}`, inserted: 0 };
  }

  const body = await res.json();
  return { ok: true, elapsedMs, inserted: body.inserted, error: null };
}

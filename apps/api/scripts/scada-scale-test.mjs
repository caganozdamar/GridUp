// Asama 7 madde 18: 100 pano / 400 sensor / 400 reading-per-tick olcek testi.
//
// Bu script GERCEK, calisan bir API'ye (npm run dev:api, port API_PORT ya da
// 3000) karsi calisir ve GERCEK Postgres'e (docker-compose) izole, gecici
// test verisi yazar. Mevcut demo verisini (PANO-001..005) HICBIR SEKILDE
// degistirmez; kendi "SCALE-TEST-*" kod alaninda calisir ve `finally`
// blogunda olusturdugu her seyi siler.
//
// Kullanim:
//   node apps/api/scripts/scada-scale-test.mjs
//
// On kosul: API ayakta olmali (npm run dev:api) ve Postgres erisilebilir olmali.

import { PrismaClient } from '@prisma/client';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const PANEL_COUNT = 100;
const SENSOR_TYPES = [
  { suffix: 'AMB-TEMP', type: 'AMBIENT_TEMPERATURE', unit: '°C', range: [24, 32] },
  { suffix: 'CABLE-TEMP', type: 'CABLE_TEMPERATURE', unit: '°C', range: [30, 45] },
  { suffix: 'HUM', type: 'HUMIDITY', unit: '%', range: [35, 60] },
  { suffix: 'CURRENT', type: 'CURRENT', unit: 'A', range: [60, 110] },
];
const TICK_COUNT = 5;
const RUN_ID = Date.now();
const SITE_CODE = `SCALE-TEST-SITE-${RUN_ID}`;

const prisma = new PrismaClient();

function randomInRange([min, max]) {
  return min + Math.random() * (max - min);
}

async function setupFixtures() {
  const site = await prisma.site.create({
    data: { name: `Scalability Test Site ${RUN_ID}`, code: SITE_CODE },
  });

  const panels = [];
  for (let i = 1; i <= PANEL_COUNT; i++) {
    const panelCode = `SCALE-TEST-${RUN_ID}-${String(i).padStart(3, '0')}`;
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: panelCode, code: panelCode, status: 'ONLINE' },
    });

    const sensors = [];
    for (const def of SENSOR_TYPES) {
      const sensor = await prisma.sensor.create({
        data: {
          panelId: panel.id,
          name: def.suffix,
          code: `${panelCode}-${def.suffix}`,
          type: def.type,
          unit: def.unit,
        },
      });
      sensors.push({ id: sensor.id, range: def.range });
    }

    panels.push({ id: panel.id, sensors });
  }

  return { site, panels };
}

async function cleanupFixtures(site) {
  const panels = await prisma.panel.findMany({ where: { siteId: site.id }, select: { id: true } });
  const panelIds = panels.map((p) => p.id);

  await prisma.sensor.deleteMany({ where: { panelId: { in: panelIds } } });
  await prisma.panel.deleteMany({ where: { id: { in: panelIds } } });
  await prisma.site.delete({ where: { id: site.id } });
}

function buildTickReadings(panels) {
  const timestamp = new Date().toISOString();
  const readings = [];
  for (const panel of panels) {
    for (const sensor of panel.sensors) {
      readings.push({ sensorId: sensor.id, value: randomInRange(sensor.range), timestamp });
    }
  }
  return readings;
}

async function postBatch(readings) {
  const start = performance.now();
  const res = await fetch(`${API_BASE_URL}/readings/batch`, {
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

async function main() {
  console.log('='.repeat(60));
  console.log('SCADA/GRID UP - 100 Panel Scalability Test');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Panels: ${PANEL_COUNT} | Sensors/panel: ${SENSOR_TYPES.length} | Ticks: ${TICK_COUNT}`);
  console.log('');

  console.log('Creating isolated test fixtures (temporary Site/Panels/Sensors)...');
  const fixtureStart = performance.now();
  const { site, panels } = await setupFixtures();
  const fixtureMs = performance.now() - fixtureStart;
  console.log(
    `Created ${panels.length} panels, ${panels.length * SENSOR_TYPES.length} sensors in ${fixtureMs.toFixed(0)}ms`,
  );
  console.log('');

  const tickResults = [];

  try {
    for (let tick = 1; tick <= TICK_COUNT; tick++) {
      const readings = buildTickReadings(panels);
      const result = await postBatch(readings);
      tickResults.push({ tick, readingsSent: readings.length, ...result });

      console.log(
        `Tick ${tick}/${TICK_COUNT}: sent=${readings.length} inserted=${result.inserted} ok=${result.ok} time=${result.elapsedMs.toFixed(1)}ms${result.error ? ` error="${result.error}"` : ''}`,
      );
    }
  } finally {
    console.log('');
    console.log('Cleaning up test fixtures...');
    const cleanupStart = performance.now();
    await cleanupFixtures(site);
    const cleanupMs = performance.now() - cleanupStart;
    console.log(`Cleanup done in ${cleanupMs.toFixed(0)}ms (no SCALE-TEST-* rows remain)`);
    await prisma.$disconnect();
  }

  const okResults = tickResults.filter((r) => r.ok);
  const failedResults = tickResults.filter((r) => !r.ok);
  const totalReadingsSent = tickResults.reduce((sum, r) => sum + r.readingsSent, 0);
  const totalInserted = tickResults.reduce((sum, r) => sum + r.inserted, 0);
  const avgMs = okResults.length > 0 ? okResults.reduce((sum, r) => sum + r.elapsedMs, 0) / okResults.length : 0;
  const maxMs = okResults.length > 0 ? Math.max(...okResults.map((r) => r.elapsedMs)) : 0;
  const minMs = okResults.length > 0 ? Math.min(...okResults.map((r) => r.elapsedMs)) : 0;

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS (real measurements, POST /readings/batch, incl. risk analysis)');
  console.log('='.repeat(60));
  console.log(`${PANEL_COUNT} panels | ${PANEL_COUNT * SENSOR_TYPES.length} sensors | ${SENSOR_TYPES.length * PANEL_COUNT} readings/tick | ${TICK_COUNT} ticks`);
  console.log(`Total readings sent   : ${totalReadingsSent}`);
  console.log(`Total inserted        : ${totalInserted}`);
  console.log(`Failed ticks          : ${failedResults.length}`);
  console.log(`Average batch time    : ${avgMs.toFixed(1)} ms`);
  console.log(`Min / Max batch time  : ${minMs.toFixed(1)} ms / ${maxMs.toFixed(1)} ms`);
  console.log('='.repeat(60));
}

main().catch(async (error) => {
  console.error('Scalability test failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

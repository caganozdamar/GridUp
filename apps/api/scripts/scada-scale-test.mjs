// Asama 7 madde 18: 100 pano / 600 sensor / 600 reading-per-tick olcek testi
// (pano basina 6 sensor tipi; ARC_FLASH ve ACOUSTIC eklendikten sonra guncellendi).
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
import { SENSOR_TYPES, buildTickReadings, cleanupFixtures, postBatch as postBatchTo, setupFixtures } from './lib/scale-fixtures.mjs';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const PANEL_COUNT = 100;
const TICK_COUNT = 5;
const RUN_ID = Date.now();

const prisma = new PrismaClient();

// API tek istekte en fazla 500 okuma kabul eder (readings exceeds maximum batch
// size); daha buyuk bir tick parcalara bolunur, tıpkı birden fazla modulu
// aggregate eden bir local gateway gibi.
const MAX_BATCH_SIZE = 500;

function postBatch(readings) {
  return postBatchTo(API_BASE_URL, readings);
}

// Mod A - "gateway": tum panolarin okumalari 500'luk parcalarla, sirayla gonderilir.
async function postAggregated(panels) {
  const readings = buildTickReadings(panels);
  const results = [];
  for (let i = 0; i < readings.length; i += MAX_BATCH_SIZE) {
    results.push(await postBatch(readings.slice(i, i + MAX_BATCH_SIZE)));
  }
  return combine(readings.length, results, results.reduce((sum, r) => sum + r.elapsedMs, 0));
}

// Mod B - "modul": her pano (modul) kendi kucuk batch'ini gonderir; 100 modul
// ayni anda istek atar (firmware'in gercek davranisi).
async function postPerModule(panels) {
  const start = performance.now();
  const perPanel = panels.map((panel) => buildTickReadings([panel]));
  const results = await Promise.all(perPanel.map((readings) => postBatch(readings)));
  return combine(perPanel.flat().length, results, performance.now() - start);
}

function combine(readingsSent, results, elapsedMs) {
  const failed = results.find((r) => !r.ok);
  return {
    readingsSent,
    elapsedMs,
    requests: results.length,
    inserted: results.reduce((sum, r) => sum + r.inserted, 0),
    ok: !failed,
    error: failed?.error ?? null,
  };
}

async function runMode(label, panels, sendTick) {
  console.log(`--- ${label}`);
  const results = [];
  for (let tick = 1; tick <= TICK_COUNT; tick++) {
    const result = await sendTick(panels);
    results.push({ tick, ...result });
    console.log(
      `Tick ${tick}/${TICK_COUNT}: requests=${result.requests} sent=${result.readingsSent} inserted=${result.inserted} ok=${result.ok} time=${result.elapsedMs.toFixed(1)}ms${result.error ? ` error="${result.error}"` : ''}`,
    );
  }
  console.log('');
  return results;
}

function summarize(label, results) {
  const ok = results.filter((r) => r.ok);
  const times = ok.map((r) => r.elapsedMs);
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  console.log(label);
  console.log(`  Requests/tick         : ${results[0]?.requests ?? 0}`);
  console.log(`  Total readings sent   : ${results.reduce((sum, r) => sum + r.readingsSent, 0)}`);
  console.log(`  Total inserted        : ${results.reduce((sum, r) => sum + r.inserted, 0)}`);
  console.log(`  Failed ticks          : ${results.length - ok.length}`);
  console.log(`  Average tick time     : ${avg.toFixed(1)} ms`);
  console.log(`  Min / Max tick time   : ${times.length ? Math.min(...times).toFixed(1) : 0} ms / ${times.length ? Math.max(...times).toFixed(1) : 0} ms`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('SCADA/GRID UP - 100 Panel Scalability Test');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Panels: ${PANEL_COUNT} | Sensors/panel: ${SENSOR_TYPES.length} | Ticks per mode: ${TICK_COUNT}`);
  console.log('');

  console.log('Creating isolated test fixtures (temporary Site/Panels/Sensors)...');
  const fixtureStart = performance.now();
  const { site, panels } = await setupFixtures(prisma, { panelCount: PANEL_COUNT, prefix: 'SCALE-TEST', runId: RUN_ID });
  const fixtureMs = performance.now() - fixtureStart;
  console.log(
    `Created ${panels.length} panels, ${panels.length * SENSOR_TYPES.length} sensors in ${fixtureMs.toFixed(0)}ms`,
  );
  console.log('');

  let aggregated = [];
  let perModule = [];

  try {
    aggregated = await runMode(`Mode A: gateway, chunks of ${MAX_BATCH_SIZE} readings, sequential`, panels, postAggregated);
    perModule = await runMode('Mode B: 100 modules, one small batch each, concurrent', panels, postPerModule);
  } finally {
    console.log('Cleaning up test fixtures...');
    const cleanupStart = performance.now();
    await cleanupFixtures(prisma, site);
    const cleanupMs = performance.now() - cleanupStart;
    console.log(`Cleanup done in ${cleanupMs.toFixed(0)}ms (no SCALE-TEST-* rows remain)`);
    await prisma.$disconnect();
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS (real measurements, POST /readings/batch, incl. risk analysis)');
  console.log('='.repeat(60));
  console.log(`${PANEL_COUNT} panels | ${PANEL_COUNT * SENSOR_TYPES.length} sensors | ${PANEL_COUNT * SENSOR_TYPES.length} readings/tick | ${TICK_COUNT} ticks per mode`);
  summarize('Mode A (gateway, 500-reading chunks):', aggregated);
  summarize('Mode B (100 modules, concurrent):', perModule);
  console.log('='.repeat(60));
}

main().catch(async (error) => {
  console.error('Scalability test failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

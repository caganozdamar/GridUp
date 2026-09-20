// Kaynak kullanimi olcumu: 100 modul (pano) x 6 sensor, GERCEK bir API'ye ve
// GERCEK Postgres'e karsi. Uc seyi olcer:
//
//  1) Veri hacmi: okuma ve risk skoru satirinin diskte (indeksler dahil)
//     gercekte kapladigi bayt; canli yuk sirasinda tablo buyumesi.
//  2) Kaynak: API sureci ve Postgres container'i icin CPU/RAM (canli yuk sirasinda).
//  3) Hacimli tabloda gecikme: istegin suresi ve sicak sorgu, tabloya once
//     milyonlarca gecmis okuma yazildiktan sonra.
//
// GELISTIRME VERISINE DOKUNMAZ ama tabloyu milyonlarca satirla sisirir; bu
// yuzden ATILABILIR, AYRI bir veritabaninda calistirilmalidir (bkz.
// docs/resource-usage.md "Nasil tekrarlanir"). Betik kendi fiksturlerini siler.
//
// Ortam degiskenleri:
//   DATABASE_URL       olcum veritabani (Prisma okur)
//   API_BASE_URL       bu veritabanina bagli API (varsayilan http://localhost:3000)
//   API_PID            API sureci (CPU/RAM icin); yoksa API kaynagi olculmez
//   PG_CONTAINER       docker Postgres container adi (varsayilan grid-up-postgres)
//   PRELOAD_TICKS      onceden yazilacak gecmis tick sayisi (varsayilan 5000 = 3 milyon satir)
//   LIVE_TICKS         canli yuk tick sayisi, 2 sn araliklarla (varsayilan 60)
//   RESULT_JSON        sonuclarin yazilacagi dosya (opsiyonel)

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { SENSOR_TYPES, buildTickReadings, cleanupFixtures, postBatch, setupFixtures } from './lib/scale-fixtures.mjs';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const API_PID = process.env.API_PID ? Number(process.env.API_PID) : null;
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'grid-up-postgres';
const PANEL_COUNT = 100;
const PRELOAD_TICKS = Number(process.env.PRELOAD_TICKS ?? 5000);
const LIVE_TICKS = Number(process.env.LIVE_TICKS ?? 60);
const TICK_INTERVAL_MS = 2000;
const RUN_ID = Date.now();

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const round = (value, digits = 1) => Number(value.toFixed(digits));

// ---- kaynak ornekleme -------------------------------------------------------

// /proc/<pid>/stat: utime (14. alan) + stime (15. alan), saat tiki (CLK_TCK = 100).
function cpuTicks(pid) {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return Number(fields[11]) + Number(fields[12]);
}

function rssMb(pid) {
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  const kb = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
  return kb / 1024;
}

// "123.4MiB / 15.3GiB" -> MB
function memToMb(text) {
  const match = /([\d.]+)\s*([KMG]i?B)/i.exec(text);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith('G')) return value * 1024;
  if (unit.startsWith('K')) return value / 1024;
  return value;
}

function startSampler() {
  const samples = { apiCpu: [], apiRssMb: [], pgCpu: [], pgMemMb: [] };
  let running = true;

  const apiLoop = (async () => {
    if (!API_PID) return;
    let last = { ticks: cpuTicks(API_PID), at: Date.now() };
    while (running) {
      await sleep(2000);
      const nowTicks = cpuTicks(API_PID);
      const now = Date.now();
      // Yuzde, TEK bir cekirdegin yuzdesidir (100 = bir cekirdek tam dolu).
      samples.apiCpu.push(((nowTicks - last.ticks) / 100 / ((now - last.at) / 1000)) * 100);
      samples.apiRssMb.push(rssMb(API_PID));
      last = { ticks: nowTicks, at: now };
    }
  })();

  const pgLoop = (async () => {
    while (running) {
      try {
        // Asenkron: bloklayici cagri olay dongusunu (ve yuk dongusunu) durdururdu.
        const { stdout } = await execFileAsync('docker', [
          'stats',
          '--no-stream',
          '--format',
          '{{.CPUPerc}}|{{.MemUsage}}',
          PG_CONTAINER,
        ]);
        const [cpu, mem] = stdout.trim().split('|');
        samples.pgCpu.push(Number.parseFloat(cpu));
        samples.pgMemMb.push(memToMb(mem));
      } catch {
        return; // docker yoksa Postgres kaynagi olculmez
      }
      await sleep(1000);
    }
  })();

  return {
    stop: async () => {
      running = false;
      await Promise.all([apiLoop, pgLoop]);
      return samples;
    },
  };
}

// ---- veritabani boyutlari ---------------------------------------------------

async function tableStats(table) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT pg_total_relation_size('${table}')::bigint AS total,
            pg_relation_size('${table}')::bigint AS heap,
            pg_indexes_size('${table}')::bigint AS indexes,
            (SELECT count(*) FROM ${table})::bigint AS rows`,
  );
  return { total: Number(row.total), heap: Number(row.heap), indexes: Number(row.indexes), rows: Number(row.rows) };
}

async function hotQueryMs(sensorId) {
  const times = [];
  for (let i = 0; i < 20; i++) {
    const plan = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, FORMAT JSON) SELECT id, "sensorId", value, timestamp FROM sensor_readings
       WHERE "sensorId" = '${sensorId}' ORDER BY timestamp DESC LIMIT 10`,
    );
    times.push(plan[0]['QUERY PLAN'][0]['Execution Time']);
  }
  return percentile(times, 50);
}

async function timeGet(path, times = 20) {
  const samples = [];
  for (let i = 0; i < times; i++) {
    const start = performance.now();
    const res = await fetch(`${API_BASE_URL}${path}`);
    await res.arrayBuffer();
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    samples.push(performance.now() - start);
  }
  return { p50: round(percentile(samples, 50)), p95: round(percentile(samples, 95)), max: round(Math.max(...samples)) };
}

// ---- ana akis ---------------------------------------------------------------

async function preload(siteId, ticks) {
  // Gecmis okumalar: her sensor icin `ticks` adet, 2 sn arayla, simdiden geriye.
  // Canli (yeni) okumalar hep bunlarin ustunde olur.
  const chunk = 500;
  for (let from = 1; from <= ticks; from += chunk) {
    const to = Math.min(ticks, from + chunk - 1);
    await prisma.$executeRawUnsafe(
      `INSERT INTO sensor_readings (id, "sensorId", value, timestamp)
       SELECT gen_random_uuid()::text, s.id, 20 + random() * 60, now() - (g * interval '2 seconds') - interval '1 hour'
       FROM sensors s
       CROSS JOIN generate_series(${from}, ${to}) AS g
       WHERE s."panelId" IN (SELECT id FROM panels WHERE "siteId" = '${siteId}')`,
    );
  }
}

async function main() {
  const readingsPerTick = PANEL_COUNT * SENSOR_TYPES.length;
  console.log('='.repeat(64));
  console.log('GRID UP - resource usage test');
  console.log('='.repeat(64));
  console.log(`API: ${API_BASE_URL} | panels: ${PANEL_COUNT} | sensors/panel: ${SENSOR_TYPES.length} | API pid: ${API_PID ?? 'n/a'}`);
  console.log(`Preload: ${PRELOAD_TICKS} ticks (${(PRELOAD_TICKS * readingsPerTick).toLocaleString('en')} rows) | live: ${LIVE_TICKS} ticks x ${TICK_INTERVAL_MS / 1000}s`);
  console.log('');

  const { site, panels } = await setupFixtures(prisma, { panelCount: PANEL_COUNT, prefix: 'RES-TEST', runId: RUN_ID });
  const result = { panels: PANEL_COUNT, sensorsPerPanel: SENSOR_TYPES.length, readingsPerTick };

  try {
    // Bir modulun bir tick'te yolladigi govdenin gercek boyutu.
    const oneModuleBody = JSON.stringify({ readings: buildTickReadings([panels[0]]) });
    result.payloadBytesPerModuleTick = Buffer.byteLength(oneModuleBody);

    console.log(`Preloading ${PRELOAD_TICKS} historical ticks...`);
    const preloadStart = performance.now();
    await preload(site.id, PRELOAD_TICKS);
    await prisma.$executeRawUnsafe('ANALYZE sensor_readings');
    result.preloadSeconds = round((performance.now() - preloadStart) / 1000);

    const readingsBefore = await tableStats('sensor_readings');
    const scoresBefore = await tableStats('risk_scores');
    result.afterPreload = { readings: readingsBefore, riskScores: scoresBefore };
    console.log(`Preloaded ${readingsBefore.rows.toLocaleString('en')} rows in ${result.preloadSeconds}s, table ${(readingsBefore.total / 1e6).toFixed(0)} MB`);

    // ---- canli yuk: 100 modul, her biri 2 sn'de bir kendi 6 okumasini yollar
    console.log(`Live load: ${LIVE_TICKS} ticks...`);
    const sampler = startSampler();
    const tickWallMs = [];
    const requestMs = [];
    let failed = 0;
    for (let tick = 1; tick <= LIVE_TICKS; tick++) {
      const tickStart = performance.now();
      const results = await Promise.all(panels.map((panel) => postBatch(API_BASE_URL, buildTickReadings([panel]))));
      const wall = performance.now() - tickStart;
      tickWallMs.push(wall);
      for (const r of results) {
        requestMs.push(r.elapsedMs);
        if (!r.ok) failed++;
      }
      await sleep(Math.max(0, TICK_INTERVAL_MS - wall));
    }
    const samples = await sampler.stop();

    result.live = {
      ticks: LIVE_TICKS,
      requests: requestMs.length,
      failedRequests: failed,
      tickWallMs: { avg: round(avg(tickWallMs)), p95: round(percentile(tickWallMs, 95)), max: round(Math.max(...tickWallMs)) },
      requestMs: { p50: round(percentile(requestMs, 50)), p95: round(percentile(requestMs, 95)), max: round(Math.max(...requestMs)) },
      apiCpuPercentOfOneCore: { avg: round(avg(samples.apiCpu)), max: round(Math.max(0, ...samples.apiCpu)) },
      apiRssMb: { avg: round(avg(samples.apiRssMb)), max: round(Math.max(0, ...samples.apiRssMb)) },
      postgresCpuPercentOfOneCore: { avg: round(avg(samples.pgCpu)), max: round(Math.max(0, ...samples.pgCpu)) },
      postgresMemMb: { avg: round(avg(samples.pgMemMb)), max: round(Math.max(0, ...samples.pgMemMb)) },
    };

    const readingsAfter = await tableStats('sensor_readings');
    const scoresAfter = await tableStats('risk_scores');
    const addedReadings = readingsAfter.rows - readingsBefore.rows;
    const addedScores = scoresAfter.rows - scoresBefore.rows;
    result.growth = {
      readingsRowsAdded: addedReadings,
      riskScoreRowsAdded: addedScores,
      // Indeksler dahil, satir basina gercek bayt (tablo boyutu / satir sayisi).
      readingBytesPerRow: round(readingsAfter.total / readingsAfter.rows),
      readingHeapBytesPerRow: round(readingsAfter.heap / readingsAfter.rows),
      readingIndexBytesPerRow: round(readingsAfter.indexes / readingsAfter.rows),
      riskScoreBytesPerRow: scoresAfter.rows > 0 ? round(scoresAfter.total / scoresAfter.rows) : null,
      // Canli sirada eklenen satirlarin marjinal maliyeti.
      readingMarginalBytesPerRow: addedReadings > 0 ? round((readingsAfter.total - readingsBefore.total) / addedReadings) : null,
      riskScoreMarginalBytesPerRow: addedScores > 0 ? round((scoresAfter.total - scoresBefore.total) / addedScores) : null,
    };
    result.afterLive = { readings: readingsAfter, riskScores: scoresAfter };

    // ---- hacimli tabloda gecikme
    const firstSensor = panels[0].sensors[0].id;
    result.hotQueryMsP50 = round(await hotQueryMs(firstSensor), 3);
    result.endpointMs = {
      panels: await timeGet('/panels'),
      scadaPanels: await timeGet('/scada/panels'),
    };
  } finally {
    console.log('Cleaning up fixtures...');
    await cleanupFixtures(prisma, site);
    await prisma.$disconnect();
  }

  console.log('');
  console.log(JSON.stringify(result, null, 2));
  if (process.env.RESULT_JSON) writeFileSync(process.env.RESULT_JSON, JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  console.error('Resource usage test failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

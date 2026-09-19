import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';

// Bu suite gercek Postgres'e (docker-compose.yml -> grid-up-postgres) karsi
// calisir; anomaly/alarm lifecycle'inin ("duplicate olusmuyor", "normale
// donunce resolve ediliyor") gercek Prisma davranisiyla dogrulanmasi icin
// mock yerine bilerek gercek DB kullanilir. Her test kendi Site/Panel/Sensor
// setini olusturup sonunda temizler.

// Cable temperature component skoru 55 esigini gecsin diye 57'nin uzerinde
// bir deger secildi (bkz. CABLE_TEMPERATURE_ANCHORS: (55,50)-(65,75)).
const CABLE_TEMP_ANOMALY_THRESHOLD = 60;

describe('RiskEngineService (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let riskEngine: RiskEngineService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    riskEngine = app.get(RiskEngineService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTestPanel(suffix: string) {
    const site = await prisma.site.create({
      data: { name: `Risk Engine Test Site ${suffix}`, code: `RISK-TEST-SITE-${suffix}` },
    });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Risk Test Panel ${suffix}`, code: `RISK-TEST-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cableSensor = await prisma.sensor.create({
      data: {
        panelId: panel.id,
        name: 'Cable Temperature',
        code: `RISK-TEST-${suffix}-CABLE-TEMP`,
        type: 'CABLE_TEMPERATURE',
        unit: '°C',
      },
    });
    const currentSensor = await prisma.sensor.create({
      data: {
        panelId: panel.id,
        name: 'Current',
        code: `RISK-TEST-${suffix}-CURRENT`,
        type: 'CURRENT',
        unit: 'A',
      },
    });

    return { site, panel, cableSensor, currentSensor };
  }

  async function cleanupTestPanel(ctx: Awaited<ReturnType<typeof createTestPanel>>) {
    await prisma.sensor.deleteMany({ where: { panelId: ctx.panel.id } });
    await prisma.panel.delete({ where: { id: ctx.panel.id } });
    await prisma.site.delete({ where: { id: ctx.site.id } });
  }

  async function feedReadings(sensorId: string, values: number[]) {
    const now = Date.now();
    for (const [index, value] of values.entries()) {
      await prisma.sensorReading.create({
        data: { sensorId, value, timestamp: new Date(now + index * 2000) },
      });
    }
  }

  it('does not create a duplicate active anomaly when risk stays elevated across ticks', async () => {
    const ctx = await createTestPanel('DUP-ANOMALY');
    try {
      await feedReadings(ctx.cableSensor.id, Array(10).fill(CABLE_TEMP_ANOMALY_THRESHOLD));

      await riskEngine.analyzePanels([ctx.panel.id]);
      await riskEngine.analyzePanels([ctx.panel.id]);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const anomalies = await prisma.anomaly.findMany({
        where: { panelId: ctx.panel.id, type: 'HIGH_TEMPERATURE', resolvedAt: null },
      });
      expect(anomalies).toHaveLength(1);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('resolves an anomaly once the condition clears', async () => {
    const ctx = await createTestPanel('RESOLVE-ANOMALY');
    try {
      await feedReadings(ctx.cableSensor.id, Array(10).fill(CABLE_TEMP_ANOMALY_THRESHOLD));
      await riskEngine.analyzePanels([ctx.panel.id]);

      const active = await prisma.anomaly.findFirst({
        where: { panelId: ctx.panel.id, type: 'HIGH_TEMPERATURE', resolvedAt: null },
      });
      expect(active).not.toBeNull();

      // Panel cools back down to a normal cable temperature.
      await feedReadings(ctx.cableSensor.id, Array(10).fill(38));
      await riskEngine.analyzePanels([ctx.panel.id]);

      const stillActive = await prisma.anomaly.findFirst({
        where: { panelId: ctx.panel.id, type: 'HIGH_TEMPERATURE', resolvedAt: null },
      });
      expect(stillActive).toBeNull();

      const resolved = await prisma.anomaly.findUnique({ where: { id: active!.id } });
      expect(resolved?.resolvedAt).not.toBeNull();
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  // Cable temperature ve current birlikte, gercekci bir OVERHEATING+overcurrent
  // gelisimiyle yukseliyor: hem yuksek mutlak deger hem de hizli trend hem de
  // multi-sensor correlation bonusu devreye girip skoru HIGH/CRITICAL bandina tasir.
  const RISING_CABLE_TEMPS = [38, 41, 45, 50, 56, 63, 70, 78, 85, 92];
  const RISING_CURRENTS = [80, 90, 100, 110, 115, 120, 125, 130, 135, 140];

  it('does not create a duplicate active alarm while risk remains at the same severity', async () => {
    const ctx = await createTestPanel('DUP-ALARM');
    try {
      await feedReadings(ctx.cableSensor.id, RISING_CABLE_TEMPS);
      await feedReadings(ctx.currentSensor.id, RISING_CURRENTS);

      await riskEngine.analyzePanels([ctx.panel.id]);
      await riskEngine.analyzePanels([ctx.panel.id]);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const activeAlarms = await prisma.alarm.findMany({
        where: { panelId: ctx.panel.id, status: 'ACTIVE' },
      });
      expect(activeAlarms).toHaveLength(1);
      expect(['HIGH', 'CRITICAL']).toContain(activeAlarms[0].severity);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('resolves the active alarm once risk drops back to normal', async () => {
    const ctx = await createTestPanel('RESOLVE-ALARM');
    try {
      await feedReadings(ctx.cableSensor.id, RISING_CABLE_TEMPS);
      await feedReadings(ctx.currentSensor.id, RISING_CURRENTS);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const active = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, status: 'ACTIVE' } });
      expect(active).not.toBeNull();

      // Both sensors cool back down to their normal baseline (a fresh window
      // of 10 readings fully replaces the failure-window data).
      await feedReadings(ctx.cableSensor.id, Array(10).fill(38));
      await feedReadings(ctx.currentSensor.id, Array(10).fill(85));
      await riskEngine.analyzePanels([ctx.panel.id]);

      const stillActive = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, status: 'ACTIVE' } });
      expect(stillActive).toBeNull();

      const resolved = await prisma.alarm.findUnique({ where: { id: active!.id } });
      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.resolvedAt).not.toBeNull();
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('persists a RiskScore row per analysis and exposes it via computeAnalysis', async () => {
    const ctx = await createTestPanel('PERSIST-SCORE');
    try {
      await feedReadings(ctx.cableSensor.id, [38, 40, 43, 46, 50, 54, 58, 63, 68, 72]);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const scores = await prisma.riskScore.findMany({ where: { panelId: ctx.panel.id } });
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBeGreaterThanOrEqual(0);
      expect(scores[0].score).toBeLessThanOrEqual(100);

      const analysis = await riskEngine.computeAnalysis(ctx.panel.id);
      expect(analysis).not.toBeNull();
      expect(analysis!.components.trend).toBeGreaterThan(0);
      expect(analysis!.reasons.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });
});

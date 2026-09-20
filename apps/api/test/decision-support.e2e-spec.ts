import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';

// Bu suite gercek Postgres'e karsi calisir (bkz. risk-engine.e2e-spec.ts).
// Asama 9: decision support / early warning intelligence uctan uca testleri.

const HIGH_CABLE_TEMP = 90; // component=100 (>=85 clamp)
const HIGH_CURRENT = 170; // component=100 (>=170 clamp)
// notifications.e2e-spec.ts ile ayni recipe: temp=100,current=100,humidity~91.67
// + iki correlation bonusu (+18) => score ~92 (CRITICAL).
const CRITICAL_HUMIDITY = 90;

describe('Decision support (e2e, real DB)', () => {
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
      data: { name: `Decision Support Test Site ${suffix}`, code: `DS-TEST-SITE-${suffix}` },
    });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Decision Support Test Panel ${suffix}`, code: `DS-TEST-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cableSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Cable Temperature', code: `DS-TEST-${suffix}-CABLE-TEMP`, type: 'CABLE_TEMPERATURE', unit: '°C' },
    });
    const currentSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: `DS-TEST-${suffix}-CURRENT`, type: 'CURRENT', unit: 'A' },
    });

    return { site, panel, cableSensor, currentSensor };
  }

  async function cleanupTestPanel(ctx: Awaited<ReturnType<typeof createTestPanel>>) {
    await prisma.sensor.deleteMany({ where: { panelId: ctx.panel.id } });
    await prisma.panel.delete({ where: { id: ctx.panel.id } });
    await prisma.site.delete({ where: { id: ctx.site.id } });
  }

  async function feedFlatReadings(sensorId: string, value: number, count = 10, stepMs = 2000) {
    const now = Date.now();
    for (let index = 0; index < count; index++) {
      await prisma.sensorReading.create({
        data: { sensorId, value, timestamp: new Date(now + index * stepMs) },
      });
    }
  }

  it('GET /panels includes a VALID dataHealth for a panel with fresh readings', async () => {
    const ctx = await createTestPanel('DATA-HEALTH-VALID');
    try {
      await feedFlatReadings(ctx.cableSensor.id, 38);
      await feedFlatReadings(ctx.currentSensor.id, 85);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const res = await request(app.getHttpServer()).get('/panels').expect(200);
      const panel = (res.body as Array<{ id: string; dataHealth: { status: string; staleSensorCount: number } }>).find(
        (p) => p.id === ctx.panel.id,
      );
      expect(panel).toBeDefined();
      expect(panel!.dataHealth.status).toBe('VALID');
      expect(panel!.dataHealth.staleSensorCount).toBe(0);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id reports NO_DATA when no reading has ever arrived', async () => {
    const ctx = await createTestPanel('DATA-HEALTH-NODATA');
    try {
      const res = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}`).expect(200);
      expect(res.body.dataHealth.status).toBe('NO_DATA');
      expect(res.body.dataHealth.lastSensorUpdate).toBeNull();
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id reports STALE once readings are older than the stale threshold', async () => {
    const ctx = await createTestPanel('DATA-HEALTH-STALE');
    try {
      // 20s once tek bir eski reading (default stale threshold 10s).
      await prisma.sensorReading.create({
        data: { sensorId: ctx.cableSensor.id, value: 38, timestamp: new Date(Date.now() - 20_000) },
      });

      const res = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}`).expect(200);
      expect(res.body.dataHealth.status).toBe('STALE');
      expect(res.body.dataHealth.staleSensorCount).toBeGreaterThan(0);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id/risk includes a backwards-compatible trendEstimate + recommendedActions without removing latest/history', async () => {
    const ctx = await createTestPanel('RISK-EXTRAS');
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const res = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}/risk`).expect(200);
      expect(res.body).toHaveProperty('latest');
      expect(res.body).toHaveProperty('history');
      expect(res.body).toHaveProperty('trendEstimate');
      expect(res.body).toHaveProperty('recommendedActions');

      expect(['INSUFFICIENT_DATA', 'STABLE', 'RISING', 'CRITICAL']).toContain(res.body.trendEstimate.status);
      expect(Array.isArray(res.body.recommendedActions)).toBe(true);
      // HIGH_TEMPERATURE + OVERCURRENT flags should be active at this score.
      const sources = (res.body.recommendedActions as Array<{ source: string }>).map((a) => a.source);
      expect(sources).toContain('HIGH_TEMPERATURE');
      expect(sources).toContain('OVERCURRENT');
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id/risk reports CRITICAL trendEstimate once the panel is at/above the critical threshold', async () => {
    const ctx = await createTestPanel('RISK-CRITICAL-TREND');
    const humiditySensor = await prisma.sensor.create({
      data: {
        panelId: ctx.panel.id,
        name: 'Humidity',
        code: 'DS-TEST-RISK-CRITICAL-TREND-HUMIDITY',
        type: 'HUMIDITY',
        unit: '%',
      },
    });
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await feedFlatReadings(humiditySensor.id, CRITICAL_HUMIDITY);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const res = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}/risk`).expect(200);
      expect(res.body.latest.level).toBe('CRITICAL');
      expect(res.body.trendEstimate.status).toBe('CRITICAL');
      expect(res.body.trendEstimate.message).toBe('Critical threshold reached.');
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id/timeline derives risk level transitions, an alarm creation and a notification', async () => {
    const ctx = await createTestPanel('TIMELINE');
    try {
      // Tick 1: normal.
      await feedFlatReadings(ctx.cableSensor.id, 38, 10, 2000);
      await feedFlatReadings(ctx.currentSensor.id, 85, 10, 2000);
      await riskEngine.analyzePanels([ctx.panel.id]);

      // Tick 2: HIGH -> alarm + notification.
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP, 10, 2000);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT, 10, 2000);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const res = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}/timeline`).expect(200);
      expect(res.body.panelId).toBe(ctx.panel.id);
      const types = (res.body.events as Array<{ type: string }>).map((e) => e.type);
      expect(types).toContain('RISK_LEVEL_CHANGED');
      expect(types).toContain('ALARM_CREATED');
      expect(types).toContain('NOTIFICATION_SENT');

      // Newest-first ordering.
      const timestamps = (res.body.events as Array<{ timestamp: string }>).map((e) => new Date(e.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:id/timeline validates and clamps the limit query param', async () => {
    const ctx = await createTestPanel('TIMELINE-LIMIT');
    try {
      await feedFlatReadings(ctx.cableSensor.id, 38);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const defaultRes = await request(app.getHttpServer()).get(`/panels/${ctx.panel.id}/timeline`).expect(200);
      expect(Array.isArray(defaultRes.body.events)).toBe(true);

      const limitedRes = await request(app.getHttpServer())
        .get(`/panels/${ctx.panel.id}/timeline`)
        .query({ limit: 1 })
        .expect(200);
      expect(limitedRes.body.events.length).toBeLessThanOrEqual(1);

      // limit=0 -> clamped to a minimum of 1, not rejected/unbounded.
      const zeroRes = await request(app.getHttpServer())
        .get(`/panels/${ctx.panel.id}/timeline`)
        .query({ limit: 0 })
        .expect(200);
      expect(zeroRes.body.events.length).toBeLessThanOrEqual(1);

      // Absurdly large limit is clamped, not returned as unlimited history.
      const hugeRes = await request(app.getHttpServer())
        .get(`/panels/${ctx.panel.id}/timeline`)
        .query({ limit: 999999 })
        .expect(200);
      expect(hugeRes.body.events.length).toBeLessThanOrEqual(100);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /panels/:panelId/timeline 404s for an unknown panel', async () => {
    await request(app.getHttpServer())
      .get('/panels/00000000-0000-0000-0000-000000000000/timeline')
      .expect(404);
  });

  it('GET /metrics/operations returns real DB aggregate counts (not hard-coded)', async () => {
    const ctx = await createTestPanel('METRICS');
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await riskEngine.analyzePanels([ctx.panel.id]);

      // Diger e2e suite'ler (vitest varsayilan olarak dosyalari paralel
      // calistirir) ayni paylasilan Postgres'te es zamanli alarm/notification
      // olusturup silebilir; bu yuzden "once/sonra delta" yerine, API
      // yanitini AYNI ANDA alinan dogrudan bir Prisma aggregate ile
      // karsilastiriyoruz - bu hem race'e dayanikli hem de degerlerin
      // gercekten DB'den geldigini (hard-code edilmedigini) kanitliyor.
      const [res, directHigh, directCritical, directSent] = await Promise.all([
        request(app.getHttpServer()).get('/metrics/operations').expect(200),
        prisma.alarm.count({ where: { severity: 'HIGH' } }),
        prisma.alarm.count({ where: { severity: 'CRITICAL' } }),
        prisma.notification.count({ where: { status: 'SENT' } }),
      ]);

      expect(res.body.earlyWarningsGenerated).toBe(directHigh);
      expect(res.body.criticalEscalationsDetected).toBe(directCritical);
      expect(res.body.notificationsDelivered).toBe(directSent);
      expect(res.body.earlyWarningsGenerated).toBeGreaterThanOrEqual(1);
      expect(res.body.notificationsDelivered).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });
});

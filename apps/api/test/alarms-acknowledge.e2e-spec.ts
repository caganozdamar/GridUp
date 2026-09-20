import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';

// Bu suite gercek Postgres'e karsi calisir (bkz. notifications.e2e-spec.ts).
// HIGH alarm icin sabit (flat) reading'ler: cable=90 ve current=170 -> skor 70.
const HIGH_CABLE_TEMP = 90;
const HIGH_CURRENT = 170;

describe('Alarm acknowledge (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let riskEngine: RiskEngineService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    riskEngine = app.get(RiskEngineService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createPanelWithHighAlarm(suffix: string) {
    const site = await prisma.site.create({ data: { name: `Ack Test Site ${suffix}`, code: `ACK-TEST-SITE-${suffix}` } });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Ack Test Panel ${suffix}`, code: `ACK-TEST-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cable = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Cable Temperature', code: `ACK-TEST-${suffix}-CABLE`, type: 'CABLE_TEMPERATURE', unit: '°C' },
    });
    const current = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: `ACK-TEST-${suffix}-CURRENT`, type: 'CURRENT', unit: 'A' },
    });

    const feed = async (cableValue: number, currentValue: number, startOffsetMs: number) => {
      const start = Date.now() + startOffsetMs;
      for (let index = 0; index < 10; index++) {
        const timestamp = new Date(start + index * 2000);
        await prisma.sensorReading.create({ data: { sensorId: cable.id, value: cableValue, timestamp } });
        await prisma.sensorReading.create({ data: { sensorId: current.id, value: currentValue, timestamp } });
      }
    };

    await feed(HIGH_CABLE_TEMP, HIGH_CURRENT, 0);
    await riskEngine.analyzePanels([panel.id]);

    const alarm = await prisma.alarm.findFirst({ where: { panelId: panel.id, status: 'ACTIVE' } });
    const cleanup = async () => {
      await prisma.sensor.deleteMany({ where: { panelId: panel.id } });
      await prisma.panel.delete({ where: { id: panel.id } });
      await prisma.site.delete({ where: { id: site.id } });
    };
    return { panel, alarm: alarm!, feed, cleanup };
  }

  it('acknowledges an ACTIVE alarm and stamps acknowledgedAt', async () => {
    const ctx = await createPanelWithHighAlarm('BASIC');
    try {
      expect(ctx.alarm.status).toBe('ACTIVE');
      expect(ctx.alarm.acknowledgedAt).toBeNull();

      const res = await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(200);
      expect(res.body.status).toBe('ACKNOWLEDGED');
      expect(res.body.acknowledgedAt).not.toBeNull();

      const stored = await prisma.alarm.findUnique({ where: { id: ctx.alarm.id } });
      expect(stored!.status).toBe('ACKNOWLEDGED');
    } finally {
      await ctx.cleanup();
    }
  });

  it('is idempotent: a second acknowledge returns the same alarm and keeps the first timestamp', async () => {
    const ctx = await createPanelWithHighAlarm('IDEMP');
    try {
      const first = await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(200);
      const second = await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(200);

      expect(second.body.status).toBe('ACKNOWLEDGED');
      expect(second.body.acknowledgedAt).toBe(first.body.acknowledgedAt);
    } finally {
      await ctx.cleanup();
    }
  });

  it('does not open a duplicate alarm or send new notifications after an acknowledge', async () => {
    const ctx = await createPanelWithHighAlarm('NODUP');
    try {
      const notificationsBefore = await prisma.notification.count({ where: { alarmId: ctx.alarm.id } });
      expect(notificationsBefore).toBe(1);

      await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(200);

      // Risk hala HIGH: motor onaylanmis alarmi acik saymali, yenisini acmamali.
      for (let tick = 0; tick < 3; tick++) {
        await riskEngine.analyzePanels([ctx.panel.id]);
      }

      const alarms = await prisma.alarm.findMany({ where: { panelId: ctx.panel.id } });
      expect(alarms).toHaveLength(1);
      expect(alarms[0].status).toBe('ACKNOWLEDGED');
      expect(await prisma.notification.count({ where: { alarm: { panelId: ctx.panel.id } } })).toBe(1);
    } finally {
      await ctx.cleanup();
    }
  });

  it('resolves an acknowledged alarm when the risk returns to normal, then refuses to acknowledge it', async () => {
    const ctx = await createPanelWithHighAlarm('RESOLVE');
    try {
      await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(200);

      // Daha yeni, normal reading'ler: son 10 reading'lik pencere artik normal.
      await ctx.feed(30, 60, 60_000);
      // Histerezis: alarm 5 ARDISIK normal analizden sonra cozulur.
      for (let tick = 0; tick < 5; tick++) {
        await riskEngine.analyzePanels([ctx.panel.id]);
      }

      const resolved = await prisma.alarm.findUnique({ where: { id: ctx.alarm.id } });
      expect(resolved!.status).toBe('RESOLVED');
      expect(resolved!.resolvedAt).not.toBeNull();
      expect(resolved!.acknowledgedAt).not.toBeNull();

      await request(app.getHttpServer()).patch(`/alarms/${ctx.alarm.id}/acknowledge`).expect(409);
    } finally {
      await ctx.cleanup();
    }
  });

  it('returns 404 for an unknown alarm', async () => {
    await request(app.getHttpServer()).patch('/alarms/00000000-0000-0000-0000-000000000000/acknowledge').expect(404);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
  type NotificationSendInput,
} from '../src/notifications/notification-provider.interface.js';

// Bu suite gercek Postgres'e karsi calisir (bkz. risk-engine.e2e-spec.ts).
// Skorlarin HIGH/CRITICAL bandina deterministik dusmesi icin trend/humidity
// katkisi olmayan, dogrudan hesaplanabilir sabit (flat) reading'ler kullanilir:
//
// HIGH senaryosu (sadece cable+current, humidity yok):
//   temp=100, current=100, correlation bonus=+10 => score = 100*0.35 + 100*0.25 + 10 = 70 (HIGH, max mumkun deger).
// CRITICAL senaryosu (cable+current+humidity):
//   temp=100, current=100, humidity~91.67, iki correlation bonus=+18
//   => score = 35 + 25 + 13.75 + 18 = ~92 (CRITICAL, rahat bir marj ile).
const HIGH_CABLE_TEMP = 90; // >=85 -> clamped to 100
const HIGH_CURRENT = 170; // >=170 -> clamped to 100
const CRITICAL_HUMIDITY = 90; // -> ~91.67

describe('Notifications (e2e, real DB)', () => {
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

  async function createTestPanel(suffix: string, withHumidity = false) {
    const site = await prisma.site.create({
      data: { name: `Notification Test Site ${suffix}`, code: `NOTIF-TEST-SITE-${suffix}` },
    });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Notification Test Panel ${suffix}`, code: `NOTIF-TEST-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cableSensor = await prisma.sensor.create({
      data: {
        panelId: panel.id,
        name: 'Cable Temperature',
        code: `NOTIF-TEST-${suffix}-CABLE-TEMP`,
        type: 'CABLE_TEMPERATURE',
        unit: '°C',
      },
    });
    const currentSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: `NOTIF-TEST-${suffix}-CURRENT`, type: 'CURRENT', unit: 'A' },
    });
    const humiditySensor = withHumidity
      ? await prisma.sensor.create({
          data: { panelId: panel.id, name: 'Humidity', code: `NOTIF-TEST-${suffix}-HUMIDITY`, type: 'HUMIDITY', unit: '%' },
        })
      : null;

    return { site, panel, cableSensor, currentSensor, humiditySensor };
  }

  async function cleanupTestPanel(ctx: Awaited<ReturnType<typeof createTestPanel>>) {
    await prisma.sensor.deleteMany({ where: { panelId: ctx.panel.id } });
    await prisma.panel.delete({ where: { id: ctx.panel.id } });
    await prisma.site.delete({ where: { id: ctx.site.id } });
  }

  async function feedFlatReadings(sensorId: string, value: number, count = 10) {
    const now = Date.now();
    for (let index = 0; index < count; index++) {
      await prisma.sensorReading.create({
        data: { sensorId, value, timestamp: new Date(now + index * 2000) },
      });
    }
  }

  it('creates exactly one SMS notification (and no WhatsApp) for a new HIGH alarm', async () => {
    const ctx = await createTestPanel('HIGH');
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);

      await riskEngine.analyzePanels([ctx.panel.id]);

      const alarm = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, status: 'ACTIVE' } });
      expect(alarm).not.toBeNull();
      expect(alarm!.severity).toBe('HIGH');

      const notifications = await prisma.notification.findMany({ where: { alarmId: alarm!.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].channel).toBe('SMS');
      expect(notifications[0].status).toBe('SENT');
      expect(notifications[0].sentAt).not.toBeNull();
      expect(notifications[0].providerMessageId).toMatch(/^demo-/);
      expect(notifications[0].message).toContain(ctx.panel.code);
      expect(notifications[0].message).toContain('HIGH');
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('creates one SMS and one WhatsApp notification for a new CRITICAL alarm, with no duplicates across ticks', async () => {
    const ctx = await createTestPanel('CRITICAL', true);
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await feedFlatReadings(ctx.humiditySensor!.id, CRITICAL_HUMIDITY);

      // Asama 6 madde 7: 10 tick gecse bile ayni CRITICAL alarm icin yeni
      // notification olusmamali - notification alarm CREATE event'ine bagli.
      for (let tick = 0; tick < 10; tick++) {
        await riskEngine.analyzePanels([ctx.panel.id]);
      }

      const alarm = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, status: 'ACTIVE' } });
      expect(alarm).not.toBeNull();
      expect(alarm!.severity).toBe('CRITICAL');

      const notifications = await prisma.notification.findMany({
        where: { alarmId: alarm!.id },
        orderBy: { channel: 'asc' },
      });
      expect(notifications).toHaveLength(2);

      const sms = notifications.find((n) => n.channel === 'SMS');
      const whatsapp = notifications.find((n) => n.channel === 'WHATSAPP');
      expect(sms?.status).toBe('SENT');
      expect(whatsapp?.status).toBe('SENT');
      expect(whatsapp?.message).toContain('Panel:');
      expect(whatsapp?.message).toContain('Detected conditions:');
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('does not send a notification when the panel only reaches WARNING (no alarm)', async () => {
    const ctx = await createTestPanel('WARNING');
    try {
      // Sadece cable sensoru, flat 85 -> temp component=100, weightedScore=100*0.35=35 (WARNING, 30-59).
      // Current/humidity sensoru olmadigi ve trend=0 oldugu icin HIGH esigine (60) asla ulasamaz.
      await feedFlatReadings(ctx.cableSensor.id, 85);

      await riskEngine.analyzePanels([ctx.panel.id]);

      const alarms = await prisma.alarm.findMany({ where: { panelId: ctx.panel.id } });
      expect(alarms).toHaveLength(0);

      const notifications = await prisma.notification.count({
        where: { alarm: { panelId: ctx.panel.id } },
      });
      expect(notifications).toBe(0);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /notifications returns dashboard-friendly rows with alarm/panel/site info, filterable by channel and status', async () => {
    const ctx = await createTestPanel('LIST-API');
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const allRes = await request(app.getHttpServer()).get('/notifications').expect(200);
      const forThisPanel = (allRes.body as Array<{ alarm: { panel: { id: string; code: string; site: { id: string } } } }>).filter(
        (n) => n.alarm.panel.id === ctx.panel.id,
      );
      expect(forThisPanel).toHaveLength(1);
      expect(forThisPanel[0].alarm.panel.code).toBe(ctx.panel.code);
      expect(forThisPanel[0].alarm.panel.site.id).toBe(ctx.site.id);

      const smsRes = await request(app.getHttpServer()).get('/notifications').query({ channel: 'SMS' }).expect(200);
      expect(
        (smsRes.body as Array<{ alarm: { panel: { id: string } } }>).filter((n) => n.alarm.panel.id === ctx.panel.id),
      ).toHaveLength(1);

      const whatsappRes = await request(app.getHttpServer()).get('/notifications').query({ channel: 'WHATSAPP' }).expect(200);
      expect(
        (whatsappRes.body as Array<{ alarm: { panel: { id: string } } }>).filter((n) => n.alarm.panel.id === ctx.panel.id),
      ).toHaveLength(0);

      const sentRes = await request(app.getHttpServer()).get('/notifications').query({ status: 'SENT' }).expect(200);
      expect(
        (sentRes.body as Array<{ alarm: { panel: { id: string } } }>).some((n) => n.alarm.panel.id === ctx.panel.id),
      ).toBe(true);

      const failedRes = await request(app.getHttpServer()).get('/notifications').query({ status: 'FAILED' }).expect(200);
      expect(
        (failedRes.body as Array<{ alarm: { panel: { id: string } } }>).some((n) => n.alarm.panel.id === ctx.panel.id),
      ).toBe(false);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('GET /alarms/:id/notifications returns only that alarm notifications and 404s for an unknown alarm', async () => {
    const ctx = await createTestPanel('BY-ALARM');
    try {
      await feedFlatReadings(ctx.cableSensor.id, HIGH_CABLE_TEMP);
      await feedFlatReadings(ctx.currentSensor.id, HIGH_CURRENT);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const alarm = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, status: 'ACTIVE' } });

      const res = await request(app.getHttpServer()).get(`/alarms/${alarm!.id}/notifications`).expect(200);
      expect(res.body).toHaveLength(1);
      expect((res.body as Array<{ alarmId: string }>)[0].alarmId).toBe(alarm!.id);

      await request(app.getHttpServer())
        .get('/alarms/00000000-0000-0000-0000-000000000000/notifications')
        .expect(404);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });
});

describe('Notifications provider failure safety (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let riskEngine: RiskEngineService;

  class FailingNotificationProvider implements NotificationProvider {
    readonly name = 'failing-test-provider';
    async send(_input: NotificationSendInput): Promise<never> {
      throw new Error('Simulated provider outage');
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NOTIFICATION_PROVIDER)
      .useClass(FailingNotificationProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    riskEngine = app.get(RiskEngineService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the alarm/risk/ingestion pipeline healthy when the provider throws, and records FAILED notifications', async () => {
    const site = await prisma.site.create({
      data: { name: 'Notification Failure Test Site', code: 'NOTIF-FAIL-SITE' },
    });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: 'Notification Failure Test Panel', code: 'NOTIF-FAIL-PANO', status: 'ONLINE' },
    });
    const cableSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Cable Temperature', code: 'NOTIF-FAIL-CABLE-TEMP', type: 'CABLE_TEMPERATURE', unit: '°C' },
    });
    const currentSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: 'NOTIF-FAIL-CURRENT', type: 'CURRENT', unit: 'A' },
    });

    try {
      const now = Date.now();
      for (let index = 0; index < 10; index++) {
        await prisma.sensorReading.create({
          data: { sensorId: cableSensor.id, value: HIGH_CABLE_TEMP, timestamp: new Date(now + index * 2000) },
        });
        await prisma.sensorReading.create({
          data: { sensorId: currentSensor.id, value: HIGH_CURRENT, timestamp: new Date(now + index * 2000) },
        });
      }

      // Provider fails, but analyzePanels must not throw / must not fail ingestion.
      await expect(riskEngine.analyzePanels([panel.id])).resolves.toBeUndefined();

      const riskScores = await prisma.riskScore.count({ where: { panelId: panel.id } });
      expect(riskScores).toBe(1);

      const alarm = await prisma.alarm.findFirst({ where: { panelId: panel.id, status: 'ACTIVE' } });
      expect(alarm).not.toBeNull();
      expect(alarm!.severity).toBe('HIGH');

      const notifications = await prisma.notification.findMany({ where: { alarmId: alarm!.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].status).toBe('FAILED');
      expect(notifications[0].errorMessage).toContain('Simulated provider outage');
      expect(notifications[0].sentAt).toBeNull();
    } finally {
      await prisma.sensor.deleteMany({ where: { panelId: panel.id } });
      await prisma.panel.delete({ where: { id: panel.id } });
      await prisma.site.delete({ where: { id: site.id } });
    }
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';
import { ModuleHealthService } from '../src/module-health/module-health.service.js';

// Bu suite gercek Postgres'e karsi calisir. Alarm histerezisi, seviye
// degisimi ve bildirim cooldown'u. Skorlar deterministiktir:
//   HIGH     = cable 90 + current 170                 -> 70
//   CRITICAL = cable 90 + current 170 + humidity 90   -> ~92
//   NORMAL   = cable 38 + current 85  + humidity 40
const HIGH = { cable: 90, current: 170, humidity: 35 };
const CRITICAL = { cable: 90, current: 170, humidity: 90 };
const NORMAL = { cable: 38, current: 85, humidity: 40 };

describe('Alarm policy: hysteresis, level changes and notification cooldown (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let riskEngine: RiskEngineService;
  let moduleHealth: ModuleHealthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    riskEngine = app.get(RiskEngineService);
    moduleHealth = app.get(ModuleHealthService);
  });

  afterEach(() => {
    delete process.env.ALARM_RESOLVE_AFTER_TICKS;
    delete process.env.NOTIFICATION_COOLDOWN_MS;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createPanel(suffix: string) {
    const site = await prisma.site.create({ data: { name: `Policy Test Site ${suffix}`, code: `POL-SITE-${suffix}` } });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Policy Test Panel ${suffix}`, code: `POL-PANO-${suffix}`, status: 'ONLINE' },
    });
    const sensors = {
      cable: await prisma.sensor.create({ data: { panelId: panel.id, name: 'Cable', code: `POL-${suffix}-CABLE`, type: 'CABLE_TEMPERATURE', unit: '°C' } }),
      current: await prisma.sensor.create({ data: { panelId: panel.id, name: 'Current', code: `POL-${suffix}-CUR`, type: 'CURRENT', unit: 'A' } }),
      humidity: await prisma.sensor.create({ data: { panelId: panel.id, name: 'Humidity', code: `POL-${suffix}-HUM`, type: 'HUMIDITY', unit: '%' } }),
    };

    // Her feed, onceki okumalardan SONRA gelen 10 okuma yazar; analiz penceresi
    // (son 10 okuma) boylece tamamen yenilenir.
    let clock = Date.now();
    const feed = async (values: { cable: number; current: number; humidity: number }) => {
      for (let index = 0; index < 10; index++) {
        clock += 2000;
        const timestamp = new Date(clock);
        await prisma.sensorReading.create({ data: { sensorId: sensors.cable.id, value: values.cable, timestamp } });
        await prisma.sensorReading.create({ data: { sensorId: sensors.current.id, value: values.current, timestamp } });
        await prisma.sensorReading.create({ data: { sensorId: sensors.humidity.id, value: values.humidity, timestamp } });
      }
    };
    const analyze = (times = 1) => (async () => {
      for (let tick = 0; tick < times; tick++) await riskEngine.analyzePanels([panel.id]);
    })();

    const riskAlarms = () => prisma.alarm.findMany({ where: { panelId: panel.id, kind: 'RISK' }, orderBy: { createdAt: 'asc' } });
    const notificationCount = (where: object = {}) => prisma.notification.count({ where: { alarm: { panelId: panel.id }, ...where } });
    const cleanup = async () => {
      await prisma.sensor.deleteMany({ where: { panelId: panel.id } });
      await prisma.panel.delete({ where: { id: panel.id } });
      await prisma.site.delete({ where: { id: site.id } });
    };
    return { panel, feed, analyze, riskAlarms, notificationCount, cleanup, now: () => clock };
  }

  describe('hysteresis on resolve', () => {
    it('keeps the alarm open until the risk stayed normal for N consecutive analyses', async () => {
      process.env.ALARM_RESOLVE_AFTER_TICKS = '3';
      const ctx = await createPanel('RESOLVE');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        const [alarm] = await ctx.riskAlarms();
        expect(alarm.status).toBe('ACTIVE');

        await ctx.feed(NORMAL);
        await ctx.analyze(2);
        expect((await ctx.riskAlarms())[0].status).toBe('ACTIVE');

        await ctx.analyze(1);
        expect((await ctx.riskAlarms())[0].status).toBe('RESOLVED');
      } finally {
        await ctx.cleanup();
      }
    });

    it('does not close and reopen the alarm when the risk dips for one tick', async () => {
      const ctx = await createPanel('DIP');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        await ctx.feed(NORMAL);
        await ctx.analyze(1); // tek dusuk analiz
        await ctx.feed(HIGH);
        await ctx.analyze(2); // risk tekrar alarm bandinda

        const alarms = await ctx.riskAlarms();
        expect(alarms).toHaveLength(1);
        expect(alarms[0].status).toBe('ACTIVE');
        expect(await ctx.notificationCount()).toBe(1); // yeni bildirim yok
      } finally {
        await ctx.cleanup();
      }
    });
  });

  describe('level changes', () => {
    it('keeps a CRITICAL alarm open, without a new alarm or SMS, when the risk falls back to HIGH', async () => {
      const ctx = await createPanel('DOWN');
      try {
        await ctx.feed(CRITICAL);
        await ctx.analyze();
        const [critical] = await ctx.riskAlarms();
        expect(critical.severity).toBe('CRITICAL');
        expect(await ctx.notificationCount()).toBe(2); // SMS + WhatsApp

        await ctx.feed(HIGH);
        await ctx.analyze(4);

        const alarms = await ctx.riskAlarms();
        expect(alarms).toHaveLength(1);
        expect(alarms[0].id).toBe(critical.id);
        expect(alarms[0].status).toBe('ACTIVE');
        expect(await ctx.notificationCount()).toBe(2);
      } finally {
        await ctx.cleanup();
      }
    });

    it('still announces a worsening: HIGH to CRITICAL opens a new alarm and notifies even inside the cooldown', async () => {
      const ctx = await createPanel('UP');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        expect(await ctx.notificationCount()).toBe(1); // HIGH: SMS

        await ctx.feed(CRITICAL);
        await ctx.analyze();

        const alarms = await ctx.riskAlarms();
        expect(alarms.map((alarm) => [alarm.severity, alarm.status])).toEqual([
          ['HIGH', 'RESOLVED'],
          ['CRITICAL', 'ACTIVE'],
        ]);
        // 1 (HIGH SMS) + 2 (CRITICAL SMS + WhatsApp): cooldown seviye yukselisini bastirmaz.
        expect(await ctx.notificationCount()).toBe(3);
      } finally {
        await ctx.cleanup();
      }
    });
  });

  describe('notification cooldown', () => {
    it('suppresses the SMS of a re-opened alarm of the same severity inside the cooldown', async () => {
      process.env.ALARM_RESOLVE_AFTER_TICKS = '1';
      const ctx = await createPanel('COOL');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        await ctx.feed(NORMAL);
        await ctx.analyze(); // 1 normal analiz yeter, alarm 1 cozulur
        await ctx.feed(HIGH);
        await ctx.analyze(); // ikinci alarm

        const alarms = await ctx.riskAlarms();
        expect(alarms).toHaveLength(2);
        expect(alarms[0].status).toBe('RESOLVED');
        expect(alarms[1].status).toBe('ACTIVE');
        // Ikinci alarm var ama bildirimi cooldown yuzunden gonderilmedi.
        expect(await prisma.notification.count({ where: { alarmId: alarms[0].id } })).toBe(1);
        expect(await prisma.notification.count({ where: { alarmId: alarms[1].id } })).toBe(0);
      } finally {
        await ctx.cleanup();
      }
    });

    it('sends every alarm notification when the cooldown is disabled', async () => {
      process.env.ALARM_RESOLVE_AFTER_TICKS = '1';
      process.env.NOTIFICATION_COOLDOWN_MS = '0';
      const ctx = await createPanel('NOCOOL');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        await ctx.feed(NORMAL);
        await ctx.analyze();
        await ctx.feed(HIGH);
        await ctx.analyze();

        expect(await ctx.notificationCount()).toBe(2);
      } finally {
        await ctx.cleanup();
      }
    });

    it('does not let a risk notification suppress a module-offline notification of the same panel', async () => {
      const ctx = await createPanel('KIND');
      try {
        await ctx.feed(HIGH);
        await ctx.analyze();
        expect(await ctx.notificationCount()).toBe(1); // RISK HIGH SMS

        await moduleHealth.checkOnce(new Date(ctx.now() + 120_000), [ctx.panel.id]); // 2 dk sessizlik

        const offline = await prisma.alarm.findFirst({ where: { panelId: ctx.panel.id, kind: 'MODULE_OFFLINE' } });
        expect(offline).not.toBeNull();
        expect(await prisma.notification.count({ where: { alarmId: offline!.id } })).toBe(1);
      } finally {
        await ctx.cleanup();
      }
    });
  });
});

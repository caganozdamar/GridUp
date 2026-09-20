import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';
import { ModuleHealthService } from '../src/module-health/module-health.service.js';

// Bu suite gercek Postgres'e karsi calisir. Zaman `checkOnce(now, [panelId])`
// ile elle verilir: bekleme yok, ve yalnizca test panosuna bakilir (gelistirme
// DB'sindeki gercek demo panolarina alarm acilmaz).
describe('Module offline detection (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moduleHealth: ModuleHealthService;
  let riskEngine: RiskEngineService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    moduleHealth = app.get(ModuleHealthService);
    riskEngine = app.get(RiskEngineService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createPanel(suffix: string, withReadingsUntilSec: number | null) {
    const site = await prisma.site.create({ data: { name: `Offline Test Site ${suffix}`, code: `OFFL-SITE-${suffix}` } });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Offline Test Panel ${suffix}`, code: `OFFL-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cable = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Cable Temperature', code: `OFFL-${suffix}-CABLE`, type: 'CABLE_TEMPERATURE', unit: '°C' },
    });
    const current = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: `OFFL-${suffix}-CURRENT`, type: 'CURRENT', unit: 'A' },
    });

    const base = Date.now();
    const at = (sec: number) => new Date(base + sec * 1000);
    const feed = async (fromSec: number, toSec: number) => {
      for (let sec = fromSec; sec <= toSec; sec += 2) {
        await prisma.sensorReading.create({ data: { sensorId: cable.id, value: 38, timestamp: at(sec) } });
        await prisma.sensorReading.create({ data: { sensorId: current.id, value: 85, timestamp: at(sec) } });
      }
    };
    if (withReadingsUntilSec !== null) await feed(0, withReadingsUntilSec);

    const offlineAlarms = () => prisma.alarm.findMany({ where: { panelId: panel.id, kind: 'MODULE_OFFLINE' } });
    const cleanup = async () => {
      await prisma.sensor.deleteMany({ where: { panelId: panel.id } });
      await prisma.panel.delete({ where: { id: panel.id } });
      await prisma.site.delete({ where: { id: site.id } });
    };
    return { panel, at, feed, offlineAlarms, cleanup };
  }

  it('opens a MODULE_OFFLINE alarm and sends an SMS only after the module has been silent past the threshold', async () => {
    const ctx = await createPanel('OPEN', 8); // son okuma: t = 8 sn
    try {
      // 30 sn sessizlik: kisa kesinti, alarm yok (esik 60 sn).
      await moduleHealth.checkOnce(ctx.at(8 + 30), [ctx.panel.id]);
      expect(await ctx.offlineAlarms()).toHaveLength(0);

      await moduleHealth.checkOnce(ctx.at(8 + 61), [ctx.panel.id]);
      const alarms = await ctx.offlineAlarms();
      expect(alarms).toHaveLength(1);
      expect(alarms[0].severity).toBe('HIGH');
      expect(alarms[0].status).toBe('ACTIVE');
      expect(alarms[0].title).toBe('Field module offline');

      const notifications = await prisma.notification.findMany({ where: { alarmId: alarms[0].id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].channel).toBe('SMS');
      expect(notifications[0].status).toBe('SENT');
      expect(notifications[0].message).toContain('module offline');
    } finally {
      await ctx.cleanup();
    }
  });

  it('does not open a second alarm while the module stays silent, even after it is acknowledged', async () => {
    const ctx = await createPanel('DUP', 8);
    try {
      await moduleHealth.checkOnce(ctx.at(70), [ctx.panel.id]);
      const [first] = await ctx.offlineAlarms();
      await prisma.alarm.update({ where: { id: first.id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } });

      await moduleHealth.checkOnce(ctx.at(130), [ctx.panel.id]);
      await moduleHealth.checkOnce(ctx.at(190), [ctx.panel.id]);

      expect(await ctx.offlineAlarms()).toHaveLength(1);
      expect(await prisma.notification.count({ where: { alarm: { panelId: ctx.panel.id } } })).toBe(1);
    } finally {
      await ctx.cleanup();
    }
  });

  it('resolves the alarm when readings arrive again', async () => {
    const ctx = await createPanel('RECOVER', 8);
    try {
      await moduleHealth.checkOnce(ctx.at(70), [ctx.panel.id]);
      expect((await ctx.offlineAlarms())[0].status).toBe('ACTIVE');

      await ctx.feed(200, 210); // modul geri geldi
      await moduleHealth.checkOnce(ctx.at(212), [ctx.panel.id]);

      const [alarm] = await ctx.offlineAlarms();
      expect(alarm.status).toBe('RESOLVED');
      expect(alarm.resolvedAt).not.toBeNull();
    } finally {
      await ctx.cleanup();
    }
  });

  it('keeps the offline alarm independent of the risk engine (a normal risk analysis does not resolve it)', async () => {
    const ctx = await createPanel('INDEP', 8);
    try {
      await moduleHealth.checkOnce(ctx.at(70), [ctx.panel.id]);

      // Risk motoru calisir ve normal cikar; bu MODULE_OFFLINE alarmini cozmemeli.
      for (let tick = 0; tick < 6; tick++) {
        await riskEngine.analyzePanels([ctx.panel.id]);
      }

      const [alarm] = await ctx.offlineAlarms();
      expect(alarm.status).toBe('ACTIVE');
    } finally {
      await ctx.cleanup();
    }
  });

  it('never raises an alarm for a panel that has not reported yet', async () => {
    const ctx = await createPanel('NODATA', null); // sensorleri var, hic okuma yok
    try {
      await moduleHealth.checkOnce(ctx.at(10_000), [ctx.panel.id]);
      expect(await ctx.offlineAlarms()).toHaveLength(0);
    } finally {
      await ctx.cleanup();
    }
  });
});

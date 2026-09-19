import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RiskEngineService } from '../src/risk-engine/risk-engine.service.js';
import { ScadaService } from '../src/scada/scada.service.js';

// Bu suite gercek Postgres'e karsi calisir (bkz. risk-engine.e2e-spec.ts).
// Amac: GET /scada/panels'in gercek Panel/Sensor/SensorReading/RiskScore/
// Alarm/Anomaly verisinden dogru bir snapshot uretebildigini dogrulamak.

describe('ScadaService (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let riskEngine: RiskEngineService;
  let scadaService: ScadaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    riskEngine = app.get(RiskEngineService);
    scadaService = app.get(ScadaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTestPanel(suffix: string) {
    const site = await prisma.site.create({
      data: { name: `Scada Test Site ${suffix}`, code: `SCADA-TEST-SITE-${suffix}` },
    });
    const panel = await prisma.panel.create({
      data: { siteId: site.id, name: `Scada Test Panel ${suffix}`, code: `SCADA-TEST-PANO-${suffix}`, status: 'ONLINE' },
    });
    const cableSensor = await prisma.sensor.create({
      data: {
        panelId: panel.id,
        name: 'Cable Temperature',
        code: `SCADA-TEST-${suffix}-CABLE-TEMP`,
        type: 'CABLE_TEMPERATURE',
        unit: '°C',
      },
    });
    const currentSensor = await prisma.sensor.create({
      data: { panelId: panel.id, name: 'Current', code: `SCADA-TEST-${suffix}-CURRENT`, type: 'CURRENT', unit: 'A' },
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

  it('returns NORMAL snapshot fields for a quiet panel', async () => {
    const ctx = await createTestPanel('NORMAL');
    try {
      await feedReadings(ctx.cableSensor.id, Array(10).fill(38));
      await feedReadings(ctx.currentSensor.id, Array(10).fill(85));
      await riskEngine.analyzePanels([ctx.panel.id]);

      const snapshot = await scadaService.getPanelsSnapshot();
      const entry = snapshot.find((p) => p.panelCode === ctx.panel.code);

      expect(entry).toBeDefined();
      expect(entry!.online).toBe(true);
      expect(entry!.panelStatus).toBe('ONLINE');
      expect(entry!.riskLevel).toBe('NORMAL');
      expect(entry!.cableTemperature).toBe(38);
      expect(entry!.current).toBe(85);
      expect(entry!.activeAlarm).toBe(false);
      expect(entry!.activeAnomalyCount).toBe(0);
      expect(entry!.lastReadingAt).not.toBeNull();
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('reflects an elevated risk score, active alarm and anomaly count', async () => {
    const ctx = await createTestPanel('CRITICAL');
    try {
      const RISING_CABLE_TEMPS = [38, 41, 45, 50, 56, 63, 70, 78, 85, 92];
      const RISING_CURRENTS = [80, 90, 100, 110, 115, 120, 125, 130, 135, 140];
      await feedReadings(ctx.cableSensor.id, RISING_CABLE_TEMPS);
      await feedReadings(ctx.currentSensor.id, RISING_CURRENTS);
      await riskEngine.analyzePanels([ctx.panel.id]);

      const snapshot = await scadaService.getPanelsSnapshot();
      const entry = snapshot.find((p) => p.panelCode === ctx.panel.code);

      expect(entry).toBeDefined();
      expect(['HIGH', 'CRITICAL']).toContain(entry!.riskLevel);
      expect(entry!.riskScore).toBeGreaterThanOrEqual(60);
      expect(entry!.activeAlarm).toBe(true);
      expect(entry!.activeAnomalyCount).toBeGreaterThan(0);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });

  it('returns null sensor/risk fields for a panel with no readings yet', async () => {
    const ctx = await createTestPanel('NO-DATA');
    try {
      const snapshot = await scadaService.getPanelsSnapshot();
      const entry = snapshot.find((p) => p.panelCode === ctx.panel.code);

      expect(entry).toBeDefined();
      expect(entry!.riskScore).toBeNull();
      expect(entry!.riskLevel).toBeNull();
      expect(entry!.cableTemperature).toBeNull();
      expect(entry!.lastReadingAt).toBeNull();
      expect(entry!.activeAlarm).toBe(false);
    } finally {
      await cleanupTestPanel(ctx);
    }
  });
});

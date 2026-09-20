import { PrismaClient, SensorType } from '@prisma/client';

const prisma = new PrismaClient();

const SENSOR_DEFS: Array<{ suffix: string; name: string; type: SensorType; unit: string }> = [
  { suffix: 'AMB-TEMP', name: 'Ambient Temperature', type: 'AMBIENT_TEMPERATURE', unit: '°C' },
  { suffix: 'CABLE-TEMP', name: 'Cable Temperature', type: 'CABLE_TEMPERATURE', unit: '°C' },
  { suffix: 'HUM', name: 'Humidity', type: 'HUMIDITY', unit: '%' },
  { suffix: 'CURRENT', name: 'Current', type: 'CURRENT', unit: 'A' },
  { suffix: 'ARC-FLASH', name: 'Arc Flash (optical)', type: 'ARC_FLASH', unit: '%' },
  { suffix: 'ACOUSTIC', name: 'Acoustic / Partial Discharge', type: 'ACOUSTIC', unit: 'dB' },
];

async function main() {
  const site = await prisma.site.upsert({
    where: { code: 'GRID-DEMO-01' },
    update: { name: 'Grid Up Demo Site' },
    create: {
      name: 'Grid Up Demo Site',
      code: 'GRID-DEMO-01',
    },
  });

  for (let i = 1; i <= 5; i++) {
    const panelCode = `PANO-${String(i).padStart(3, '0')}`;

    const panel = await prisma.panel.upsert({
      where: { code: panelCode },
      update: {},
      create: {
        siteId: site.id,
        name: panelCode,
        code: panelCode,
        status: 'ONLINE',
      },
    });

    for (const def of SENSOR_DEFS) {
      const sensorCode = `${panelCode}-${def.suffix}`;
      await prisma.sensor.upsert({
        where: { code: sensorCode },
        update: {},
        create: {
          panelId: panel.id,
          name: def.name,
          code: sensorCode,
          type: def.type,
          unit: def.unit,
        },
      });
    }
  }

  const siteCount = await prisma.site.count();
  const panelCount = await prisma.panel.count();
  const sensorCount = await prisma.sensor.count();

  console.log(`Seed tamamlandi: ${siteCount} site, ${panelCount} panel, ${sensorCount} sensor.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

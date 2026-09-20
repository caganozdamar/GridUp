import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { SitesModule } from './sites/sites.module.js';
import { PanelsModule } from './panels/panels.module.js';
import { SensorsModule } from './sensors/sensors.module.js';
import { ReadingsModule } from './readings/readings.module.js';
import { AnomaliesModule } from './anomalies/anomalies.module.js';
import { AlarmsModule } from './alarms/alarms.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ScadaModule } from './scada/scada.module.js';
import { DecisionSupportModule } from './decision-support/decision-support.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    SitesModule,
    PanelsModule,
    SensorsModule,
    ReadingsModule,
    AnomaliesModule,
    AlarmsModule,
    NotificationsModule,
    ScadaModule,
    DecisionSupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

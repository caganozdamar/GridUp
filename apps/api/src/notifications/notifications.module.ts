import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DemoNotificationProvider } from './providers/demo-notification.provider.js';
import { HttpGatewayNotificationProvider } from './providers/http-gateway-notification.provider.js';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from './notification-provider.interface.js';
import { NOTIFICATION_PROVIDER_NAME, gatewayConfig } from './notifications.config.js';

// NOTIFICATION_PROVIDER ile secilir: "demo" (varsayilan, gercek gonderim yok)
// veya "http". Yanlis ya da eksik yapilandirma uygulama acilisinda hata verir;
// sessizce demo'ya dusmek, gercek alarmin kimseye ulasmamasi demek olurdu.
export function selectNotificationProvider(
  demo: NotificationProvider,
  http: NotificationProvider,
  name: string = NOTIFICATION_PROVIDER_NAME,
): NotificationProvider {
  if (name === 'demo') return demo;
  if (name === 'http') {
    if (!gatewayConfig().url) {
      throw new Error('NOTIFICATION_PROVIDER=http requires NOTIFICATION_GATEWAY_URL');
    }
    return http;
  }
  throw new Error(`Unknown NOTIFICATION_PROVIDER "${name}" (expected "demo" or "http")`);
}

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DemoNotificationProvider,
    HttpGatewayNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      useFactory: (demo: DemoNotificationProvider, http: HttpGatewayNotificationProvider) =>
        selectNotificationProvider(demo, http),
      inject: [DemoNotificationProvider, HttpGatewayNotificationProvider],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

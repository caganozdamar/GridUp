import { afterEach, describe, expect, it } from 'vitest';
import { selectNotificationProvider } from './notifications.module.js';
import type { NotificationProvider } from './notification-provider.interface.js';

const demo: NotificationProvider = { name: 'demo', send: async () => ({ providerMessageId: 'd' }) };
const http: NotificationProvider = { name: 'http', send: async () => ({ providerMessageId: 'h' }) };

describe('selectNotificationProvider', () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_GATEWAY_URL;
  });

  it('selects the demo provider', () => {
    expect(selectNotificationProvider(demo, http, 'demo')).toBe(demo);
  });

  it('selects the http provider only when a gateway URL is configured', () => {
    expect(() => selectNotificationProvider(demo, http, 'http')).toThrow(/NOTIFICATION_GATEWAY_URL/);
    process.env.NOTIFICATION_GATEWAY_URL = 'http://localhost:4010/send';
    expect(selectNotificationProvider(demo, http, 'http')).toBe(http);
  });

  it('refuses unknown provider names instead of silently falling back to demo', () => {
    expect(() => selectNotificationProvider(demo, http, 'twilio')).toThrow(/Unknown NOTIFICATION_PROVIDER/);
  });
});

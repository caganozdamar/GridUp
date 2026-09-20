import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NotificationChannel } from '@prisma/client';
import { HttpGatewayNotificationProvider } from './http-gateway-notification.provider.js';

// Gercek bir yerel HTTP sunucusuna karsi calisir; istegin bicimi, durum
// kodlari ve zaman asimi mock yerine gercek fetch ile denenir.
describe('HttpGatewayNotificationProvider', () => {
  let server: Server;
  let url: string;
  let lastHeaders: IncomingHttpHeaders = {};
  let lastBody: unknown;
  let respond: (status: number, body: string, delayMs?: number) => void;
  let next = { status: 200, body: '{"id":"gw-1"}', delayMs: 0 };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        lastHeaders = req.headers;
        lastBody = JSON.parse(raw);
        setTimeout(() => {
          res.writeHead(next.status, { 'Content-Type': 'application/json' });
          res.end(next.body);
        }, next.delayMs);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/send`;
    respond = (status, body, delayMs = 0) => {
      next = { status, body, delayMs };
    };
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    respond(200, '{"id":"gw-1"}');
    delete process.env.NOTIFICATION_GATEWAY_URL;
    delete process.env.NOTIFICATION_GATEWAY_TOKEN;
    delete process.env.NOTIFICATION_GATEWAY_TIMEOUT_MS;
  });

  const input = { channel: NotificationChannel.SMS, recipient: '+905551234567', message: 'GRID UP ALERT' };

  it('posts channel, recipient and message and returns the gateway message id', async () => {
    process.env.NOTIFICATION_GATEWAY_URL = url;
    const result = await new HttpGatewayNotificationProvider().send(input);

    expect(result.providerMessageId).toBe('gw-1');
    expect(lastBody).toEqual({ channel: 'SMS', to: '+905551234567', message: 'GRID UP ALERT' });
    expect(lastHeaders.authorization).toBeUndefined();
  });

  it('sends the bearer token when one is configured', async () => {
    process.env.NOTIFICATION_GATEWAY_URL = url;
    process.env.NOTIFICATION_GATEWAY_TOKEN = 's3cret';
    await new HttpGatewayNotificationProvider().send(input);

    expect(lastHeaders.authorization).toBe('Bearer s3cret');
  });

  it('generates an id when the gateway answers 2xx without a JSON id', async () => {
    process.env.NOTIFICATION_GATEWAY_URL = url;
    respond(202, '');
    const result = await new HttpGatewayNotificationProvider().send(input);

    expect(result.providerMessageId).toMatch(/^gw-/);
  });

  it('throws on a non-2xx response, including the status but never the token', async () => {
    process.env.NOTIFICATION_GATEWAY_URL = url;
    process.env.NOTIFICATION_GATEWAY_TOKEN = 's3cret';
    respond(503, '{"error":"simulated outage"}');

    const error = await new HttpGatewayNotificationProvider().send(input).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('HTTP 503');
    expect((error as Error).message).not.toContain('s3cret');
  });

  it('times out on a slow gateway', async () => {
    process.env.NOTIFICATION_GATEWAY_URL = url;
    process.env.NOTIFICATION_GATEWAY_TIMEOUT_MS = '100';
    respond(200, '{"id":"late"}', 500);

    await expect(new HttpGatewayNotificationProvider().send(input)).rejects.toThrow();
  });

  it('fails clearly when no gateway URL is configured', async () => {
    await expect(new HttpGatewayNotificationProvider().send(input)).rejects.toThrow(/NOTIFICATION_GATEWAY_URL/);
  });
});

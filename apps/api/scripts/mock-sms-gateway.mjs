#!/usr/bin/env node
// Yerel SMS/WhatsApp gateway emulatoru (demo ve test icin). Gercek mesaj
// GONDERMEZ; NOTIFICATION_PROVIDER=http ile API'nin gonderdigi istegi alir,
// terminale yazar ve bir mesaj id'si dondurur. Sirket ici bir GSM modem/SMS
// gateway'inin yerine gecer, boylece gercek hesap olmadan tum HTTP yolu
// (zaman asimi, yeniden deneme, hata durumu) gosterilebilir.
//
//   node scripts/mock-sms-gateway.mjs
//   MOCK_GATEWAY_FAIL_FIRST=2 node scripts/mock-sms-gateway.mjs   # ilk 2 istek 503 doner
//   MOCK_GATEWAY_DELAY_MS=5000 node scripts/mock-sms-gateway.mjs  # yavas gateway (zaman asimi)
//   MOCK_GATEWAY_TOKEN=secret node scripts/mock-sms-gateway.mjs   # Bearer token zorunlu
//
// API tarafi: NOTIFICATION_PROVIDER=http NOTIFICATION_GATEWAY_URL=http://localhost:4010/send

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_GATEWAY_PORT ?? 4010);
const requiredToken = process.env.MOCK_GATEWAY_TOKEN ?? '';
const delayMs = Number(process.env.MOCK_GATEWAY_DELAY_MS ?? 0);
let failuresLeft = Number(process.env.MOCK_GATEWAY_FAIL_FIRST ?? 0);
let received = 0;

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/send') {
    return reply(res, 404, { error: 'POST /send only' });
  }

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    setTimeout(() => {
      if (requiredToken && req.headers.authorization !== `Bearer ${requiredToken}`) {
        console.log('[mock-gateway] 401 rejected: missing or wrong token');
        return reply(res, 401, { error: 'unauthorized' });
      }

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return reply(res, 400, { error: 'invalid JSON' });
      }
      if (!payload.channel || !payload.to || !payload.message) {
        return reply(res, 400, { error: 'channel, to and message are required' });
      }

      if (failuresLeft > 0) {
        failuresLeft -= 1;
        console.log(`[mock-gateway] 503 simulated outage (${failuresLeft} more failures queued)`);
        return reply(res, 503, { error: 'simulated outage' });
      }

      received += 1;
      const id = `mock-${randomUUID()}`;
      console.log(['', '-'.repeat(50), `MOCK GATEWAY #${received}: ${payload.channel} -> ${payload.to}`, '', payload.message, '', `id: ${id}`, '-'.repeat(50)].join('\n'));
      reply(res, 200, { id });
    }, delayMs);
  });
});

server.listen(port, () => {
  console.log(`[mock-gateway] listening on http://localhost:${port}/send`);
  if (failuresLeft) console.log(`[mock-gateway] the first ${failuresLeft} requests will fail with 503`);
  if (delayMs) console.log(`[mock-gateway] every response is delayed by ${delayMs} ms`);
  if (requiredToken) console.log('[mock-gateway] Bearer token required');
});

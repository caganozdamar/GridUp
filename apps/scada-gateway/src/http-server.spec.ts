import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRegisterStartAddress } from './register-map.js';
import { RegisterStore } from './register-store.js';
import { startHttpServer, type GatewayState, type HttpServerHandle } from './http-server.js';
import type { ScadaPanelSnapshot } from './types.js';

const NOW = Date.now();

function snapshot(panelCode: string, overrides: Partial<ScadaPanelSnapshot> = {}): ScadaPanelSnapshot {
  return {
    panelCode,
    panelStatus: 'ONLINE',
    online: true,
    riskScore: 94,
    riskLevel: 'CRITICAL',
    ambientTemperature: 28.1,
    cableTemperature: 81.4,
    humidity: 76.2,
    current: 168.4,
    arcFlash: 55.5,
    acoustic: 72.0,
    arcFlashActive: true,
    partialDischargeActive: false,
    activeAlarm: true,
    activeAnomalyCount: 4,
    lastReadingAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('SCADA register view HTTP server', () => {
  const store = new RegisterStore();
  let apiReachable = true;
  const state: GatewayState = {
    apiBaseUrl: 'http://localhost:3000',
    modbusPort: 1502,
    staleMs: 10_000,
    apiReachable: () => apiReachable,
    lastApiSuccessAt: () => NOW,
  };
  let server: HttpServerHandle;
  let base: string;

  beforeAll(async () => {
    // PANO-003 once eklenir: cikti pano sirasina gore siralanmali, eklenis sirasina degil.
    store.updateSnapshots([snapshot('PANO-003'), snapshot('PANO-001', { riskScore: 12, riskLevel: 'NORMAL', activeAlarm: false })]);
    store.recompute(NOW, 10_000);
    server = await startHttpServer(store, state, { host: '127.0.0.1', port: 0, allowedOrigin: '*' });
    base = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('serves the same values the Modbus register table holds, in panel order', async () => {
    const body = await (await fetch(`${base}/registers`)).json();

    expect(body.panels.map((panel: { panelCode: string }) => panel.panelCode)).toEqual(['PANO-001', 'PANO-003']);
    const pano3 = body.panels[1];
    expect(pano3.registers).toHaveLength(14);

    const risk = pano3.registers[0];
    expect(risk).toMatchObject({ group: 'core', label: 40021, address: getRegisterStartAddress(2), name: 'Risk Score', raw: 94, display: '94' });
    // Gorunen ham deger, Modbus tablosundaki degerle birebir ayni.
    expect(risk.raw).toBe(store.readRegister(getRegisterStartAddress(2)));

    const byName = Object.fromEntries(pano3.registers.map((row: { name: string; display: string }) => [row.name, row.display]));
    expect(byName['Risk Level']).toBe('3 (CRITICAL)');
    expect(byName['Cable Temperature']).toBe('81.4 °C');
    expect(byName['Current']).toBe('168.4 A');
    expect(byName['Active Alarm']).toBe('YES');
    expect(byName['Arc Flash']).toBe('55.5 %');
    expect(byName['Partial Discharge']).toBe('NO');
  });

  it('reports gateway and API state and says the Modbus side is read-only', async () => {
    const body = await (await fetch(`${base}/registers`)).json();
    expect(body.modbus).toEqual({ port: 1502, readOnly: true, functions: ['FC03', 'FC04'] });
    expect(body.api.reachable).toBe(true);
    expect(body.staleMs).toBe(10_000);

    apiReachable = false;
    expect((await (await fetch(`${base}/registers`)).json()).api.reachable).toBe(false);
    apiReachable = true;
  });

  it('is GET only: writes are rejected and cannot change any register', async () => {
    const before = store.readRegister(getRegisterStartAddress(2));
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${base}/registers`, { method, body: method === 'DELETE' ? undefined : '{}' });
      expect(response.status).toBe(405);
    }
    expect(store.readRegister(getRegisterStartAddress(2))).toBe(before);
  });

  it('answers the health check, CORS preflight and unknown paths', async () => {
    expect((await (await fetch(`${base}/health`)).json()).status).toBe('ok');
    expect((await fetch(`${base}/nope`)).status).toBe(404);

    const preflight = await fetch(`${base}/registers`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-methods')).toContain('GET');
  });
});

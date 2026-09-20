import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { getBlockIndexForPanelCode } from './register-map.js';
import type { RegisterStore } from './register-store.js';
import { describePanelRegisters, type RegisterRow } from './register-view.js';

/**
 * Dashboard'daki SCADA ekrani icin READ-ONLY HTTP ucu.
 *
 * Tarayici Modbus TCP konusamaz; bu uc, Modbus sunucusunun sundugu AYNI
 * register tablosunu (RegisterStore) JSON olarak gosterir. Yani ekranda gorulen
 * ham degerler, bir SCADA istemcisinin FC03 ile okuyacagi degerlerin ta kendisidir;
 * GRID UP API'sinden ayri bir hesap yapilmaz. Yalnizca GET; hicbir yazma yolu yoktur.
 */

export interface GatewayState {
  apiBaseUrl: string;
  modbusPort: number;
  staleMs: number;
  /** Son API cekimi basarili miydi? */
  apiReachable: () => boolean;
  /** Son BASARILI API cekiminin zamani (ms), hic yoksa null. */
  lastApiSuccessAt: () => number | null;
}

export interface PanelRegisterView {
  panelCode: string;
  blockIndex: number;
  registers: RegisterRow[];
}

export interface RegistersResponse {
  generatedAt: string;
  modbus: { port: number; readOnly: true; functions: string[] };
  api: { baseUrl: string; reachable: boolean; lastSuccessAt: string | null };
  staleMs: number;
  panels: PanelRegisterView[];
}

export function buildRegistersResponse(store: RegisterStore, state: GatewayState, now: number): RegistersResponse {
  const panels = store.knownPanelCodes
    .map((panelCode) => ({ panelCode, blockIndex: getBlockIndexForPanelCode(panelCode) }))
    .sort((a, b) => a.blockIndex - b.blockIndex)
    .map(({ panelCode, blockIndex }) => ({
      panelCode,
      blockIndex,
      registers: describePanelRegisters((address) => store.readRegister(address), blockIndex),
    }));

  const lastSuccess = state.lastApiSuccessAt();
  return {
    generatedAt: new Date(now).toISOString(),
    modbus: { port: state.modbusPort, readOnly: true, functions: ['FC03', 'FC04'] },
    api: {
      baseUrl: state.apiBaseUrl,
      reachable: state.apiReachable(),
      lastSuccessAt: lastSuccess === null ? null : new Date(lastSuccess).toISOString(),
    },
    staleMs: state.staleMs,
    panels,
  };
}

export interface HttpServerHandle {
  port: number;
  close(): Promise<void>;
}

export function startHttpServer(
  store: RegisterStore,
  state: GatewayState,
  options: { host: string; port: number; allowedOrigin: string },
): Promise<HttpServerHandle> {
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': options.allowedOrigin,
    });
    res.end(JSON.stringify(body));
  };

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0];

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': options.allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      });
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      send(res, 405, { error: 'read-only: GET only' });
      return;
    }
    if (path === '/health') {
      send(res, 200, { status: 'ok' });
      return;
    }
    if (path === '/registers') {
      send(res, 200, buildRegistersResponse(store, state, Date.now()));
      return;
    }
    send(res, 404, { error: 'not found' });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

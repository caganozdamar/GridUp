import { SCADA_GATEWAY_URL } from '../config';
import { ApiError } from './client';

// SCADA Gateway'in read-only /registers ucunun cevabi (bkz.
// apps/scada-gateway/src/http-server.ts). Gateway ayri bir servis oldugu icin
// tipler burada, @grid-up/shared'dan bagimsiz tanimlanir.
export interface ScadaRegisterRow {
  group: 'core' | 'extended';
  label: number;
  address: number;
  name: string;
  raw: number;
  display: string;
}

export interface ScadaPanelRegisters {
  panelCode: string;
  blockIndex: number;
  registers: ScadaRegisterRow[];
}

export interface ScadaRegistersResponse {
  generatedAt: string;
  modbus: { port: number; readOnly: true; functions: string[] };
  api: { baseUrl: string; reachable: boolean; lastSuccessAt: string | null };
  staleMs: number;
  panels: ScadaPanelRegisters[];
}

export const scadaApi = {
  registers: async (): Promise<ScadaRegistersResponse> => {
    let response: Response;
    try {
      response = await fetch(new URL('/registers', SCADA_GATEWAY_URL));
    } catch {
      throw new ApiError(`SCADA gateway not reachable at ${SCADA_GATEWAY_URL}`);
    }
    if (!response.ok) {
      throw new ApiError(`SCADA gateway request failed (${response.status})`, response.status);
    }
    return (await response.json()) as ScadaRegistersResponse;
  },
};

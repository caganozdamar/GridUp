export interface ScadaGatewayConfig {
  apiBaseUrl: string;
  modbusTcpPort: number;
  refreshIntervalMs: number;
  staleMs: number;
  // Dashboard'un SCADA ekrani icin read-only HTTP ucu. Port 0 = kapali.
  httpHost: string;
  httpPort: number;
  httpAllowedOrigin: string;
}

function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return value;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return Math.trunc(value);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ScadaGatewayConfig {
  return {
    apiBaseUrl: env.API_BASE_URL ?? 'http://localhost:3000',
    // Not: gelistirme ortaminda ayricalikli port / cakisma yasanmamasi icin
    // varsayilan 1502 kullanilir. Production'da uygun oldugunda standart
    // Modbus TCP portu 502'ye map edilebilir (bkz. docs/modbus-register-map.md).
    modbusTcpPort: parsePositiveInt(env.MODBUS_TCP_PORT, 1502, 'MODBUS_TCP_PORT'),
    refreshIntervalMs: parsePositiveInt(env.SCADA_REFRESH_INTERVAL_MS, 2000, 'SCADA_REFRESH_INTERVAL_MS'),
    staleMs: parsePositiveInt(env.SCADA_DATA_STALE_MS, 10000, 'SCADA_DATA_STALE_MS'),
    // Varsayilan olarak yalnizca bu makineden erisilir; on-prem dagitimda
    // (docker) SCADA_HTTP_HOST=0.0.0.0 verilir.
    httpHost: env.SCADA_HTTP_HOST?.trim() || '127.0.0.1',
    httpPort: parsePort(env.SCADA_HTTP_PORT, 1580, 'SCADA_HTTP_PORT'),
    httpAllowedOrigin: env.SCADA_HTTP_ALLOWED_ORIGIN?.trim() || '*',
  };
}

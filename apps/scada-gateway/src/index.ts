import 'dotenv/config';
import { ScadaApiClient } from './api-client.js';
import { loadConfig } from './config.js';
import { logApiRecovered, logApiUnreachable, logSnapshotUpdated, logUnsupportedPanel } from './logger.js';
import { startHttpServer, type HttpServerHandle } from './http-server.js';
import { startModbusServer } from './modbus-server.js';
import { RegisterStore } from './register-store.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const apiClient = new ScadaApiClient(config.apiBaseUrl);
  const store = new RegisterStore();

  console.log(`[SCADA] GRID UP API: ${config.apiBaseUrl}`);
  console.log(
    `[SCADA] Refresh interval: ${config.refreshIntervalMs}ms | Stale threshold: ${config.staleMs}ms`,
  );

  const modbusServer = startModbusServer(store, { host: '0.0.0.0', port: config.modbusTcpPort });
  console.log(
    `[SCADA] Modbus TCP server listening on port ${config.modbusTcpPort} (READ-ONLY, FC03/FC04 Read Holding Registers)`,
  );

  let lastFetchOk = true;
  let lastApiSuccessAt: number | null = null;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  let httpServer: HttpServerHandle | undefined;
  if (config.httpPort !== 0) {
    httpServer = await startHttpServer(
      store,
      {
        apiBaseUrl: config.apiBaseUrl,
        modbusPort: config.modbusTcpPort,
        staleMs: config.staleMs,
        apiReachable: () => lastFetchOk,
        lastApiSuccessAt: () => lastApiSuccessAt,
      },
      { host: config.httpHost, port: config.httpPort, allowedOrigin: config.httpAllowedOrigin },
    );
    console.log(
      `[SCADA] Register view (read-only HTTP for the dashboard) on http://${config.httpHost}:${httpServer.port}/registers`,
    );
  }

  async function tick(): Promise<void> {
    try {
      const snapshots = await apiClient.fetchPanelSnapshots();
      const newlyUnsupported = store.updateSnapshots(snapshots);
      for (const panelCode of newlyUnsupported) {
        logUnsupportedPanel(panelCode);
      }

      if (!lastFetchOk) {
        logApiRecovered();
      }
      lastFetchOk = true;
      lastApiSuccessAt = Date.now();
    } catch (error) {
      if (lastFetchOk) {
        logApiUnreachable((error as Error).message);
      }
      lastFetchOk = false;
    }

    // Data Quality, duvar saatine gore her tick'te yeniden hesaplanir; boylece
    // API'ye ulasilamasa bile (ya da simulator durmus olsa bile) stale
    // panolar otomatik olarak INVALID'e doner (Asama 7 madde 7/8/14).
    store.recompute(Date.now(), config.staleMs);
    logSnapshotUpdated(store.knownPanelCount, store.usedRegisterCount);
  }

  function scheduleNext(): void {
    timer = setTimeout(() => {
      void tick().finally(() => {
        if (!stopped) scheduleNext();
      });
    }, config.refreshIntervalMs);
  }

  async function shutdown(): Promise<void> {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log('\n[SCADA] Shutting down gracefully...');
    await modbusServer.close();
    await httpServer?.close();
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await tick();
  scheduleNext();
}

main().catch((error) => {
  console.error('[SCADA] Fatal error:', error);
  process.exitCode = 1;
});

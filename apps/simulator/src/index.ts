import 'dotenv/config';
import { SensorType } from '@grid-up/shared';
import { ApiClient } from './api-client.js';
import { printTickSummary } from './cli-output.js';
import { loadConfig, type SimulatorConfig } from './config.js';
import { nextPanelState, randomInitialState } from './sensor-generator.js';
import { SimulationScenario } from './scenario.js';
import type { BatchReadingInput, DiscoveredPanel, PanelSensorState } from './types.js';

const SENSOR_TYPE_TO_STATE_KEY: Record<SensorType, keyof PanelSensorState> = {
  [SensorType.AMBIENT_TEMPERATURE]: 'ambientTemperature',
  [SensorType.CABLE_TEMPERATURE]: 'cableTemperature',
  [SensorType.HUMIDITY]: 'humidity',
  [SensorType.CURRENT]: 'current',
};

const DISCOVERY_RETRY_ATTEMPTS = 5;
const DISCOVERY_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discoverPanelsWithRetry(apiClient: ApiClient): Promise<DiscoveredPanel[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DISCOVERY_RETRY_ATTEMPTS; attempt++) {
    try {
      return await apiClient.discoverOnlinePanels();
    } catch (error) {
      lastError = error;
      console.warn(
        `[SIMULATOR] Panel discovery failed (attempt ${attempt}/${DISCOVERY_RETRY_ATTEMPTS}): ${(error as Error).message}`,
      );
      if (attempt < DISCOVERY_RETRY_ATTEMPTS) {
        await sleep(DISCOVERY_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

// TARGET_PANEL_CODE belirtilmisse yalnizca o pano failure senaryosunu
// calistirir; diger tum panolar NORMAL kalir (Asama 4 madde 11).
function scenarioForPanel(config: SimulatorConfig, panelCode: string): SimulationScenario {
  if (!config.targetPanelCode) return config.scenario;
  return panelCode === config.targetPanelCode ? config.scenario : SimulationScenario.NORMAL;
}

function buildReadings(
  panels: DiscoveredPanel[],
  states: Map<string, PanelSensorState>,
  config: SimulatorConfig,
): BatchReadingInput[] {
  const timestamp = new Date().toISOString();
  const readings: BatchReadingInput[] = [];

  for (const panel of panels) {
    const prevState = states.get(panel.id) ?? randomInitialState();
    const scenario = scenarioForPanel(config, panel.code);
    const nextState = nextPanelState(scenario, prevState);
    states.set(panel.id, nextState);

    for (const [type, sensor] of Object.entries(panel.sensorsByType)) {
      if (!sensor) continue;
      const stateKey = SENSOR_TYPE_TO_STATE_KEY[type as SensorType];
      readings.push({ sensorId: sensor.id, value: nextState[stateKey], timestamp });
    }
  }

  return readings;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const apiClient = new ApiClient(config.apiBaseUrl);

  console.log(`[SIMULATOR] API: ${config.apiBaseUrl} | interval: ${config.intervalMs}ms`);
  console.log(
    `[SIMULATOR] Scenario: ${config.scenario}` +
      (config.targetPanelCode ? ` (target panel: ${config.targetPanelCode}, others: NORMAL)` : ' (all panels)'),
  );
  console.log('[SIMULATOR] Discovering panels...');

  const panels = await discoverPanelsWithRetry(apiClient);
  if (panels.length === 0) {
    console.warn('[SIMULATOR] No ONLINE panels found. Nothing to simulate.');
    return;
  }

  console.log(`[SIMULATOR] Discovered ${panels.length} ONLINE panel(s).`);

  const states = new Map<string, PanelSensorState>(panels.map((panel) => [panel.id, randomInitialState()]));

  let tick = 0;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function runTick(): Promise<void> {
    tick++;
    const readings = buildReadings(panels, states, config);

    try {
      const { inserted } = await apiClient.postReadingsBatch(readings);
      printTickSummary(tick, panels, states, inserted, readings.length);
    } catch (error) {
      console.error(`[SIMULATOR] Tick #${tick} failed: ${(error as Error).message}`);
    }
  }

  function scheduleNext(): void {
    timer = setTimeout(() => {
      void runTick().finally(() => {
        if (!stopped) {
          scheduleNext();
        }
      });
    }, config.intervalMs);
  }

  function shutdown(): void {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log('\n[SIMULATOR] Shutting down gracefully...');
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await runTick();
  scheduleNext();
}

main().catch((error) => {
  console.error('[SIMULATOR] Fatal error:', error);
  process.exitCode = 1;
});

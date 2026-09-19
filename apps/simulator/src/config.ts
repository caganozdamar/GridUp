import { SimulationScenario } from './scenario.js';

export interface SimulatorConfig {
  apiBaseUrl: string;
  intervalMs: number;
  scenario: SimulationScenario;
  /** Belirtilmisse, yalnizca bu koddaki pano senaryoyu calistirir; diger tum panolar NORMAL kalir. */
  targetPanelCode?: string;
}

const VALID_SCENARIOS = new Set<string>(Object.values(SimulationScenario));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SimulatorConfig {
  const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000';
  const intervalMs = Number(env.SIMULATION_INTERVAL_MS ?? 2000);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid SIMULATION_INTERVAL_MS: ${env.SIMULATION_INTERVAL_MS}`);
  }

  const scenarioRaw = env.SIMULATION_SCENARIO ?? SimulationScenario.NORMAL;
  if (!VALID_SCENARIOS.has(scenarioRaw)) {
    throw new Error(`Invalid SIMULATION_SCENARIO: ${scenarioRaw}`);
  }
  const scenario = scenarioRaw as SimulationScenario;

  const targetPanelCode = env.TARGET_PANEL_CODE?.trim() || undefined;

  return { apiBaseUrl, intervalMs, scenario, targetPanelCode };
}

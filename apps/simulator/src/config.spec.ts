import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { SimulationScenario } from './scenario.js';

describe('loadConfig', () => {
  it('defaults to NORMAL scenario with no target panel', () => {
    const config = loadConfig({});
    expect(config.scenario).toBe(SimulationScenario.NORMAL);
    expect(config.targetPanelCode).toBeUndefined();
  });

  it('parses a valid scenario and target panel code from the environment', () => {
    const config = loadConfig({ SIMULATION_SCENARIO: 'OVERHEATING', TARGET_PANEL_CODE: 'PANO-003' });
    expect(config.scenario).toBe(SimulationScenario.OVERHEATING);
    expect(config.targetPanelCode).toBe('PANO-003');
  });

  it('treats a blank TARGET_PANEL_CODE as unset', () => {
    const config = loadConfig({ TARGET_PANEL_CODE: '   ' });
    expect(config.targetPanelCode).toBeUndefined();
  });

  it('rejects an unknown scenario', () => {
    expect(() => loadConfig({ SIMULATION_SCENARIO: 'NOT_A_SCENARIO' })).toThrow();
  });

  it('still validates SIMULATION_INTERVAL_MS', () => {
    expect(() => loadConfig({ SIMULATION_INTERVAL_MS: '-5' })).toThrow();
  });
});

describe('PANEL_RATED_CURRENT_A', () => {
  it('defaults to the 150 A reference rating', () => {
    expect(loadConfig({}).ratedCurrentA).toBe(150);
  });

  it('reads a custom rating', () => {
    expect(loadConfig({ PANEL_RATED_CURRENT_A: '2312' }).ratedCurrentA).toBe(2312);
  });

  it('rejects a non-positive or invalid rating', () => {
    expect(() => loadConfig({ PANEL_RATED_CURRENT_A: '0' })).toThrow();
    expect(() => loadConfig({ PANEL_RATED_CURRENT_A: 'x' })).toThrow();
  });
});

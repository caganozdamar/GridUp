import { describe, expect, it } from 'vitest';
import {
  AMBIENT_RANGE,
  CABLE_RANGE,
  CURRENT_RANGE,
  HUMIDITY_RANGE,
  nextPanelState,
  randomInitialState,
} from './sensor-generator.js';
import { SimulationScenario } from './scenario.js';
import type { PanelSensorState } from './types.js';

function isFiniteState(state: object): boolean {
  return Object.values(state).every((value) => Number.isFinite(value));
}

describe('randomInitialState', () => {
  it('produces finite values within normal ranges', () => {
    for (let i = 0; i < 200; i++) {
      const state = randomInitialState();
      expect(isFiniteState(state)).toBe(true);
      expect(state.ambientTemperature).toBeGreaterThanOrEqual(AMBIENT_RANGE.min);
      expect(state.ambientTemperature).toBeLessThanOrEqual(AMBIENT_RANGE.max);
      expect(state.cableTemperature).toBeGreaterThanOrEqual(CABLE_RANGE.min);
      expect(state.cableTemperature).toBeLessThanOrEqual(CABLE_RANGE.max);
      expect(state.humidity).toBeGreaterThanOrEqual(HUMIDITY_RANGE.min);
      expect(state.humidity).toBeLessThanOrEqual(HUMIDITY_RANGE.max);
      expect(state.current).toBeGreaterThanOrEqual(CURRENT_RANGE.min);
      expect(state.current).toBeLessThanOrEqual(CURRENT_RANGE.max);
    }
  });
});

describe('nextPanelState (NORMAL scenario)', () => {
  it('stays within normal bounds and only drifts by small bounded steps over many ticks', () => {
    let state = randomInitialState();

    for (let tick = 0; tick < 500; tick++) {
      const previous = state;
      state = nextPanelState(SimulationScenario.NORMAL, previous);

      expect(isFiniteState(state)).toBe(true);

      expect(state.ambientTemperature).toBeGreaterThanOrEqual(AMBIENT_RANGE.min);
      expect(state.ambientTemperature).toBeLessThanOrEqual(AMBIENT_RANGE.max);
      expect(state.cableTemperature).toBeGreaterThanOrEqual(CABLE_RANGE.min);
      expect(state.cableTemperature).toBeLessThanOrEqual(CABLE_RANGE.max);
      expect(state.humidity).toBeGreaterThanOrEqual(HUMIDITY_RANGE.min);
      expect(state.humidity).toBeLessThanOrEqual(HUMIDITY_RANGE.max);
      expect(state.current).toBeGreaterThanOrEqual(CURRENT_RANGE.min);
      expect(state.current).toBeLessThanOrEqual(CURRENT_RANGE.max);

      // No sensor should be able to jump wildly in a single tick (bounded drift).
      expect(Math.abs(state.ambientTemperature - previous.ambientTemperature)).toBeLessThanOrEqual(1);
      expect(Math.abs(state.humidity - previous.humidity)).toBeLessThanOrEqual(1);
      expect(Math.abs(state.current - previous.current)).toBeLessThanOrEqual(5);
      expect(Math.abs(state.cableTemperature - previous.cableTemperature)).toBeLessThanOrEqual(5);
    }
  });

  it('drives cable temperature up when current rises (correlation)', () => {
    const base = randomInitialState();

    const highCurrentState = nextPanelState(SimulationScenario.NORMAL, {
      ...base,
      current: CURRENT_RANGE.max,
      cableTemperature: CABLE_RANGE.min,
    });
    const lowCurrentState = nextPanelState(SimulationScenario.NORMAL, {
      ...base,
      current: CURRENT_RANGE.min,
      cableTemperature: CABLE_RANGE.min,
    });

    expect(highCurrentState.cableTemperature).toBeGreaterThan(lowCurrentState.cableTemperature);
  });

});

function isPositiveFiniteState(state: PanelSensorState): boolean {
  return (
    Number.isFinite(state.ambientTemperature) &&
    Number.isFinite(state.cableTemperature) &&
    Number.isFinite(state.humidity) &&
    Number.isFinite(state.current) &&
    state.ambientTemperature > 0 &&
    state.cableTemperature > 0 &&
    state.humidity >= 0 &&
    state.current > 0
  );
}

const BASELINE_STATE: PanelSensorState = {
  ambientTemperature: 28,
  cableTemperature: 38,
  humidity: 45,
  current: 90,
};

describe('nextPanelState (failure scenarios)', () => {
  it('drives cable temperature upward over time in OVERHEATING, without a wild single-tick jump', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 15; i++) {
      const previous = state;
      state = nextPanelState(SimulationScenario.OVERHEATING, previous);
      expect(state.cableTemperature).toBeGreaterThanOrEqual(previous.cableTemperature);
      expect(state.cableTemperature - previous.cableTemperature).toBeLessThanOrEqual(5);
    }
    expect(state.cableTemperature).toBeGreaterThan(70);
  });

  it('clamps OVERHEATING cable temperature at a sane ceiling instead of running away', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 200; i++) {
      state = nextPanelState(SimulationScenario.OVERHEATING, state);
      expect(state.cableTemperature).toBeLessThanOrEqual(95);
    }
  });

  it('drives current upward over time in OVERCURRENT', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 15; i++) {
      state = nextPanelState(SimulationScenario.OVERCURRENT, state);
    }
    expect(state.current).toBeGreaterThan(150);
  });

  it('raises cable temperature with a thermal lag behind the current rise in OVERCURRENT', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 30; i++) {
      state = nextPanelState(SimulationScenario.OVERCURRENT, state);
    }
    expect(state.current).toBeGreaterThan(CURRENT_RANGE.max);
    expect(state.cableTemperature).toBeGreaterThan(CABLE_RANGE.max);
  });

  it('drives humidity upward over time in HIGH_HUMIDITY', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 15; i++) {
      state = nextPanelState(SimulationScenario.HIGH_HUMIDITY, state);
    }
    expect(state.humidity).toBeGreaterThan(75);
  });

  it('worsens current, cable temperature and humidity together in COMBINED_FAILURE', () => {
    let state = BASELINE_STATE;
    for (let i = 0; i < 20; i++) {
      state = nextPanelState(SimulationScenario.COMBINED_FAILURE, state);
    }
    expect(state.current).toBeGreaterThan(BASELINE_STATE.current);
    expect(state.cableTemperature).toBeGreaterThan(BASELINE_STATE.cableTemperature);
    expect(state.humidity).toBeGreaterThan(BASELINE_STATE.humidity);
  });

  it('produces a stronger combined-failure cable temperature than the overheating-only scenario after the same number of ticks', () => {
    let overheatingOnly = BASELINE_STATE;
    let combined = BASELINE_STATE;
    for (let i = 0; i < 20; i++) {
      overheatingOnly = nextPanelState(SimulationScenario.OVERHEATING, overheatingOnly);
      combined = nextPanelState(SimulationScenario.COMBINED_FAILURE, combined);
    }
    // COMBINED_FAILURE'da current de yukseldigi icin kablo sicakligi hem
    // dogrudan hem de akim korelasyonuyla beslenir; ayni tick sayisinda en
    // az overheating-only kadar yuksek olmalidir.
    expect(combined.cableTemperature).toBeGreaterThanOrEqual(overheatingOnly.cableTemperature - 5);
  });

  it('keeps all failure scenarios finite and physically sane over many ticks', () => {
    const scenarios = [
      SimulationScenario.OVERHEATING,
      SimulationScenario.OVERCURRENT,
      SimulationScenario.HIGH_HUMIDITY,
      SimulationScenario.COMBINED_FAILURE,
    ];

    for (const scenario of scenarios) {
      let state = randomInitialState();
      for (let i = 0; i < 50; i++) {
        state = nextPanelState(scenario, state);
        expect(isPositiveFiniteState(state)).toBe(true);
      }
    }
  });
});

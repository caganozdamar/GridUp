import { describe, expect, it } from 'vitest';
import { ActionPriority, AnomalyType, type RiskComponents } from '@grid-up/shared';
import { RECOMMENDED_ACTION_MESSAGES } from './recommended-actions.config.js';
import { buildRecommendedActions, type RecommendedActionsInput } from './recommended-actions.util.js';
import type { RiskFlags } from '../risk-engine/risk-scoring.js';

const NO_FLAGS: RiskFlags = {
  highTemperature: false,
  temperatureRise: false,
  overcurrent: false,
  highHumidity: false,
  multiSensorRisk: false,
};

const NO_COMPONENTS: RiskComponents = { temperature: 0, current: 0, humidity: 0, trend: 0 };

function input(overrides: Partial<RecommendedActionsInput>): RecommendedActionsInput {
  return { score: 0, components: NO_COMPONENTS, flags: NO_FLAGS, ...overrides };
}

describe('buildRecommendedActions', () => {
  it('produces the correct inspection guidance for HIGH_TEMPERATURE', () => {
    const actions = buildRecommendedActions(
      input({ components: { ...NO_COMPONENTS, temperature: 60 }, flags: { ...NO_FLAGS, highTemperature: true } }),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].source).toBe(AnomalyType.HIGH_TEMPERATURE);
    expect(actions[0].message).toBe(RECOMMENDED_ACTION_MESSAGES[AnomalyType.HIGH_TEMPERATURE]);
  });

  it('produces the correct inspection guidance for OVERCURRENT', () => {
    const actions = buildRecommendedActions(
      input({ components: { ...NO_COMPONENTS, current: 60 }, flags: { ...NO_FLAGS, overcurrent: true } }),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].source).toBe(AnomalyType.OVERCURRENT);
    expect(actions[0].message).toBe(RECOMMENDED_ACTION_MESSAGES[AnomalyType.OVERCURRENT]);
  });

  it('produces the correct inspection guidance for HIGH_HUMIDITY', () => {
    const actions = buildRecommendedActions(
      input({ components: { ...NO_COMPONENTS, humidity: 50 }, flags: { ...NO_FLAGS, highHumidity: true } }),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].source).toBe(AnomalyType.HIGH_HUMIDITY);
    expect(actions[0].message).toBe(RECOMMENDED_ACTION_MESSAGES[AnomalyType.HIGH_HUMIDITY]);
  });

  it('produces prioritized guidance for MULTI_SENSOR_RISK', () => {
    const actions = buildRecommendedActions(input({ score: 85, flags: { ...NO_FLAGS, multiSensorRisk: true } }));
    expect(actions).toHaveLength(1);
    expect(actions[0].source).toBe(AnomalyType.MULTI_SENSOR_RISK);
    expect(actions[0].message).toBe(RECOMMENDED_ACTION_MESSAGES[AnomalyType.MULTI_SENSOR_RISK]);
    expect(actions[0].priority).toBe(ActionPriority.URGENT);
  });

  it('never produces duplicate action messages: one action per active condition', () => {
    const actions = buildRecommendedActions(
      input({
        score: 90,
        components: { temperature: 90, current: 90, humidity: 90, trend: 90 },
        flags: {
          highTemperature: true,
          temperatureRise: true,
          overcurrent: true,
          highHumidity: true,
          multiSensorRisk: true,
        },
      }),
    );
    expect(actions).toHaveLength(5);
    const sources = actions.map((action) => action.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('returns an empty list when no conditions are active', () => {
    expect(buildRecommendedActions(input({}))).toEqual([]);
  });

  it('sorts URGENT actions before PROMPT/ROUTINE', () => {
    const actions = buildRecommendedActions(
      input({
        components: { temperature: 20, current: 90, humidity: 0, trend: 0 },
        flags: { ...NO_FLAGS, highTemperature: true, overcurrent: true },
      }),
    );
    expect(actions[0].source).toBe(AnomalyType.OVERCURRENT);
    expect(actions[0].priority).toBe(ActionPriority.URGENT);
  });

  it('never contains a dangerous / invasive control instruction', () => {
    const forbidden = [
      'breaker',
      'bypass',
      'energiz',
      'live conductor',
      'relay setting',
      'de-energiz',
      'switch off',
      'switch on',
      'open the',
      'close the',
    ];
    for (const message of Object.values(RECOMMENDED_ACTION_MESSAGES)) {
      const lower = message.toLowerCase();
      for (const term of forbidden) {
        expect(lower).not.toContain(term);
      }
    }
  });
});

// Asama 9 madde 7-10: mevcut risk components + analiz flag'lerinden (aynen
// RiskEngineService.reconcileAnomalies icindeki karar mantigi, bkz.
// apps/api/src/risk-engine/risk-engine.service.ts) deterministic recommended
// actions uretir. Yeni bir AI/LLM servisi kullanmaz; risk-engine'in kendisini
// veya persist ettigi Anomaly kayitlarini degistirmez, yalnizca ayni
// flag/skor bilgisinden sadece-okunur bir turetim yapar.

import { ActionPriority, AnomalyType, getRiskLevel, RiskLevel, type RecommendedAction, type RiskComponents } from '@grid-up/shared';
import type { RiskFlags } from '../risk-engine/risk-scoring.js';
import { RECOMMENDED_ACTION_MESSAGES } from './recommended-actions.config.js';

export interface RecommendedActionsInput {
  score: number;
  components: RiskComponents;
  flags: RiskFlags;
}

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  [ActionPriority.URGENT]: 0,
  [ActionPriority.PROMPT]: 1,
  [ActionPriority.ROUTINE]: 2,
};

function priorityForScore(score: number): ActionPriority {
  const level = getRiskLevel(score);
  if (level === RiskLevel.CRITICAL) return ActionPriority.URGENT;
  if (level === RiskLevel.HIGH) return ActionPriority.PROMPT;
  // NORMAL/WARNING -> ROUTINE (Asama 9 madde 9: "WARNING-related -> ROUTINE/PROMPT").
  return ActionPriority.ROUTINE;
}

interface Decision {
  type: AnomalyType;
  active: boolean;
  severityScore: number;
}

export function buildRecommendedActions(input: RecommendedActionsInput): RecommendedAction[] {
  const { score, components, flags } = input;

  // Siralama/severityScore secimi RiskEngineService.reconcileAnomalies'deki
  // ile birebir aynidir; boylece burada uretilen priority, sistemin
  // persist edecegi Anomaly.severity ile tutarlidir.
  const decisions: Decision[] = [
    { type: AnomalyType.HIGH_TEMPERATURE, active: flags.highTemperature, severityScore: components.temperature },
    { type: AnomalyType.TEMPERATURE_RISE, active: flags.temperatureRise, severityScore: components.trend },
    { type: AnomalyType.OVERCURRENT, active: flags.overcurrent, severityScore: components.current },
    { type: AnomalyType.HIGH_HUMIDITY, active: flags.highHumidity, severityScore: components.humidity },
    { type: AnomalyType.MULTI_SENSOR_RISK, active: flags.multiSensorRisk, severityScore: score },
  ];

  const actions = decisions
    .filter((decision) => decision.active)
    .map((decision) => ({
      source: decision.type,
      priority: priorityForScore(decision.severityScore),
      message: RECOMMENDED_ACTION_MESSAGES[decision.type],
    }));

  return actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

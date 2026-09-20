export enum RiskLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const RISK_LEVEL_THRESHOLDS: Record<RiskLevel, { min: number; max: number }> = {
  [RiskLevel.NORMAL]: { min: 0, max: 29 },
  [RiskLevel.WARNING]: { min: 30, max: 59 },
  [RiskLevel.HIGH]: { min: 60, max: 79 },
  [RiskLevel.CRITICAL]: { min: 80, max: 100 },
};

export function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_LEVEL_THRESHOLDS[RiskLevel.CRITICAL].min) return RiskLevel.CRITICAL;
  if (score >= RISK_LEVEL_THRESHOLDS[RiskLevel.HIGH].min) return RiskLevel.HIGH;
  if (score >= RISK_LEVEL_THRESHOLDS[RiskLevel.WARNING].min) return RiskLevel.WARNING;
  return RiskLevel.NORMAL;
}

export interface RiskScore {
  id: string;
  panelId: string;
  score: number;
  level: RiskLevel;
  calculatedAt: string;
}

// Asama 4: anomaly engine explainability DTO'lari.
// Bu tipler sadece API response sekli icindir; RiskScore Prisma modeli
// degismez (bkz. apps/api/src/risk-engine).
export interface RiskComponents {
  temperature: number;
  current: number;
  humidity: number;
  trend: number;
  /** Ark flash riski (0-100). Guvenlik-kritik oldugu icin agirlikli toplama girmez, skora taban (floor) olur. */
  arcFlash: number;
  /** Akustik / kismi desarj riski (0-100). Agirlikli toplama girmez, skora taban (floor) olur. */
  acoustic: number;
}

export interface RiskExplanation {
  score: number;
  level: RiskLevel;
  calculatedAt: string;
  components: RiskComponents;
  reasons: string[];
}

export interface PanelRiskResponse {
  latest: RiskExplanation | RiskScore | null;
  history: RiskScore[];
}

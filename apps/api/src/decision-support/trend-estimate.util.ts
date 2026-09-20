// Asama 9 madde 1-4: Time-to-Critical / Critical Threshold Estimate.
//
// Bu bir MACHINE LEARNING/AI ozelligi DEGILDIR. Son birkac RiskScore
// kaydindan (bkz. RiskScore Prisma modeli) turetilen, dogrusal, aciklanabilir
// bir TREND-BASED ESTIMATE'tir: "mevcut egim aynen devam ederse CRITICAL
// threshold'a ne kadar surede ulasilir?" sorusuna cevap verir.
//
// Risk score formulu/threshold'lari burada degistirilmez; CRITICAL esigi
// @grid-up/shared'daki RISK_LEVEL_THRESHOLDS'ten okunur (risk-engine.config.ts
// yeni bir yerde threshold hard-code etmez).

import { RISK_LEVEL_THRESHOLDS, RiskLevel, TrendEstimateStatus, TrendQuality, type TrendEstimate } from '@grid-up/shared';
import {
  TREND_MAX_DISPLAY_HORIZON_MINUTES,
  TREND_MIN_OBSERVATION_MS,
  TREND_MIN_SAMPLES,
  TREND_NOISE_SLOPE_PER_MINUTE,
  TREND_QUALITY_HIGH_MIN_CONSISTENCY,
  TREND_QUALITY_HIGH_MIN_OBSERVATION_MS,
  TREND_QUALITY_HIGH_MIN_SAMPLES,
  TREND_QUALITY_MEDIUM_MIN_CONSISTENCY,
  TREND_QUALITY_MEDIUM_MIN_OBSERVATION_MS,
  TREND_QUALITY_MEDIUM_MIN_SAMPLES,
  TREND_SAMPLE_WINDOW,
} from './decision-support.config.js';

export interface RiskScoreSample {
  score: number;
  calculatedAt: Date;
}

const CRITICAL_THRESHOLD = RISK_LEVEL_THRESHOLDS[RiskLevel.CRITICAL].min;

function insufficientData(): TrendEstimate {
  return {
    status: TrendEstimateStatus.INSUFFICIENT_DATA,
    riskSlopePerMinute: null,
    estimatedMinutesToCritical: null,
    message: 'Insufficient trend data.',
    quality: null,
  };
}

function alreadyCritical(): TrendEstimate {
  return {
    status: TrendEstimateStatus.CRITICAL,
    riskSlopePerMinute: null,
    estimatedMinutesToCritical: null,
    message: 'Critical threshold reached.',
    quality: null,
  };
}

/**
 * Ardisik orneklerin ne kadarinin genel egim yonuyle tutarli oldugunu (0-1)
 * hesaplar. Trend Quality'nin "slope consistency" bileseni budur; ML
 * confidence degildir, yalnizca gecmis orneklerin ne kadar duzenli/gurultusuz
 * oldugunu yansitan deterministik bir orandir.
 */
function computeConsistency(chronological: RiskScoreSample[], slope: number): number {
  if (chronological.length < 2) return 0;
  let consistent = 0;
  let pairs = 0;
  for (let i = 1; i < chronological.length; i++) {
    const delta = chronological[i].score - chronological[i - 1].score;
    pairs++;
    if (slope >= 0 ? delta >= 0 : delta <= 0) consistent++;
  }
  return pairs === 0 ? 0 : consistent / pairs;
}

function computeQuality(sampleCount: number, durationMs: number, consistency: number): TrendQuality {
  if (
    sampleCount >= TREND_QUALITY_HIGH_MIN_SAMPLES &&
    durationMs >= TREND_QUALITY_HIGH_MIN_OBSERVATION_MS &&
    consistency >= TREND_QUALITY_HIGH_MIN_CONSISTENCY
  ) {
    return TrendQuality.HIGH;
  }
  if (
    sampleCount >= TREND_QUALITY_MEDIUM_MIN_SAMPLES &&
    durationMs >= TREND_QUALITY_MEDIUM_MIN_OBSERVATION_MS &&
    consistency >= TREND_QUALITY_MEDIUM_MIN_CONSISTENCY
  ) {
    return TrendQuality.MEDIUM;
  }
  return TrendQuality.LOW;
}

/**
 * `samplesDesc`, en yeni ilk sirada olacak sekilde siralanmis olmalidir
 * (Prisma'nin `orderBy: { calculatedAt: 'desc' }` sonucu gibi - bkz.
 * PanelsService.getRisk).
 */
export function computeTrendEstimate(samplesDesc: RiskScoreSample[]): TrendEstimate {
  if (samplesDesc.length === 0) return insufficientData();

  const currentScore = samplesDesc[0].score;
  if (currentScore >= CRITICAL_THRESHOLD) return alreadyCritical();

  if (samplesDesc.length < TREND_MIN_SAMPLES) return insufficientData();

  const window = samplesDesc.slice(0, TREND_SAMPLE_WINDOW);
  const chronological = [...window].reverse();

  const first = chronological[0];
  const last = chronological[chronological.length - 1];
  const durationMs = last.calculatedAt.getTime() - first.calculatedAt.getTime();

  if (durationMs < TREND_MIN_OBSERVATION_MS) return insufficientData();

  const slopePerMinute = ((last.score - first.score) / durationMs) * 60_000;
  const consistency = computeConsistency(chronological, slopePerMinute);
  const quality = computeQuality(chronological.length, durationMs, consistency);
  const roundedSlope = Math.round(slopePerMinute * 10) / 10;

  if (slopePerMinute <= TREND_NOISE_SLOPE_PER_MINUTE) {
    return {
      status: TrendEstimateStatus.STABLE,
      riskSlopePerMinute: roundedSlope,
      estimatedMinutesToCritical: null,
      message: 'No critical escalation trend.',
      quality,
    };
  }

  const remaining = CRITICAL_THRESHOLD - currentScore;
  const estimatedMinutes = remaining / slopePerMinute;

  if (estimatedMinutes > TREND_MAX_DISPLAY_HORIZON_MINUTES) {
    return {
      status: TrendEstimateStatus.STABLE,
      riskSlopePerMinute: roundedSlope,
      estimatedMinutesToCritical: null,
      message: 'No near-term critical escalation.',
      quality,
    };
  }

  return {
    status: TrendEstimateStatus.RISING,
    riskSlopePerMinute: roundedSlope,
    estimatedMinutesToCritical: Math.max(1, Math.round(estimatedMinutes)),
    message: `Risk is rising at +${roundedSlope.toFixed(1)} points/min.`,
    quality,
  };
}

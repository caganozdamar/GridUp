import { getRiskLevel, RiskLevel, SensorType, type RiskComponents } from '@grid-up/shared';
import {
  ACOUSTIC_ANCHORS,
  ANOMALY_THRESHOLDS,
  ARC_FLASH_ANCHORS,
  CABLE_TEMPERATURE_ANCHORS,
  CABLE_TEMPERATURE_TREND_ANCHORS,
  CORRELATION_BONUSES,
  currentAnchors,
  currentTrendAnchors,
  DISCHARGE_FLOORS,
  HUMIDITY_ANCHORS,
  HUMIDITY_TREND_ANCHORS,
  RISK_WEIGHTS,
} from './risk-engine.config.js';
import { clamp, piecewiseLinearScore, type SensorStats } from './risk-math.util.js';

export interface RiskFlags {
  highTemperature: boolean;
  temperatureRise: boolean;
  overcurrent: boolean;
  highHumidity: boolean;
  multiSensorRisk: boolean;
  arcFlash: boolean;
  partialDischarge: boolean;
}

export interface RiskExplanationResult {
  score: number;
  level: RiskLevel;
  components: RiskComponents;
  reasons: string[];
  flags: RiskFlags;
}

/**
 * Asama 4 madde 1-7: son N reading'den turetilen sensor istatistiklerini
 * (bkz. risk-math.util#computeSensorStats) aciklanabilir, deterministik bir
 * risk skoruna cevirir. Prisma'ya bagimliligi yoktur; DB erisimi
 * risk-engine.service.ts icindedir.
 */
export function computeRiskExplanation(
  statsByType: Partial<Record<SensorType, SensorStats>>,
): RiskExplanationResult {
  const cableStats = statsByType[SensorType.CABLE_TEMPERATURE];
  const currentStats = statsByType[SensorType.CURRENT];
  const humidityStats = statsByType[SensorType.HUMIDITY];
  const arcStats = statsByType[SensorType.ARC_FLASH];
  const acousticStats = statsByType[SensorType.ACOUSTIC];

  const temperatureRisk = cableStats ? piecewiseLinearScore(cableStats.latest, CABLE_TEMPERATURE_ANCHORS) : 0;
  const currentRisk = currentStats ? piecewiseLinearScore(currentStats.latest, currentAnchors()) : 0;
  const humidityRisk = humidityStats ? piecewiseLinearScore(humidityStats.latest, HUMIDITY_ANCHORS) : 0;

  const cableTrendRisk = cableStats
    ? piecewiseLinearScore(Math.max(0, cableStats.trendPerMinute), CABLE_TEMPERATURE_TREND_ANCHORS)
    : 0;
  const currentTrendRisk = currentStats
    ? piecewiseLinearScore(Math.max(0, currentStats.trendPerMinute), currentTrendAnchors())
    : 0;
  const humidityTrendRisk = humidityStats
    ? piecewiseLinearScore(Math.max(0, humidityStats.trendPerMinute), HUMIDITY_TREND_ANCHORS)
    : 0;

  // Ark flash / akustik: anlik olaylar oldugu icin son deger degil pencere
  // ZIRVESI (maximum) degerlendirilir.
  const arcFlashRisk = arcStats ? piecewiseLinearScore(arcStats.maximum, ARC_FLASH_ANCHORS) : 0;
  const acousticRisk = acousticStats ? piecewiseLinearScore(acousticStats.maximum, ACOUSTIC_ANCHORS) : 0;

  // trendRisk: "herhangi bir sensor kritik limite hizla yaklasiyor mu?" sorusuna
  // cevap oldugu icin en hizli yukselen sensorun skoru alinir (ortalama degil).
  const trendRisk = Math.max(cableTrendRisk, currentTrendRisk, humidityTrendRisk);

  let bonus = 0;
  const reasons: string[] = [];

  const currentCableCfg = CORRELATION_BONUSES.currentAndCableTemperature;
  const currentCableTriggered =
    temperatureRisk >= currentCableCfg.minTemperatureRisk && currentRisk >= currentCableCfg.minCurrentRisk;
  if (currentCableTriggered) {
    bonus += currentCableCfg.bonus;
    reasons.push('Current and cable temperature are rising together');
  }

  const humidityCableCfg = CORRELATION_BONUSES.humidityAndCableTemperature;
  const humidityCableTriggered =
    temperatureRisk >= humidityCableCfg.minTemperatureRisk && humidityRisk >= humidityCableCfg.minHumidityRisk;
  if (humidityCableTriggered) {
    bonus += humidityCableCfg.bonus;
    reasons.push('High humidity combined with elevated cable temperature increases insulation risk');
  }

  const acousticHumidityCfg = CORRELATION_BONUSES.acousticAndHumidity;
  const acousticHumidityTriggered =
    acousticRisk >= acousticHumidityCfg.minAcousticRisk && humidityRisk >= acousticHumidityCfg.minHumidityRisk;
  if (acousticHumidityTriggered) {
    // Bonus agirlikli toplama degil akustik tabana eklenir (asagida); aksi halde
    // taban baskin oldugunda bu korelasyon skoru hic etkilemezdi.
    reasons.push('Acoustic activity in humid conditions increases partial discharge risk');
  }

  const weightedScore =
    temperatureRisk * RISK_WEIGHTS.temperature +
    currentRisk * RISK_WEIGHTS.current +
    humidityRisk * RISK_WEIGHTS.humidity +
    trendRisk * RISK_WEIGHTS.trend;

  // Ark flash / akustik taban degerleri: agirlikli toplam ne olursa olsun skor
  // en az bu kadar olur (bkz. DISCHARGE_FLOORS).
  const dischargeFloor = Math.max(
    arcFlashRisk * DISCHARGE_FLOORS.arcFlash,
    acousticRisk * DISCHARGE_FLOORS.acoustic + (acousticHumidityTriggered ? acousticHumidityCfg.bonus : 0),
  );

  const score = Math.round(clamp(Math.max(weightedScore + bonus, dischargeFloor), 0, 100));
  const level = getRiskLevel(score);

  if (temperatureRisk >= 80) reasons.unshift('Cable temperature is at a critical level');
  else if (temperatureRisk >= 55) reasons.unshift('Cable temperature is elevated and approaching critical levels');
  else if (temperatureRisk >= 30) reasons.unshift('Cable temperature is slightly elevated');

  if (cableTrendRisk >= 40) reasons.push('Cable temperature is rising rapidly');

  if (currentRisk >= 80) reasons.push('Current draw is critically high');
  else if (currentRisk >= 55) reasons.push('Overcurrent condition detected');
  else if (currentRisk >= 30) reasons.push('Current draw is elevated');
  if (currentTrendRisk >= 40) reasons.push('Current is rising rapidly');

  if (humidityRisk >= 75) reasons.push('Humidity is critically high');
  else if (humidityRisk >= 45) reasons.push('High humidity detected');
  else if (humidityRisk >= 15) reasons.push('Humidity is slightly elevated');

  if (acousticRisk >= 65) reasons.push('Strong acoustic activity: partial discharge likely');
  else if (acousticRisk >= 30) reasons.push('Abnormal acoustic activity (possible partial discharge)');

  // Ark flash en onemli neden: alarm mesajinda (reasons[0]) ilk sirada gorunur.
  if (arcFlashRisk >= 80) reasons.unshift('Arc flash detected: intense optical event inside the panel');
  else if (arcFlashRisk >= 40) reasons.unshift('Possible arc flash: optical intensity spike inside the panel');

  if (reasons.length === 0) reasons.push('All monitored sensors are within normal operating range');

  return {
    score,
    level,
    components: {
      temperature: Math.round(temperatureRisk),
      current: Math.round(currentRisk),
      humidity: Math.round(humidityRisk),
      trend: Math.round(trendRisk),
      arcFlash: Math.round(arcFlashRisk),
      acoustic: Math.round(acousticRisk),
    },
    reasons,
    flags: {
      highTemperature: temperatureRisk >= ANOMALY_THRESHOLDS.highTemperature,
      temperatureRise: cableTrendRisk >= ANOMALY_THRESHOLDS.temperatureRise,
      overcurrent: currentRisk >= ANOMALY_THRESHOLDS.overcurrent,
      highHumidity: humidityRisk >= ANOMALY_THRESHOLDS.highHumidity,
      multiSensorRisk: currentCableTriggered || humidityCableTriggered || acousticHumidityTriggered,
      arcFlash: arcFlashRisk >= ANOMALY_THRESHOLDS.arcFlash,
      partialDischarge: acousticRisk >= ANOMALY_THRESHOLDS.partialDischarge,
    },
  };
}

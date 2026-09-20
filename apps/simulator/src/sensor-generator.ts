import { SimulationScenario } from './scenario.js';
import type { PanelSensorState } from './types.js';

// Normal calisma araliklari (spec: Asama 3 madde 4).
export const AMBIENT_RANGE = { min: 24, max: 32 };
export const CABLE_RANGE = { min: 30, max: 45 };
export const HUMIDITY_RANGE = { min: 35, max: 60 };
export const CURRENT_RANGE = { min: 60, max: 110 };
// Ark flash: pano ici normal optik seviye ~0; akustik: normal ortam gurultusu.
export const ARC_FLASH_RANGE = { min: 0, max: 3 };
export const ACOUSTIC_RANGE = { min: 35, max: 45 };

// Her tick'te uygulanabilecek maksimum degisim (bounded drift / random walk adimi).
const AMBIENT_MAX_STEP = 0.3;
const CABLE_MAX_STEP = 0.5;
const HUMIDITY_MAX_STEP = 0.6;
const CURRENT_MAX_STEP = 4;
const ARC_FLASH_NOISE_STEP = 0.4;
const ACOUSTIC_NOISE_STEP = 1;

// Kablo sicakligi, akimin range icindeki oranina dogru yavasca cekilir.
const CABLE_CURRENT_PULL_FACTOR = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function boundedWalk(prev: number, min: number, max: number, maxStep: number): number {
  const step = randomInRange(-maxStep, maxStep);
  return clamp(prev + step, min, max);
}

export function randomInitialState(): PanelSensorState {
  return {
    ambientTemperature: randomInRange(AMBIENT_RANGE.min, AMBIENT_RANGE.max),
    cableTemperature: randomInRange(CABLE_RANGE.min, CABLE_RANGE.max),
    humidity: randomInRange(HUMIDITY_RANGE.min, HUMIDITY_RANGE.max),
    current: randomInRange(CURRENT_RANGE.min, CURRENT_RANGE.max),
    arcFlash: randomInRange(ARC_FLASH_RANGE.min, ARC_FLASH_RANGE.max),
    acoustic: randomInRange(ACOUSTIC_RANGE.min, ACOUSTIC_RANGE.max),
  };
}

/** Ark flash ve akustik kanallarinin sakin (arizasiz) evrimi. */
function nextQuietDischargeState(prev: PanelSensorState): Pick<PanelSensorState, 'arcFlash' | 'acoustic'> {
  return {
    arcFlash: boundedWalk(prev.arcFlash, ARC_FLASH_RANGE.min, ARC_FLASH_RANGE.max, ARC_FLASH_NOISE_STEP),
    acoustic: boundedWalk(prev.acoustic, ACOUSTIC_RANGE.min, ACOUSTIC_RANGE.max, ACOUSTIC_NOISE_STEP),
  };
}

function nextNormalState(prev: PanelSensorState): PanelSensorState {
  const current = boundedWalk(prev.current, CURRENT_RANGE.min, CURRENT_RANGE.max, CURRENT_MAX_STEP);

  // Akim yukseldikce kablo sicakligi da yukselme egiliminde olsun (mantikli korelasyon).
  const currentRatio = (current - CURRENT_RANGE.min) / (CURRENT_RANGE.max - CURRENT_RANGE.min);
  const cableTarget = CABLE_RANGE.min + currentRatio * (CABLE_RANGE.max - CABLE_RANGE.min);
  const cablePulled = prev.cableTemperature + (cableTarget - prev.cableTemperature) * CABLE_CURRENT_PULL_FACTOR;
  const cableTemperature = boundedWalk(cablePulled, CABLE_RANGE.min, CABLE_RANGE.max, CABLE_MAX_STEP);

  const ambientTemperature = boundedWalk(
    prev.ambientTemperature,
    AMBIENT_RANGE.min,
    AMBIENT_RANGE.max,
    AMBIENT_MAX_STEP,
  );

  const humidity = boundedWalk(prev.humidity, HUMIDITY_RANGE.min, HUMIDITY_RANGE.max, HUMIDITY_MAX_STEP);

  return { ambientTemperature, cableTemperature, humidity, current, ...nextQuietDischargeState(prev) };
}

// --- Failure scenarios (Asama 4 madde 10) ---
//
// Her senaryo, onceki tick'in degerinden baslayip kademeli/gerceksi bir
// gelisim gosterecek sekilde tasarlanmistir (orn. 38 -> 41 -> 45 -> 50 -> 56
// -> 63 -> 70 -> 78). Simulator burada yalnizca SENSOR VERISI uretir; risk
// karari backend anomaly engine tarafindan verilir (bkz. apps/api/src/risk-engine).

const OVERHEATING_CABLE_MIN_STEP = 2;
const OVERHEATING_CABLE_MAX_STEP = 5;
const OVERHEATING_CABLE_CEILING = 95;
const OVERHEATING_CURRENT_TARGET = 130; // hafif yukselme, tam overcurrent degil
const OVERHEATING_CURRENT_PULL_FACTOR = 0.08;

const OVERCURRENT_MIN_STEP = 8;
const OVERCURRENT_MAX_STEP = 18;
const OVERCURRENT_CEILING = 220;
const OVERCURRENT_CABLE_REFERENCE_CURRENT = 220; // cable ceiling'e ulasilan referans akim
const OVERCURRENT_CABLE_CEILING = 95;
const OVERCURRENT_CABLE_PULL_FACTOR = 0.06; // termal gecikme (lag) daha yavas

const HIGH_HUMIDITY_MIN_STEP = 3;
const HIGH_HUMIDITY_MAX_STEP = 7;
const HIGH_HUMIDITY_CEILING = 98;

/** Onceki degerden baslayip (minStep, maxStep) araliginda rastgele adimlarla ceiling'e dogru yukselir. */
function riseTowardCeiling(prev: number, minStep: number, maxStep: number, ceiling: number): number {
  if (prev >= ceiling) return ceiling;
  const step = randomInRange(minStep, maxStep);
  return Math.min(prev + step, ceiling);
}

function nextOverheatingState(prev: PanelSensorState): PanelSensorState {
  const cableTemperature = riseTowardCeiling(
    prev.cableTemperature,
    OVERHEATING_CABLE_MIN_STEP,
    OVERHEATING_CABLE_MAX_STEP,
    OVERHEATING_CABLE_CEILING,
  );

  // Ariza gelistikce akim da hafifce yukselir (mantikli korelasyon), ama tam
  // bir overcurrent olayi degil.
  const currentPulled =
    prev.current + (OVERHEATING_CURRENT_TARGET - prev.current) * OVERHEATING_CURRENT_PULL_FACTOR;
  const current = boundedWalk(currentPulled, CURRENT_RANGE.min, OVERHEATING_CURRENT_TARGET, CURRENT_MAX_STEP);

  const ambientTemperature = boundedWalk(
    prev.ambientTemperature,
    AMBIENT_RANGE.min,
    AMBIENT_RANGE.max,
    AMBIENT_MAX_STEP,
  );
  const humidity = boundedWalk(prev.humidity, HUMIDITY_RANGE.min, HUMIDITY_RANGE.max, HUMIDITY_MAX_STEP);

  return { ambientTemperature, cableTemperature, humidity, current, ...nextQuietDischargeState(prev) };
}

function nextOvercurrentState(prev: PanelSensorState): PanelSensorState {
  const current = riseTowardCeiling(prev.current, OVERCURRENT_MIN_STEP, OVERCURRENT_MAX_STEP, OVERCURRENT_CEILING);

  // Kablo sicakligi akimin gerisinden (termal atalet / gecikme ile) yukselir.
  const currentRatio = clamp(current / OVERCURRENT_CABLE_REFERENCE_CURRENT, 0, 1);
  const cableTarget = CABLE_RANGE.min + currentRatio * (OVERCURRENT_CABLE_CEILING - CABLE_RANGE.min);
  const cablePulled =
    prev.cableTemperature + (cableTarget - prev.cableTemperature) * OVERCURRENT_CABLE_PULL_FACTOR;
  const cableTemperature = clamp(cablePulled, CABLE_RANGE.min, OVERCURRENT_CABLE_CEILING);

  const ambientTemperature = boundedWalk(
    prev.ambientTemperature,
    AMBIENT_RANGE.min,
    AMBIENT_RANGE.max,
    AMBIENT_MAX_STEP,
  );
  const humidity = boundedWalk(prev.humidity, HUMIDITY_RANGE.min, HUMIDITY_RANGE.max, HUMIDITY_MAX_STEP);

  return { ambientTemperature, cableTemperature, humidity, current, ...nextQuietDischargeState(prev) };
}

function nextHighHumidityState(prev: PanelSensorState): PanelSensorState {
  const humidity = riseTowardCeiling(prev.humidity, HIGH_HUMIDITY_MIN_STEP, HIGH_HUMIDITY_MAX_STEP, HIGH_HUMIDITY_CEILING);

  const ambientTemperature = boundedWalk(
    prev.ambientTemperature,
    AMBIENT_RANGE.min,
    AMBIENT_RANGE.max,
    AMBIENT_MAX_STEP,
  );
  const cableTemperature = boundedWalk(prev.cableTemperature, CABLE_RANGE.min, CABLE_RANGE.max, CABLE_MAX_STEP);
  const current = boundedWalk(prev.current, CURRENT_RANGE.min, CURRENT_RANGE.max, CURRENT_MAX_STEP);

  return { ambientTemperature, cableTemperature, humidity, current, ...nextQuietDischargeState(prev) };
}

function nextCombinedFailureState(prev: PanelSensorState): PanelSensorState {
  // Current + cable temperature + humidity birlikte, tek senaryolara gore
  // biraz daha yavas (0.6-0.7x adim) ama es zamanli kotulesir; boylece
  // multi-sensor correlation bonuslari devreye girip en yuksek risk skorlarini
  // uretir.
  const current = riseTowardCeiling(
    prev.current,
    OVERCURRENT_MIN_STEP * 0.7,
    OVERCURRENT_MAX_STEP * 0.7,
    OVERCURRENT_CEILING,
  );

  const currentRatio = clamp(current / OVERCURRENT_CABLE_REFERENCE_CURRENT, 0, 1);
  const overcurrentCableTarget = CABLE_RANGE.min + currentRatio * (OVERCURRENT_CABLE_CEILING - CABLE_RANGE.min);
  const cablePulled =
    prev.cableTemperature + (overcurrentCableTarget - prev.cableTemperature) * OVERCURRENT_CABLE_PULL_FACTOR;
  const cableTemperature = riseTowardCeiling(
    cablePulled,
    OVERHEATING_CABLE_MIN_STEP * 0.6,
    OVERHEATING_CABLE_MAX_STEP * 0.6,
    OVERHEATING_CABLE_CEILING,
  );

  const humidity = riseTowardCeiling(
    prev.humidity,
    HIGH_HUMIDITY_MIN_STEP * 0.7,
    HIGH_HUMIDITY_MAX_STEP * 0.7,
    HIGH_HUMIDITY_CEILING,
  );

  const ambientTemperature = boundedWalk(
    prev.ambientTemperature,
    AMBIENT_RANGE.min,
    AMBIENT_RANGE.max,
    AMBIENT_MAX_STEP,
  );

  return { ambientTemperature, cableTemperature, humidity, current, ...nextQuietDischargeState(prev) };
}

// --- Ark flash senaryosu ---
//
// Diger sensorler NORMAL kalirken pano icinde ani bir isik patlamasi ve
// beraberinde yuksek bir akustik salinim (ark carpma sesi) olusur. Amac:
// ark flash'in, sicaklik/akim/nem normalken bile skoru CRITICAL'a
// cikardigini gostermek (bkz. apps/api/src/risk-engine DISCHARGE_FLOORS).
const ARC_FLASH_MIN_STEP = 15;
const ARC_FLASH_MAX_STEP = 30;
const ARC_FLASH_CEILING = 100;
const ARC_ACOUSTIC_MIN_STEP = 5;
const ARC_ACOUSTIC_MAX_STEP = 10;
const ARC_ACOUSTIC_CEILING = 95;

function nextArcFlashState(prev: PanelSensorState): PanelSensorState {
  const normal = nextNormalState(prev);

  return {
    ...normal,
    arcFlash: riseTowardCeiling(prev.arcFlash, ARC_FLASH_MIN_STEP, ARC_FLASH_MAX_STEP, ARC_FLASH_CEILING),
    acoustic: riseTowardCeiling(prev.acoustic, ARC_ACOUSTIC_MIN_STEP, ARC_ACOUSTIC_MAX_STEP, ARC_ACOUSTIC_CEILING),
  };
}

export function nextPanelState(scenario: SimulationScenario, prev: PanelSensorState): PanelSensorState {
  switch (scenario) {
    case SimulationScenario.NORMAL:
      return nextNormalState(prev);
    case SimulationScenario.OVERHEATING:
      return nextOverheatingState(prev);
    case SimulationScenario.OVERCURRENT:
      return nextOvercurrentState(prev);
    case SimulationScenario.HIGH_HUMIDITY:
      return nextHighHumidityState(prev);
    case SimulationScenario.ARC_FLASH:
      return nextArcFlashState(prev);
    case SimulationScenario.COMBINED_FAILURE:
      return nextCombinedFailureState(prev);
    default: {
      const exhaustiveCheck: never = scenario;
      throw new Error(`Unknown scenario: ${exhaustiveCheck as string}`);
    }
  }
}

import { SensorType } from '@grid-up/shared';
import type { Anchor } from './risk-math.util.js';

// Panelin gecmisinden kac reading/sensor degerlendirilecek (Asama 4 madde 1).
export const ANALYSIS_WINDOW_SIZE = 10;

// Simulator'daki NORMAL calisma araliklariyla uyumlu baseline (Asama 4 madde 2).
// Sadece referans/explainability amacli; risk skorlari asagidaki anchor
// noktalarindan hesaplanir.
export const SENSOR_BASELINES: Record<SensorType, { min: number; max: number }> = {
  [SensorType.AMBIENT_TEMPERATURE]: { min: 24, max: 32 },
  [SensorType.CABLE_TEMPERATURE]: { min: 30, max: 45 },
  [SensorType.HUMIDITY]: { min: 35, max: 60 },
  [SensorType.CURRENT]: { min: 60, max: 110 },
  [SensorType.ARC_FLASH]: { min: 0, max: 3 },
  [SensorType.ACOUSTIC]: { min: 35, max: 45 },
};

// Asama 4 madde 3 - sensor risk component'leri.
// Her anchor listesi (deger, 0-100 skor) ciftlerinden olusur ve
// piecewiseLinearScore ile kademeli/continuous bir skora cevrilir.

// Cable Temperature: <=45 dusuk, 45-55 yukselen, 55-65 ciddi, 65-75 yuksek, >75 kritik.
export const CABLE_TEMPERATURE_ANCHORS: Anchor[] = [
  [30, 0],
  [45, 20],
  [55, 50],
  [65, 75],
  [75, 92],
  [85, 100],
];

// Akim esikleri panonun ANMA AKIMINA gore olculenir. Asagidaki anchor'lar
// REFERENCE_RATED_CURRENT_A (150 A) icin amper cinsinden yazilmistir ve
// currentAnchors()/currentTrendAnchors() ile PANEL_RATED_CURRENT_A'ya oranla
// olceklenir. Yani esikler yuk yuzdesidir: ~%73'e kadar normal, %87 yukselen,
// %100 (anma akimi) yuksek, %113 ustu kritik. Ornek: 1600 kVA AG panoda ana
// bara anma akimi 2312 A (TEDAS Tablo 3a) -> PANEL_RATED_CURRENT_A=2312.
export const REFERENCE_RATED_CURRENT_A = 150;

/** PANEL_RATED_CURRENT_A (A); gecersizse referans deger. Her cagrida okunur (testler degistirebilsin). */
export function ratedCurrentA(): number {
  const value = Number(process.env.PANEL_RATED_CURRENT_A);
  return Number.isFinite(value) && value > 0 ? value : REFERENCE_RATED_CURRENT_A;
}

function scaleAnchors(anchors: Anchor[]): Anchor[] {
  const factor = ratedCurrentA() / REFERENCE_RATED_CURRENT_A;
  return anchors.map(([value, score]) => [value * factor, score]);
}

// Current (150 A referans): <=110 normal, 110-130 yukselen, 130-150 yuksek, >150 kritik.
export const CURRENT_ANCHORS: Anchor[] = [
  [60, 0],
  [110, 15],
  [130, 55],
  [150, 85],
  [170, 100],
];

// Humidity: <=60 normal, 60-70 dikkat, 70-80 yuksek, >80 kritik.
export const HUMIDITY_ANCHORS: Anchor[] = [
  [35, 0],
  [60, 15],
  [70, 45],
  [80, 75],
  [95, 100],
];

// Ark flash (optik yogunluk, %): normal pano ici ortam <=3; ani bir isik
// patlamasi hizla kritik banda cikar. Trend degil, penceredeki ZIRVE deger
// kullanilir (bkz. risk-scoring.ts) - kisa suren bir ark, sonraki okumada
// sonse bile alarm penceresi boyunca gorunur kalir.
export const ARC_FLASH_ANCHORS: Anchor[] = [
  [3, 0],
  [10, 40],
  [30, 80],
  [60, 100],
];

// Akustik / kismi desarj gostergesi (dB): normal ortam gurultusu <=45 dB;
// 55 dB uzeri desarj/carpma sesi suphesi, 70 dB uzeri belirgin desarj.
export const ACOUSTIC_ANCHORS: Anchor[] = [
  [45, 0],
  [55, 30],
  [70, 65],
  [85, 100],
];

// Asama 4 madde 4 - trend/early warning: pencere icindeki degisim hizi
// (birim/dakika) 0-100 arasi bir "aciliyet" skoruna cevrilir.
//
// Bu esikler, simulator'in gercek adim buyuklukleriyle (bkz.
// apps/simulator/src/sensor-generator.ts) 2000ms tick araliginda ampirik
// olarak olculmustur (10 reading'lik pencere ~18-30 saniyeye denk gelir, bu
// yuzden mutlak "birim/dakika" degerleri buyuk gorunse de kisa pencereden
// kaynaklanir): NORMAL senaryodaki bounded-random-walk gurultusunun ust
// sinirlarinin (current icin ~p99 58, cable icin ~p99 11-16, humidity icin
// ~p99 9-13 birim/dakika) belirgin sekilde uzerinde baslar; ariza
// senaryolarinin surdurulebilir yukselis hizlari (cable ~60-110,
// current ~170-340, humidity ~65-150 birim/dakika) ise net sekilde yuksek
// skor uretir.
export const CABLE_TEMPERATURE_TREND_ANCHORS: Anchor[] = [
  [0, 0],
  [15, 15],
  [30, 35],
  [60, 70],
  [90, 100],
];

export const CURRENT_TREND_ANCHORS: Anchor[] = [
  [0, 0],
  [80, 15],
  [120, 40],
  [180, 75],
  [260, 100],
];

export function currentAnchors(): Anchor[] {
  return scaleAnchors(CURRENT_ANCHORS);
}

/** Akim trendi (A/dk) de anma akimiyla orantili olceklenir. */
export function currentTrendAnchors(): Anchor[] {
  return scaleAnchors(CURRENT_TREND_ANCHORS);
}

export const HUMIDITY_TREND_ANCHORS: Anchor[] = [
  [0, 0],
  [12, 15],
  [25, 40],
  [50, 70],
  [75, 100],
];

// Asama 4 madde 6 - final weighted score agirliklari (toplam 1.0).
export const RISK_WEIGHTS = {
  temperature: 0.35,
  current: 0.25,
  humidity: 0.15,
  trend: 0.25,
};

// Ark flash ve akustik bileşenler agirlikli toplama GIRMEZ: ark flash guvenlik-
// kritik bir olaydir ve diger sensorler normalken bile skoru dusuk tutmamalidir.
// Bunun yerine nihai skora "taban" (floor) olurlar: skor >= risk * carpan.
// Akustik tek basina bir gurultu olabilecegi icin carpan < 1 (tek basina en
// fazla HIGH), diger kanitlarla birlikte (nem bonusu) yukselir.
export const DISCHARGE_FLOORS = {
  arcFlash: 1.0,
  acoustic: 0.7,
};

// Asama 4 madde 5 - multi-sensor correlation bonuslari.
// Iki component de kendi esiginin uzerindeyse ek risk puani eklenir.
export const CORRELATION_BONUSES = {
  currentAndCableTemperature: {
    minTemperatureRisk: 40,
    minCurrentRisk: 40,
    bonus: 10,
  },
  humidityAndCableTemperature: {
    minTemperatureRisk: 50,
    minHumidityRisk: 50,
    bonus: 8,
  },
  // Nemli havada kismi desarj olasiligi artar.
  acousticAndHumidity: {
    minAcousticRisk: 30,
    minHumidityRisk: 45,
    bonus: 8,
  },
};

// Component skorlari bu esikleri gectiginde ilgili Anomaly kaydi aktif kabul edilir.
export const ANOMALY_THRESHOLDS = {
  highTemperature: 55, // cable temperature "ciddi risk" bandinin baslangici
  temperatureRise: 40, // cable temperature trend skoru
  overcurrent: 55,
  highHumidity: 45,
  arcFlash: 40, // ~10% optik yogunluk
  partialDischarge: 30, // ~55 dB
};

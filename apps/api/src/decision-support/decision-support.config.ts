// Asama 9: decision-support / early-warning config. Buradaki degerler yeni
// UI/analiz katmani icindir; risk-engine.config.ts'deki risk score formulu,
// agirliklar veya anomaly/alarm threshold'lari BURADA degistirilmez ve
// buradan tekrar tanimlanmaz (CRITICAL threshold'u @grid-up/shared'daki
// RISK_LEVEL_THRESHOLDS'ten okunur, bkz. trend-estimate.util.ts).

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.trunc(value);
}

function parseNonNegativeNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

// ---------- Time-to-Critical guards (Asama 9 madde 2-4) ----------

// Trend hesabi icin dikkate alinacak son RiskScore kayit sayisi.
export const TREND_SAMPLE_WINDOW = parsePositiveInt(process.env.DECISION_SUPPORT_TREND_SAMPLE_WINDOW, 10);

// Estimate uretebilmek icin gereken minimum ornek sayisi.
export const TREND_MIN_SAMPLES = parsePositiveInt(process.env.DECISION_SUPPORT_TREND_MIN_SAMPLES, 3);

// Kullanilan orneklerin kapsadigi minimum sure (ms). Bundan kisa bir pencere
// "yetersiz veri" sayilir (tek bir ingestion tick'ine dayanan gurultulu bir
// egim guvenilir degildir).
export const TREND_MIN_OBSERVATION_MS = parsePositiveInt(process.env.DECISION_SUPPORT_TREND_MIN_OBSERVATION_MS, 3000);

// Bu esigin altindaki egim (risk puani/dakika) gurultu kabul edilir ve
// "STABLE" olarak raporlanir; anlamsiz "4800 dakika sonra kritik" gibi
// tahminleri engeller.
export const TREND_NOISE_SLOPE_PER_MINUTE = parseNonNegativeNumber(
  process.env.DECISION_SUPPORT_TREND_NOISE_SLOPE_PER_MINUTE,
  1,
);

// Tahmini sure bu degerin (dakika) uzerindeyse "yakin donemde kritik
// escalasyon yok" olarak gosterilir (Asama 9 madde 3 - "maximum display
// horizon").
export const TREND_MAX_DISPLAY_HORIZON_MINUTES = parsePositiveInt(
  process.env.DECISION_SUPPORT_TREND_MAX_HORIZON_MINUTES,
  60,
);

// Trend Quality = HIGH icin gereken minimum ornek sayisi / gozlem suresi (ms).
export const TREND_QUALITY_HIGH_MIN_SAMPLES = parsePositiveInt(
  process.env.DECISION_SUPPORT_TREND_QUALITY_HIGH_MIN_SAMPLES,
  6,
);
export const TREND_QUALITY_HIGH_MIN_OBSERVATION_MS = parsePositiveInt(
  process.env.DECISION_SUPPORT_TREND_QUALITY_HIGH_MIN_OBSERVATION_MS,
  12000,
);
// Ardisik ornekler arasinda skorun geriye dusmedigi oranin (0-1) HIGH icin
// gereken minimumu.
export const TREND_QUALITY_HIGH_MIN_CONSISTENCY = parseNonNegativeNumber(
  process.env.DECISION_SUPPORT_TREND_QUALITY_HIGH_MIN_CONSISTENCY,
  0.8,
);

export const TREND_QUALITY_MEDIUM_MIN_SAMPLES = parsePositiveInt(
  process.env.DECISION_SUPPORT_TREND_QUALITY_MEDIUM_MIN_SAMPLES,
  4,
);
export const TREND_QUALITY_MEDIUM_MIN_OBSERVATION_MS = parsePositiveInt(
  process.env.DECISION_SUPPORT_TREND_QUALITY_MEDIUM_MIN_OBSERVATION_MS,
  6000,
);
export const TREND_QUALITY_MEDIUM_MIN_CONSISTENCY = parseNonNegativeNumber(
  process.env.DECISION_SUPPORT_TREND_QUALITY_MEDIUM_MIN_CONSISTENCY,
  0.6,
);

// ---------- Sensor / panel data health (Asama 9 madde 11-12) ----------

// SCADA Gateway'deki SCADA_DATA_STALE_MS ile ayni semantigi/default'u
// paylasir (bkz. apps/scada-gateway/src/config.ts); ayri bir process oldugu
// icin dogrudan import edilemez, bu yuzden ayni env adi + default burada da
// kullanilir.
export const DATA_STALE_MS = parsePositiveInt(process.env.SCADA_DATA_STALE_MS, 10000);

// ---------- Panel event timeline (Asama 9 madde 15-19) ----------

export const TIMELINE_DEFAULT_LIMIT = parsePositiveInt(process.env.DECISION_SUPPORT_TIMELINE_DEFAULT_LIMIT, 30);
export const TIMELINE_MAX_LIMIT = parsePositiveInt(process.env.DECISION_SUPPORT_TIMELINE_MAX_LIMIT, 100);
// Her kaynak tablodan (RiskScore/Anomaly/Alarm/Notification) cekilecek ham
// satir sayisinin ustsiniri - "tum DB'yi memory'e cekme" kuralina uyar
// (Asama 9 madde 36).
export const TIMELINE_RAW_FETCH_CAP = parsePositiveInt(process.env.DECISION_SUPPORT_TIMELINE_RAW_FETCH_CAP, 200);

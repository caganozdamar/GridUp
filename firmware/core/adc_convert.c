#include "adc_convert.h"

#include <math.h>

#define NTC_BETA 3950.0
#define NTC_T0_KELVIN 298.15

static double clamp_counts(int adc) { return adc < 0 ? 0 : (adc > ADC_MAX_COUNTS ? ADC_MAX_COUNTS : adc); }

double adc_to_cable_celsius(int adc) {
  if (adc <= 0 || adc >= ADC_MAX_COUNTS) return NAN;
  double resistance_ratio = 1.0 / ((double)ADC_MAX_COUNTS / adc - 1.0);
  return 1.0 / (log(resistance_ratio) / NTC_BETA + 1.0 / NTC_T0_KELVIN) - 273.15;
}

double adc_to_current_amps(int adc) { return clamp_counts(adc) / ADC_MAX_COUNTS * 250.0; }

double adc_to_arc_percent(int adc) { return clamp_counts(adc) / ADC_MAX_COUNTS * 100.0; }

double acoustic_rms_counts(const int *counts, int n) {
  if (!counts || n < 2) return NAN;
  double mean = 0.0;
  for (int i = 0; i < n; i++) mean += clamp_counts(counts[i]);
  mean /= n;
  double sq = 0.0;
  for (int i = 0; i < n; i++) {
    double d = clamp_counts(counts[i]) - mean;
    sq += d * d;
  }
  return sqrt(sq / n);
}

double acoustic_db_from_rms(double rms) {
  if (isnan(rms)) return NAN;
  double full = ADC_MAX_COUNTS / 2.0;
  double frac = (rms - ACOUSTIC_IDLE_RMS) / (full - ACOUSTIC_IDLE_RMS);
  frac = frac < 0.0 ? 0.0 : (frac > 1.0 ? 1.0 : frac);
  return 40.0 + frac * 60.0;
}

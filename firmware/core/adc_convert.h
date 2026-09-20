/* Raw 12-bit ADC counts -> physical units. Pure functions so they can be unit
 * tested on a PC. These are the simulation calibrations documented in
 * wokwi/README.md; a real sensor needs field calibration. */
#ifndef GRIDUP_ADC_CONVERT_H
#define GRIDUP_ADC_CONVERT_H

#define ADC_MAX_COUNTS 4095

/* NTC divider, beta = 3950 (Wokwi NTC module). NAN at 0 or full scale, which
 * means an open or shorted sensor rather than a temperature. */
double adc_to_cable_celsius(int adc);
/* 0..250 A, linear (CT + burden resistor, simulated by a potentiometer). */
double adc_to_current_amps(int adc);
/* 0..100 % optical intensity, linear. */
double adc_to_arc_percent(int adc);
/* A microphone idles at mid-scale and swings around it, so loudness is the
 * AC amplitude (RMS deviation from the mean) of a burst of samples, not the
 * average level. The burst is a plain int array so it can be unit tested. */
double acoustic_rms_counts(const int *counts, int n);
/* RMS counts -> 40..100 dB. At or below ACOUSTIC_IDLE_RMS (sensor noise floor,
 * calibrated from the Wokwi sound sensor) reads 40 dB; a full-scale swing
 * reads 100 dB. An activity indicator, not a calibrated SPL. */
double acoustic_db_from_rms(double rms);
#define ACOUSTIC_IDLE_RMS 350.0

#endif

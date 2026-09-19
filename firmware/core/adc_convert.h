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
/* 30..100 dB, linear. An indicator of acoustic activity, not a calibrated SPL. */
double adc_to_acoustic_db(int adc);

#endif

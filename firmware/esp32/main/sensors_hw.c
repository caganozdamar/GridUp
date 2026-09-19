#include "sensors_hw.h"

#include <math.h>

#include "adc_convert.h"
#include "dht22.h"
#include "esp_adc/adc_oneshot.h"
#include "hal.h"

#define ADC_SAMPLES 8 /* averaged to smooth ADC noise */

static adc_oneshot_unit_handle_t s_adc;
static adc_channel_t s_ntc, s_current, s_arc, s_acoustic;

static adc_channel_t attach(int gpio) {
  adc_unit_t unit;
  adc_channel_t channel;
  ESP_ERROR_CHECK(adc_oneshot_io_to_channel(gpio, &unit, &channel));
  adc_oneshot_chan_cfg_t cfg = {.atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT};
  ESP_ERROR_CHECK(adc_oneshot_config_channel(s_adc, channel, &cfg));
  return channel;
}

void sensors_hw_init(void) {
  adc_oneshot_unit_init_cfg_t unit = {.unit_id = ADC_UNIT_1};
  ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit, &s_adc));
  s_ntc = attach(PIN_NTC);
  s_current = attach(PIN_CURRENT);
  s_arc = attach(PIN_ARC);
  s_acoustic = attach(PIN_ACOUSTIC);
}

/* Returns the averaged count, or -1 if the ADC read fails. */
static int read_counts(adc_channel_t channel) {
  int sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    int raw;
    if (adc_oneshot_read(s_adc, channel, &raw) != ESP_OK) return -1;
    sum += raw;
  }
  return sum / ADC_SAMPLES;
}

int sensors_hw_read(void *ctx, sensor_state_t *out) {
  (void)ctx;
  for (int k = 0; k < SENSOR_KIND_COUNT; k++) out->v[k] = NAN;

  double temperature, humidity;
  if (dht22_read(PIN_DHT22, &temperature, &humidity) == 0) {
    out->v[SENSOR_AMBIENT_TEMPERATURE] = temperature;
    out->v[SENSOR_HUMIDITY] = humidity;
  } else {
    fw_log("[sensors] DHT22 read failed");
  }

  int counts = read_counts(s_ntc);
  if (counts >= 0) out->v[SENSOR_CABLE_TEMPERATURE] = adc_to_cable_celsius(counts);
  counts = read_counts(s_current);
  if (counts >= 0) out->v[SENSOR_CURRENT] = adc_to_current_amps(counts);
  counts = read_counts(s_arc);
  if (counts >= 0) out->v[SENSOR_ARC_FLASH] = adc_to_arc_percent(counts);
  counts = read_counts(s_acoustic);
  if (counts >= 0) out->v[SENSOR_ACOUSTIC] = adc_to_acoustic_db(counts);
  return 0;
}

/* Bit-banged DHT22 (AM2302) driver. The pin is open-drain with the internal
 * pull-up: writing 0 drives the line low, writing 1 releases it so the sensor
 * can answer. Timing follows the AM2302 datasheet. */
#include "dht22.h"

#include "esp_rom_sys.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"

#define START_LOW_US 1200    /* datasheet: host holds the line low >= 1 ms */
#define RESPONSE_TIMEOUT_US 120
#define BIT_TIMEOUT_US 100
#define ONE_BIT_MIN_HIGH_US 40 /* a '0' is ~27 us high, a '1' is ~70 us */

/* Waits until the pin reads `level`; returns the microseconds waited, or -1. */
static int wait_for(gpio_num_t pin, int level, int timeout_us) {
  int64_t start = esp_timer_get_time();
  while (gpio_get_level(pin) != level) {
    if (esp_timer_get_time() - start > timeout_us) return -1;
  }
  return (int)(esp_timer_get_time() - start);
}

int dht22_read(gpio_num_t pin, double *temperature_c, double *humidity_pct) {
  static portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
  uint8_t data[5] = {0};
  int rc = 0;

  gpio_config_t cfg = {
      .pin_bit_mask = 1ULL << pin,
      .mode = GPIO_MODE_INPUT_OUTPUT_OD,
      .pull_up_en = GPIO_PULLUP_ENABLE,
  };
  gpio_config(&cfg);

  /* The bit timing is tens of microseconds: keep interrupts off for the ~5 ms transfer. */
  portENTER_CRITICAL(&lock);

  gpio_set_level(pin, 0);
  esp_rom_delay_us(START_LOW_US);
  gpio_set_level(pin, 1);
  esp_rom_delay_us(30);

  /* Sensor answers with 80 us low + 80 us high, then 40 bits (50 us low + variable high). */
  if (wait_for(pin, 0, RESPONSE_TIMEOUT_US) < 0 || wait_for(pin, 1, RESPONSE_TIMEOUT_US) < 0 ||
      wait_for(pin, 0, RESPONSE_TIMEOUT_US) < 0) {
    rc = -1;
  }

  for (int bit = 0; rc == 0 && bit < 40; bit++) {
    if (wait_for(pin, 1, BIT_TIMEOUT_US) < 0) { rc = -2; break; }
    int high_us = wait_for(pin, 0, BIT_TIMEOUT_US);
    if (high_us < 0) { rc = -3; break; }
    data[bit / 8] <<= 1;
    if (high_us > ONE_BIT_MIN_HIGH_US) data[bit / 8] |= 1;
  }

  portEXIT_CRITICAL(&lock);

  if (rc != 0) return rc;
  if (((data[0] + data[1] + data[2] + data[3]) & 0xFF) != data[4]) return -4;

  *humidity_pct = ((data[0] << 8) | data[1]) / 10.0;
  double t = (((data[2] & 0x7F) << 8) | data[3]) / 10.0;
  *temperature_c = (data[2] & 0x80) ? -t : t;
  return 0;
}

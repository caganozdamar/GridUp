/* GRID UP field module for ESP32. The core (../../core) does the work; this
 * file wires it to the board: sensors, LEDs, the scenario button and Wi-Fi. */
#include <stdio.h>

#include "driver/gpio.h"
#include "esp_timer.h"
#include "hal.h"
#include "hal_esp32.h"
#include "module.h"
#include "nvs_flash.h"
#include "sdkconfig.h"
#include "sensors.h"
#include "sensors_hw.h"

#define PIN_LED_STATUS 26
#define PIN_LED_ALARM 27
#define PIN_BUTTON 25
#define DEBOUNCE_US 250000

/* Mode 0 reads the real inputs. Modes 1.. replay a synthetic scenario for
 * demos (the button steps through them and wraps back to the hardware). The
 * mode is logged on every change so it is always clear which one is active. */
#define SCENARIO_MODES 6 /* NORMAL .. COMBINED_FAILURE */
#define MODE_COUNT (1 + SCENARIO_MODES)

typedef struct {
  int mode;
  synthetic_source_t synthetic;
} app_t;

static volatile int s_button_pressed;
static volatile int64_t s_last_press_us;

static void IRAM_ATTR on_button(void *arg) {
  (void)arg;
  int64_t now = esp_timer_get_time();
  if (now - s_last_press_us > DEBOUNCE_US) {
    s_last_press_us = now;
    s_button_pressed = 1;
  }
}

static void select_mode(app_t *app, int mode) {
  app->mode = mode;
  if (mode == 0) {
    fw_log("[mode] HARDWARE: reading the real sensors");
  } else {
    synthetic_source_init(&app->synthetic, (scenario_t)(mode - 1));
    fw_log("[mode] DEMO: synthetic scenario %s (not real sensor data)", scenario_name((scenario_t)(mode - 1)));
  }
}

static int app_read(void *ctx, sensor_state_t *out) {
  app_t *app = ctx;
  if (s_button_pressed) {
    s_button_pressed = 0;
    select_mode(app, (app->mode + 1) % MODE_COUNT);
  }
  return app->mode == 0 ? sensors_hw_read(NULL, out) : synthetic_source_read(&app->synthetic, out);
}

static void on_tick(void *ctx, const sensor_state_t *state, int link_ok) {
  (void)ctx;
  gpio_set_level(PIN_LED_STATUS, link_ok);
  gpio_set_level(PIN_LED_ALARM, sensors_in_critical_band(state));
}

static void init_gpio(void) {
  gpio_config_t leds = {
      .pin_bit_mask = (1ULL << PIN_LED_STATUS) | (1ULL << PIN_LED_ALARM),
      .mode = GPIO_MODE_OUTPUT,
  };
  gpio_config(&leds);

  gpio_config_t button = {
      .pin_bit_mask = 1ULL << PIN_BUTTON,
      .mode = GPIO_MODE_INPUT,
      .pull_up_en = GPIO_PULLUP_ENABLE,
      .intr_type = GPIO_INTR_NEGEDGE,
  };
  gpio_config(&button);
  gpio_install_isr_service(0);
  gpio_isr_handler_add(PIN_BUTTON, on_button, NULL);
}

void app_main(void) {
  esp_err_t err = nvs_flash_init(); /* Wi-Fi stores its calibration in NVS */
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  ESP_ERROR_CHECK(err);

  init_gpio();
  sensors_hw_init();
  hal_esp32_wifi_start();

  static app_t app;
  select_mode(&app, 0);

  module_config_t cfg = {
      .api_base = CONFIG_GRIDUP_API_BASE_URL,
      .panel_code = CONFIG_GRIDUP_PANEL_CODE,
      .interval_ms = CONFIG_GRIDUP_SAMPLE_INTERVAL_MS,
      .max_ticks = 0,
      .read = app_read,
      .read_ctx = &app,
      .on_tick = on_tick,
  };
  module_run(&cfg);
}

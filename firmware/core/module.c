#include "module.h"

#include <stdio.h>

#include "buffer.h"
#include "hal.h"
#include "payload.h"
#include "provision.h"

#define PROVISION_ATTEMPTS 10
#define PROVISION_RETRY_MS 3000
#define BATCH_BODY_SIZE 65536

static int provision_with_retry(const module_config_t *cfg, sensor_map_t *map) {
  for (int attempt = 1; attempt <= PROVISION_ATTEMPTS; attempt++) {
    if (provision_discover(cfg->api_base, cfg->panel_code, map) == 0) return 0;
    hal_log("[module] provisioning attempt %d/%d failed, retrying", attempt, PROVISION_ATTEMPTS);
    hal_sleep_ms(PROVISION_RETRY_MS);
  }
  return -1;
}

/* Sends everything buffered. Transport errors and 5xx keep the data for the
 * next tick; a 4xx means the batch itself is bad, so it is dropped rather
 * than retried forever. */
static void flush(tick_buffer_t *buf, const sensor_map_t *map, const module_config_t *cfg) {
  static char body[BATCH_BODY_SIZE];
  char url[256], resp[512];
  int status = 0;

  int readings = payload_build_batch(buf, map, body, sizeof body);
  if (readings < 0) {
    hal_log("[module] payload too large, dropping %zu ticks", buf->count);
    buffer_clear(buf);
    return;
  }

  snprintf(url, sizeof url, "%s/readings/batch", cfg->api_base);
  if (hal_http_post_json(url, body, resp, sizeof resp, &status) != 0 || status >= 500) {
    hal_log("[module] send failed (status %d), %zu ticks buffered", status, buf->count);
    return;
  }
  if (status >= 400) {
    hal_log("[module] server rejected batch (HTTP %d): %s", status, resp);
    buffer_clear(buf);
    return;
  }
  buffer_clear(buf);
}

int module_run(const module_config_t *cfg) {
  sensor_map_t map;
  static tick_buffer_t buf;
  sensor_state_t state;

  hal_log("[module] panel=%s scenario=%s api=%s", cfg->panel_code, scenario_name(cfg->scenario), cfg->api_base);
  if (provision_with_retry(cfg, &map) != 0) return 1;

  int active = 0;
  for (int k = 0; k < SENSOR_KIND_COUNT; k++) active += map.present[k];
  hal_log("[module] provisioned %d sensors", active);

  buffer_init(&buf);
  sensor_state_init(&state);

  for (unsigned tick = 1; cfg->max_ticks == 0 || tick <= cfg->max_ticks; tick++) {
    char ts[32];
    sensor_state_step(&state, cfg->scenario);
    hal_iso_now(ts, sizeof ts);
    buffer_push(&buf, ts, &state);

    hal_log("[tick %u] amb=%.1fC cable=%.1fC hum=%.1f%% cur=%.1fA arc=%.1f%% ac=%.1fdB buffered=%zu",
            tick, state.v[SENSOR_AMBIENT_TEMPERATURE], state.v[SENSOR_CABLE_TEMPERATURE],
            state.v[SENSOR_HUMIDITY], state.v[SENSOR_CURRENT], state.v[SENSOR_ARC_FLASH],
            state.v[SENSOR_ACOUSTIC], buf.count);

    flush(&buf, &map, cfg);
    if (cfg->max_ticks == 0 || tick < cfg->max_ticks) hal_sleep_ms(cfg->interval_ms);
  }
  return 0;
}

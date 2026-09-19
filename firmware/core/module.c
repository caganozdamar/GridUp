#include "module.h"

#include <stdio.h>
#include <stdlib.h>

#include "buffer.h"
#include "hal.h"
#include "payload.h"
#include "provision.h"

/* While unprovisioned, retry discovery every N ticks. Each attempt can block
 * for the HTTP timeout, so this keeps a dead server from stalling sampling. */
#define PROVISION_RETRY_TICKS 5

/* Worst case per reading: {"sensorId":"<36>","value":-123456.78,"timestamp":"<24>"} plus comma. */
#define BYTES_PER_READING 128
#define BATCH_BODY_SIZE ((size_t)BUFFER_CAPACITY * SENSOR_KIND_COUNT * BYTES_PER_READING + 64)

/* Sends everything buffered. Returns 1 if the server accepted it. Transport
 * errors and 5xx keep the data for the next tick; a 4xx means the batch itself
 * is bad, so it is dropped rather than retried forever. */
static int flush(tick_buffer_t *buf, const sensor_map_t *map, const module_config_t *cfg, char *body) {
  char url[256], resp[512];
  int status = 0;

  int readings = payload_build_batch(buf, map, body, BATCH_BODY_SIZE);
  if (readings < 0) {
    fw_log("[module] payload too large, dropping %zu ticks", buf->count);
    buffer_clear(buf);
    return 0;
  }
  if (readings == 0) {
    buffer_clear(buf);
    return 1;
  }

  snprintf(url, sizeof url, "%s/readings/batch", cfg->api_base);
  if (fw_http_post_json(url, body, resp, sizeof resp, &status) != 0 || status >= 500) {
    fw_log("[module] send failed (status %d), %zu ticks buffered", status, buf->count);
    return 0;
  }
  if (status >= 400) {
    fw_log("[module] server rejected batch (HTTP %d): %s", status, resp);
    buffer_clear(buf);
    return 0;
  }
  buffer_clear(buf);
  return 1;
}

int module_run(const module_config_t *cfg) {
  static tick_buffer_t buf;
  sensor_map_t map;
  sensor_state_t state;
  int provisioned = 0;
  unsigned next_provision_tick = 1;

  char *body = malloc(BATCH_BODY_SIZE);
  if (!body) {
    fw_log("[module] out of memory for the send buffer");
    return 1;
  }

  fw_log("[module] panel=%s api=%s", cfg->panel_code, cfg->api_base);
  buffer_init(&buf);

  for (unsigned tick = 1; cfg->max_ticks == 0 || tick <= cfg->max_ticks; tick++) {
    if (cfg->read(cfg->read_ctx, &state) != 0) {
      fw_log("[tick %u] sensor read failed, skipping", tick);
    } else {
      char ts[32];
      fw_iso_now(ts, sizeof ts);
      buffer_push(&buf, ts, &state);

      fw_log("[tick %u] amb=%.1fC cable=%.1fC hum=%.1f%% cur=%.1fA arc=%.1f%% ac=%.1fdB buffered=%zu",
              tick, state.v[SENSOR_AMBIENT_TEMPERATURE], state.v[SENSOR_CABLE_TEMPERATURE],
              state.v[SENSOR_HUMIDITY], state.v[SENSOR_CURRENT], state.v[SENSOR_ARC_FLASH],
              state.v[SENSOR_ACOUSTIC], buf.count);

      int link_ok = 0;
      if (!provisioned && tick >= next_provision_tick) {
        if (provision_discover(cfg->api_base, cfg->panel_code, &map) == 0) {
          provisioned = 1;
          int sensors = 0;
          for (int k = 0; k < SENSOR_KIND_COUNT; k++) sensors += map.present[k];
          fw_log("[module] provisioned %d sensors", sensors);
        } else {
          next_provision_tick = tick + PROVISION_RETRY_TICKS;
          fw_log("[module] not provisioned, buffering (%zu ticks)", buf.count);
        }
      }
      if (provisioned) link_ok = flush(&buf, &map, cfg, body);

      if (cfg->on_tick) cfg->on_tick(cfg->on_tick_ctx, &state, link_ok);
    }

    if (cfg->max_ticks == 0 || tick < cfg->max_ticks) fw_sleep_ms(cfg->interval_ms);
  }

  free(body);
  return 0;
}

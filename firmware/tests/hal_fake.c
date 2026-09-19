#include "hal_fake.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../core/hal.h"

hal_fake_t hal_fake;

static const char *PANELS =
    "[{\"id\":\"p-1\",\"code\":\"PANO-001\",\"site\":{\"id\":\"s-1\"}},"
    "{\"id\":\"p-3\",\"code\":\"PANO-003\",\"site\":{\"id\":\"s-1\"}}]";

static const char *SENSORS =
    "[{\"id\":\"s0\",\"type\":\"AMBIENT_TEMPERATURE\",\"isActive\":true},"
    "{\"id\":\"s1\",\"type\":\"CABLE_TEMPERATURE\",\"isActive\":true},"
    "{\"id\":\"s2\",\"type\":\"HUMIDITY\",\"isActive\":true},"
    "{\"id\":\"s3\",\"type\":\"CURRENT\",\"isActive\":true},"
    "{\"id\":\"s4\",\"type\":\"ARC_FLASH\",\"isActive\":true},"
    "{\"id\":\"s5\",\"type\":\"ACOUSTIC\",\"isActive\":true}]";

void hal_fake_reset(void) {
  memset(&hal_fake, 0, sizeof hal_fake);
  hal_fake.post_status = 201;
  hal_fake.clock_synced = 1;
}

int hal_fake_last_post_readings(void) {
  int n = 0;
  for (const char *p = hal_fake.last_post_body; (p = strstr(p, "\"sensorId\"")); p++) n++;
  return n;
}

int fw_http_get(const char *url, char *out, size_t out_size, int *status) {
  hal_fake.get_calls++;
  if (hal_fake.get_transport_fail) { *status = 0; return -1; }
  const char *body = strstr(url, "/sensors") ? SENSORS : PANELS;
  snprintf(out, out_size, "%s", body);
  *status = 200;
  return 0;
}

int fw_http_post_json(const char *url, const char *body, char *out, size_t out_size, int *status) {
  (void)url;
  hal_fake.post_calls++;
  snprintf(hal_fake.last_post_body, sizeof hal_fake.last_post_body, "%s", body);
  if (out_size) out[0] = '\0';
  if (hal_fake.post_transport_fail) { *status = 0; return -1; }
  *status = hal_fake.post_status;
  return 0;
}

void fw_iso_now(char *out, size_t out_size) {
  snprintf(out, out_size, "%s", hal_fake.clock_synced ? "2026-01-01T00:00:00.000Z" : "");
}
void fw_sleep_ms(unsigned ms) { (void)ms; hal_fake.sleeps++; }
void fw_log(const char *fmt, ...) { (void)fmt; }
double fw_random(void) { return rand() / ((double)RAND_MAX + 1.0); }

#include "payload.h"

#include <math.h>
#include <stdio.h>

int payload_build_batch(const tick_buffer_t *b, const sensor_map_t *map, char *out, size_t out_size) {
  size_t used = 0;
  int readings = 0;
  int n = snprintf(out, out_size, "{\"readings\":[");
  if (n < 0 || (size_t)n >= out_size) return -1;
  used = (size_t)n;

  for (size_t i = 0; i < b->count; i++) {
    const tick_t *t = buffer_at(b, i);
    for (int k = 0; k < SENSOR_KIND_COUNT; k++) {
      if (!map->present[k] || !isfinite(t->state.v[k])) continue;
      if (t->timestamp[0] != '\0') {
        n = snprintf(out + used, out_size - used,
                     "%s{\"sensorId\":\"%s\",\"value\":%.2f,\"timestamp\":\"%s\"}",
                     readings ? "," : "", map->sensor_id[k], t->state.v[k], t->timestamp);
      } else {
        /* Clock not synced yet: leave the timestamp out, the server stamps it. */
        n = snprintf(out + used, out_size - used, "%s{\"sensorId\":\"%s\",\"value\":%.2f}",
                     readings ? "," : "", map->sensor_id[k], t->state.v[k]);
      }
      if (n < 0 || used + (size_t)n >= out_size) return -1;
      used += (size_t)n;
      readings++;
    }
  }

  n = snprintf(out + used, out_size - used, "]}");
  if (n < 0 || used + (size_t)n >= out_size) return -1;
  return readings;
}

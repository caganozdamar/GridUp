/* Field module main loop, independent of the platform. */
#ifndef GRIDUP_MODULE_H
#define GRIDUP_MODULE_H

#include "sensors.h"

/* Called once per tick after the send attempt. link_ok is 1 if the server
 * accepted the last batch (or there was nothing to send), 0 if the module is
 * offline or unprovisioned. Use it to drive the status/alarm LEDs. */
typedef void (*module_tick_fn)(void *ctx, const sensor_state_t *state, int link_ok);

typedef struct {
  const char *api_base;   /* e.g. http://localhost:3000 */
  const char *panel_code; /* e.g. PANO-003 */
  unsigned interval_ms;
  unsigned max_ticks;     /* 0 = run forever */
  sensor_read_fn read;    /* where each tick's values come from */
  void *read_ctx;
  module_tick_fn on_tick; /* optional */
  void *on_tick_ctx;
} module_config_t;

/* Reads sensors every tick, buffers them and sends them once provisioned. The
 * server does not need to be reachable at start: until provisioning succeeds
 * (retried every few ticks) the module keeps reading and buffering. Returns
 * after max_ticks; with max_ticks == 0 it never returns. */
int module_run(const module_config_t *cfg);

#endif

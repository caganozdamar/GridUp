/* Field module main loop, independent of the platform. */
#ifndef GRIDUP_MODULE_H
#define GRIDUP_MODULE_H

#include "sensors.h"

typedef struct {
  const char *api_base;   /* e.g. http://localhost:3000 */
  const char *panel_code; /* e.g. PANO-003 */
  scenario_t scenario;
  unsigned interval_ms;
  unsigned max_ticks;     /* 0 = run forever */
} module_config_t;

/* Runs discovery (with retry) then the read/buffer/send loop. Returns 0 when
 * max_ticks completes, non-zero if provisioning never succeeds. */
int module_run(const module_config_t *cfg);

#endif

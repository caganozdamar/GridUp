/* Provisioning: turns "I am PANO-003, I have these sensor kinds" into the
 * database sensorId UUIDs that POST /readings/batch requires. This is the
 * firmware version of apps/simulator's discovery step. */
#ifndef GRIDUP_PROVISION_H
#define GRIDUP_PROVISION_H

#include <stddef.h>

#include "sensors.h"

#define SENSOR_ID_LEN 64

typedef struct {
  int present[SENSOR_KIND_COUNT];               /* 1 if backend knows this kind */
  char sensor_id[SENSOR_KIND_COUNT][SENSOR_ID_LEN];
} sensor_map_t;

/* Parses a GET /panels response and returns the id of panel_code (1 = found). */
int provision_find_panel(const char *panels_json, const char *panel_code, char *id_out, size_t id_size);

/* Parses a GET /panels/:id/sensors response into map. Sensor kinds the
 * firmware does not know, or inactive sensors, are skipped. Returns the
 * number of usable sensors. */
int provision_parse_sensors(const char *sensors_json, sensor_map_t *map);

/* Full discovery over HTTP. Returns 0 on success. */
int provision_discover(const char *api_base, const char *panel_code, sensor_map_t *map);

#endif

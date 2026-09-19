#include "provision.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "hal.h"
#include "json_lite.h"

/* Sized for ~100 panels (GET /panels is ~560 bytes per panel). Allocated only
 * while provisioning, so it never sits in RAM during normal operation. */
#define HTTP_BUF 65536

int provision_find_panel(const char *panels_json, const char *panel_code, char *id_out, size_t id_size) {
  size_t pos = 0, len;
  const char *obj;
  while (json_next_object(panels_json, &pos, &obj, &len)) {
    char code[64];
    if (json_get_string(obj, len, "code", code, sizeof code) && strcmp(code, panel_code) == 0) {
      return json_get_string(obj, len, "id", id_out, id_size);
    }
  }
  return 0;
}

int provision_parse_sensors(const char *sensors_json, sensor_map_t *map) {
  memset(map, 0, sizeof *map);
  int count = 0;
  size_t pos = 0, len;
  const char *obj;
  while (json_next_object(sensors_json, &pos, &obj, &len)) {
    char type[48];
    int active = 1;
    sensor_kind_t kind;
    json_get_bool(obj, len, "isActive", &active);
    if (!active) continue;
    if (!json_get_string(obj, len, "type", type, sizeof type)) continue;
    if (!sensor_kind_from_name(type, &kind)) continue;
    if (!json_get_string(obj, len, "id", map->sensor_id[kind], SENSOR_ID_LEN)) continue;
    map->present[kind] = 1;
    count++;
  }
  return count;
}

int provision_discover(const char *api_base, const char *panel_code, sensor_map_t *map) {
  char url[256], panel_id[SENSOR_ID_LEN];
  int status = 0;
  int rc = 0;
  char *body = malloc(HTTP_BUF);
  if (!body) {
    fw_log("[provision] out of memory");
    return -4;
  }

  snprintf(url, sizeof url, "%s/panels", api_base);
  if (fw_http_get(url, body, HTTP_BUF, &status) != 0 || status != 200) {
    fw_log("[provision] GET /panels failed (status %d)", status);
    rc = -1;
    goto done;
  }
  if (!provision_find_panel(body, panel_code, panel_id, sizeof panel_id)) {
    fw_log("[provision] panel %s not found on the server", panel_code);
    rc = -2;
    goto done;
  }

  snprintf(url, sizeof url, "%s/panels/%s/sensors", api_base, panel_id);
  if (fw_http_get(url, body, HTTP_BUF, &status) != 0 || status != 200) {
    fw_log("[provision] GET sensors failed (status %d)", status);
    rc = -1;
    goto done;
  }
  if (provision_parse_sensors(body, map) == 0) {
    fw_log("[provision] panel %s has no usable sensors", panel_code);
    rc = -3;
  }

done:
  free(body);
  return rc;
}

#include "provision.h"

#include <stdio.h>
#include <string.h>

#include "hal.h"
#include "json_lite.h"

#define HTTP_BUF 32768

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
  static char body[HTTP_BUF];
  char url[256], panel_id[SENSOR_ID_LEN];
  int status = 0;

  snprintf(url, sizeof url, "%s/panels", api_base);
  if (hal_http_get(url, body, sizeof body, &status) != 0 || status != 200) {
    hal_log("[provision] GET /panels failed (status %d)", status);
    return -1;
  }
  if (!provision_find_panel(body, panel_code, panel_id, sizeof panel_id)) {
    hal_log("[provision] panel %s not found on the server", panel_code);
    return -2;
  }

  snprintf(url, sizeof url, "%s/panels/%s/sensors", api_base, panel_id);
  if (hal_http_get(url, body, sizeof body, &status) != 0 || status != 200) {
    hal_log("[provision] GET sensors failed (status %d)", status);
    return -1;
  }
  int n = provision_parse_sensors(body, map);
  if (n == 0) {
    hal_log("[provision] panel %s has no usable sensors", panel_code);
    return -3;
  }
  return 0;
}

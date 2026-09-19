/* Sensor model + failure scenarios. Same behaviour as apps/simulator, plus the
 * two channels the backend does not model yet (arc flash, acoustic/PD). */
#ifndef GRIDUP_SENSORS_H
#define GRIDUP_SENSORS_H

typedef enum {
  SENSOR_AMBIENT_TEMPERATURE = 0,
  SENSOR_CABLE_TEMPERATURE,
  SENSOR_HUMIDITY,
  SENSOR_CURRENT,
  SENSOR_ARC_FLASH,
  SENSOR_ACOUSTIC,
  SENSOR_KIND_COUNT
} sensor_kind_t;

typedef enum {
  SCENARIO_NORMAL = 0,
  SCENARIO_OVERHEATING,
  SCENARIO_OVERCURRENT,
  SCENARIO_HIGH_HUMIDITY,
  SCENARIO_ARC_FLASH,
  SCENARIO_COMBINED_FAILURE
} scenario_t;

/* One value per sensor_kind_t. Units: degC, degC, %, A, % optical, dB. */
typedef struct {
  double v[SENSOR_KIND_COUNT];
} sensor_state_t;

/* Backend enum name for a kind, e.g. "CABLE_TEMPERATURE". */
const char *sensor_kind_name(sensor_kind_t kind);
/* Reverse lookup; returns 1 and sets *kind if the name is known. */
int sensor_kind_from_name(const char *name, sensor_kind_t *kind);

const char *scenario_name(scenario_t s);
int scenario_from_name(const char *name, scenario_t *s);

void sensor_state_init(sensor_state_t *st);
/* Advances the state by one tick of the given scenario. */
void sensor_state_step(sensor_state_t *st, scenario_t scenario);

#endif

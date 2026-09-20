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

/* A sensor source fills one full state per tick. The synthetic source below
 * drives it from a scenario; a hardware source reads ADC/DHT22. A channel that
 * cannot be read is set to NAN and is then left out of the batch. Returns 0 on
 * success, non-zero if the whole tick should be skipped. */
typedef int (*sensor_read_fn)(void *ctx, sensor_state_t *out);

typedef struct {
  sensor_state_t state;
  scenario_t scenario;
  int initialized;
} synthetic_source_t;

void synthetic_source_init(synthetic_source_t *src, scenario_t scenario);
/* sensor_read_fn for synthetic_source_t: advances the scenario one tick. */
int synthetic_source_read(void *ctx, sensor_state_t *out);

/* Local "critical band" check used for the module's alarm LED. Independent of
 * the backend's risk score: it only tells a technician standing at the panel
 * that some channel is in its critical band. NAN channels are ignored. */
int sensors_in_critical_band(const sensor_state_t *st);

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

#include "sensors.h"

#include <math.h>
#include <string.h>

#include "hal.h"

/* Normal operating ranges (match apps/simulator/src/sensor-generator.ts). */
#define AMBIENT_MIN 24.0
#define AMBIENT_MAX 32.0
#define CABLE_MIN 30.0
#define CABLE_MAX 45.0
#define HUMIDITY_MIN 35.0
#define HUMIDITY_MAX 60.0
#define CURRENT_MIN 60.0
#define CURRENT_MAX 110.0
#define ARC_NORMAL_MAX 3.0
#define ACOUSTIC_MIN 35.0
#define ACOUSTIC_MAX 45.0

#define CABLE_CURRENT_PULL 0.15

static const char *KIND_NAMES[SENSOR_KIND_COUNT] = {
    "AMBIENT_TEMPERATURE", "CABLE_TEMPERATURE", "HUMIDITY", "CURRENT", "ARC_FLASH", "ACOUSTIC",
};

static const char *SCENARIO_NAMES[] = {
    "NORMAL", "OVERHEATING", "OVERCURRENT", "HIGH_HUMIDITY", "ARC_FLASH", "COMBINED_FAILURE",
};

const char *sensor_kind_name(sensor_kind_t kind) { return KIND_NAMES[kind]; }

int sensor_kind_from_name(const char *name, sensor_kind_t *kind) {
  for (int i = 0; i < SENSOR_KIND_COUNT; i++) {
    if (strcmp(name, KIND_NAMES[i]) == 0) { *kind = (sensor_kind_t)i; return 1; }
  }
  return 0;
}

const char *scenario_name(scenario_t s) { return SCENARIO_NAMES[s]; }

int scenario_from_name(const char *name, scenario_t *s) {
  for (size_t i = 0; i < sizeof SCENARIO_NAMES / sizeof *SCENARIO_NAMES; i++) {
    if (strcmp(name, SCENARIO_NAMES[i]) == 0) { *s = (scenario_t)i; return 1; }
  }
  return 0;
}

static double clamp(double x, double lo, double hi) { return x < lo ? lo : (x > hi ? hi : x); }
static double rand_range(double lo, double hi) { return lo + fw_random() * (hi - lo); }

/* Bounded random walk: small noise step, clamped to the normal range. */
static double walk(double prev, double lo, double hi, double max_step) {
  return clamp(prev + rand_range(-max_step, max_step), lo, hi);
}

/* Climb toward a ceiling by a random step in [min_step, max_step]. */
static double rise(double prev, double min_step, double max_step, double ceiling) {
  if (prev >= ceiling) return ceiling;
  double next = prev + rand_range(min_step, max_step);
  return next > ceiling ? ceiling : next;
}

void sensor_state_init(sensor_state_t *st) {
  st->v[SENSOR_AMBIENT_TEMPERATURE] = rand_range(AMBIENT_MIN, AMBIENT_MAX);
  st->v[SENSOR_CABLE_TEMPERATURE] = rand_range(CABLE_MIN, CABLE_MAX);
  st->v[SENSOR_HUMIDITY] = rand_range(HUMIDITY_MIN, HUMIDITY_MAX);
  st->v[SENSOR_CURRENT] = rand_range(CURRENT_MIN, CURRENT_MAX);
  st->v[SENSOR_ARC_FLASH] = rand_range(0.0, ARC_NORMAL_MAX);
  st->v[SENSOR_ACOUSTIC] = rand_range(ACOUSTIC_MIN, ACOUSTIC_MAX);
}

/* Fault flags for one tick. COMBINED_FAILURE turns on several at once. */
typedef struct { int overheat, overcurrent, humidity, arc; } faults_t;

static faults_t faults_for(scenario_t s) {
  faults_t f = {0, 0, 0, 0};
  switch (s) {
    case SCENARIO_OVERHEATING: f.overheat = 1; break;
    case SCENARIO_OVERCURRENT: f.overcurrent = 1; break;
    case SCENARIO_HIGH_HUMIDITY: f.humidity = 1; break;
    case SCENARIO_ARC_FLASH: f.arc = 1; break;
    case SCENARIO_COMBINED_FAILURE: f.overheat = f.overcurrent = f.humidity = 1; break;
    default: break;
  }
  return f;
}

void synthetic_source_init(synthetic_source_t *src, scenario_t scenario) {
  src->scenario = scenario;
  src->initialized = 0;
}

int synthetic_source_read(void *ctx, sensor_state_t *out) {
  synthetic_source_t *src = ctx;
  if (!src->initialized) {
    sensor_state_init(&src->state);
    src->initialized = 1;
  }
  sensor_state_step(&src->state, src->scenario);
  *out = src->state;
  return 0;
}

/* Critical bands mirror the top of the backend's anchor tables
 * (apps/api/src/risk-engine/risk-engine.config.ts). */
int sensors_in_critical_band(const sensor_state_t *st) {
  static const double LIMIT[SENSOR_KIND_COUNT] = {
      1e9, /* ambient temperature: not a fault source */
      75,  /* cable temperature, degC */
      80,  /* humidity, % */
      150, /* current, A */
      30,  /* arc flash, % optical */
      70,  /* acoustic, dB */
  };
  for (int k = 0; k < SENSOR_KIND_COUNT; k++) {
    if (isfinite(st->v[k]) && st->v[k] >= LIMIT[k]) return 1;
  }
  return 0;
}

void sensor_state_step(sensor_state_t *st, scenario_t scenario) {
  faults_t f = faults_for(scenario);
  double *v = st->v;

  /* Ambient temperature is never the fault source. */
  v[SENSOR_AMBIENT_TEMPERATURE] = walk(v[SENSOR_AMBIENT_TEMPERATURE], AMBIENT_MIN, AMBIENT_MAX, 0.3);

  /* Current: noise normally; ramps to 220 A on overcurrent, ~130 A when a
   * hot cable drags load up slightly. */
  if (f.overcurrent) {
    v[SENSOR_CURRENT] = rise(v[SENSOR_CURRENT], 8, 18, 220);
  } else if (f.overheat) {
    double pulled = v[SENSOR_CURRENT] + (130.0 - v[SENSOR_CURRENT]) * 0.08;
    v[SENSOR_CURRENT] = walk(pulled, CURRENT_MIN, 130.0, 4);
  } else {
    v[SENSOR_CURRENT] = walk(v[SENSOR_CURRENT], CURRENT_MIN, CURRENT_MAX, 4);
  }

  /* Cable temperature: direct rise on overheating, thermally lagged behind
   * current on overcurrent, otherwise gently pulled toward load. */
  if (f.overheat) {
    v[SENSOR_CABLE_TEMPERATURE] = rise(v[SENSOR_CABLE_TEMPERATURE], 2, 5, 95);
  } else if (f.overcurrent) {
    double ratio = clamp(v[SENSOR_CURRENT] / 220.0, 0, 1);
    double target = CABLE_MIN + ratio * (95.0 - CABLE_MIN);
    double next = v[SENSOR_CABLE_TEMPERATURE] + (target - v[SENSOR_CABLE_TEMPERATURE]) * 0.06;
    v[SENSOR_CABLE_TEMPERATURE] = clamp(next, CABLE_MIN, 95.0);
  } else {
    double ratio = (v[SENSOR_CURRENT] - CURRENT_MIN) / (CURRENT_MAX - CURRENT_MIN);
    double target = CABLE_MIN + ratio * (CABLE_MAX - CABLE_MIN);
    double pulled = v[SENSOR_CABLE_TEMPERATURE] + (target - v[SENSOR_CABLE_TEMPERATURE]) * CABLE_CURRENT_PULL;
    v[SENSOR_CABLE_TEMPERATURE] = walk(pulled, CABLE_MIN, CABLE_MAX, 0.5);
  }

  if (f.humidity) v[SENSOR_HUMIDITY] = rise(v[SENSOR_HUMIDITY], 3, 7, 98);
  else v[SENSOR_HUMIDITY] = walk(v[SENSOR_HUMIDITY], HUMIDITY_MIN, HUMIDITY_MAX, 0.6);

  /* Arc flash: near-zero optical level; a flash is a sudden large jump with
   * a loud acoustic burst (arc/partial-discharge crackle). */
  if (f.arc) {
    v[SENSOR_ARC_FLASH] = rise(v[SENSOR_ARC_FLASH], 15, 30, 100);
    v[SENSOR_ACOUSTIC] = rise(v[SENSOR_ACOUSTIC], 5, 10, 95);
  } else {
    v[SENSOR_ARC_FLASH] = walk(v[SENSOR_ARC_FLASH], 0.0, ARC_NORMAL_MAX, 0.4);
    v[SENSOR_ACOUSTIC] = walk(v[SENSOR_ACOUSTIC], ACOUSTIC_MIN, ACOUSTIC_MAX, 1.0);
  }
}

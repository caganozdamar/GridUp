#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <math.h>

#include "../core/adc_convert.h"
#include "../core/buffer.h"
#include "../core/json_lite.h"
#include "../core/payload.h"
#include "../core/provision.h"
#include "../core/sensors.h"

static int passed;
#define CHECK(cond) do { if (!(cond)) { fprintf(stderr, "FAIL %s:%d %s\n", __FILE__, __LINE__, #cond); exit(1); } } while (0)
#define DONE(name) do { passed++; printf("ok  %s\n", name); } while (0)

/* Same shape GET /panels returns: a nested "site" object carries its own id. */
static const char *PANELS =
    "[{\"id\":\"p-1\",\"code\":\"PANO-001\",\"site\":{\"id\":\"s-1\",\"code\":\"X\"}},"
    "{\"id\":\"p-3\",\"code\":\"PANO-003\",\"site\":{\"id\":\"s-1\",\"code\":\"X\"}}]";

static const char *SENSORS =
    "[{\"id\":\"a\",\"type\":\"AMBIENT_TEMPERATURE\",\"isActive\":true},"
    "{\"id\":\"b\",\"type\":\"CABLE_TEMPERATURE\",\"isActive\":true},"
    "{\"id\":\"c\",\"type\":\"HUMIDITY\",\"isActive\":false},"
    "{\"id\":\"d\",\"type\":\"CURRENT\",\"isActive\":true},"
    "{\"id\":\"e\",\"type\":\"SOMETHING_NEW\",\"isActive\":true}]";

static void test_json_ignores_nested_keys(void) {
  char id[32];
  CHECK(provision_find_panel(PANELS, "PANO-003", id, sizeof id));
  CHECK(strcmp(id, "p-3") == 0); /* not the nested site id "s-1" */
  CHECK(!provision_find_panel(PANELS, "PANO-999", id, sizeof id));
  DONE("json: top-level id, nested site.id ignored");
}

static void test_provision_sensors(void) {
  sensor_map_t m;
  CHECK(provision_parse_sensors(SENSORS, &m) == 3);
  CHECK(m.present[SENSOR_AMBIENT_TEMPERATURE] && strcmp(m.sensor_id[SENSOR_AMBIENT_TEMPERATURE], "a") == 0);
  CHECK(m.present[SENSOR_CURRENT]);
  CHECK(!m.present[SENSOR_HUMIDITY]);   /* inactive */
  CHECK(!m.present[SENSOR_ARC_FLASH]);  /* backend does not know it yet */
  DONE("provision: skips inactive and unknown sensors");
}

static void test_buffer_overflow_drops_oldest(void) {
  static tick_buffer_t b;
  sensor_state_t st = {{0}};
  buffer_init(&b);
  for (int i = 0; i < BUFFER_CAPACITY + 5; i++) {
    char ts[32];
    snprintf(ts, sizeof ts, "t%d", i);
    buffer_push(&b, ts, &st);
  }
  CHECK(b.count == BUFFER_CAPACITY);
  CHECK(b.dropped == 5);
  CHECK(strcmp(buffer_at(&b, 0)->timestamp, "t5") == 0);
  CHECK(strcmp(buffer_at(&b, BUFFER_CAPACITY - 1)->timestamp, "t68") == 0);
  DONE("buffer: overflow drops oldest, keeps order");
}

static void test_payload(void) {
  static tick_buffer_t b;
  sensor_map_t m;
  sensor_state_t st = {{0}};
  char out[1024];
  provision_parse_sensors(SENSORS, &m);
  st.v[SENSOR_CABLE_TEMPERATURE] = 72.456;
  buffer_init(&b);
  buffer_push(&b, "2026-09-19T20:00:00.000Z", &st);
  CHECK(payload_build_batch(&b, &m, out, sizeof out) == 3);
  CHECK(strstr(out, "\"sensorId\":\"b\",\"value\":72.46,\"timestamp\":\"2026-09-19T20:00:00.000Z\""));
  CHECK(strncmp(out, "{\"readings\":[", 13) == 0);
  CHECK(payload_build_batch(&b, &m, out, 20) == -1); /* too small */
  DONE("payload: batch JSON shape, too-small buffer detected");
}

static void test_full_buffer_fits_api_limit(void) {
  static tick_buffer_t b;
  sensor_map_t m;
  sensor_state_t st = {{0}};
  static char out[65536];
  memset(&m, 0, sizeof m);
  for (int k = 0; k < SENSOR_KIND_COUNT; k++) {
    m.present[k] = 1;
    snprintf(m.sensor_id[k], SENSOR_ID_LEN, "11111111-2222-3333-4444-55555555555%d", k);
  }
  buffer_init(&b);
  for (int i = 0; i < BUFFER_CAPACITY; i++) buffer_push(&b, "2026-09-19T20:00:00.000Z", &st);
  int n = payload_build_batch(&b, &m, out, sizeof out);
  CHECK(n == BUFFER_CAPACITY * SENSOR_KIND_COUNT);
  CHECK(n <= 500); /* MAX_BATCH_SIZE on the API */
  DONE("payload: a full buffer stays under the API's 500-reading limit");
}

static double run_ticks(scenario_t s, int n, sensor_kind_t kind, double *min_seen) {
  sensor_state_t st;
  sensor_state_init(&st);
  double max = st.v[kind];
  *min_seen = max;
  for (int i = 0; i < n; i++) {
    sensor_state_step(&st, s);
    if (st.v[kind] > max) max = st.v[kind];
    if (st.v[kind] < *min_seen) *min_seen = st.v[kind];
  }
  return max;
}

static void test_scenarios(void) {
  double lo;
  srand(42);
  /* NORMAL stays inside the normal bands for a long time. */
  run_ticks(SCENARIO_NORMAL, 2000, SENSOR_CABLE_TEMPERATURE, &lo);
  CHECK(lo >= 30.0);
  CHECK(run_ticks(SCENARIO_NORMAL, 2000, SENSOR_CABLE_TEMPERATURE, &lo) <= 45.0);
  CHECK(run_ticks(SCENARIO_NORMAL, 2000, SENSOR_CURRENT, &lo) <= 110.0);
  CHECK(run_ticks(SCENARIO_NORMAL, 2000, SENSOR_ARC_FLASH, &lo) <= 3.0);
  CHECK(run_ticks(SCENARIO_NORMAL, 2000, SENSOR_ACOUSTIC, &lo) <= 45.0);
  /* Faults reach critical territory. */
  CHECK(run_ticks(SCENARIO_OVERHEATING, 60, SENSOR_CABLE_TEMPERATURE, &lo) > 75.0);
  CHECK(run_ticks(SCENARIO_OVERCURRENT, 60, SENSOR_CURRENT, &lo) > 150.0);
  CHECK(run_ticks(SCENARIO_HIGH_HUMIDITY, 60, SENSOR_HUMIDITY, &lo) > 80.0);
  CHECK(run_ticks(SCENARIO_ARC_FLASH, 30, SENSOR_ARC_FLASH, &lo) > 90.0);
  CHECK(run_ticks(SCENARIO_ARC_FLASH, 30, SENSOR_ACOUSTIC, &lo) > 80.0);
  CHECK(run_ticks(SCENARIO_COMBINED_FAILURE, 60, SENSOR_CABLE_TEMPERATURE, &lo) > 75.0);
  CHECK(run_ticks(SCENARIO_COMBINED_FAILURE, 60, SENSOR_HUMIDITY, &lo) > 80.0);
  DONE("scenarios: NORMAL stays in band, faults reach critical levels");
}

static void test_names(void) {
  sensor_kind_t k;
  scenario_t s;
  CHECK(sensor_kind_from_name("ARC_FLASH", &k) && k == SENSOR_ARC_FLASH);
  CHECK(!sensor_kind_from_name("NOPE", &k));
  CHECK(scenario_from_name("COMBINED_FAILURE", &s) && s == SCENARIO_COMBINED_FAILURE);
  CHECK(!scenario_from_name("nope", &s));
  DONE("names: enum <-> string round trip");
}

static void test_payload_skips_unreadable_and_unsynced(void) {
  static tick_buffer_t b;
  sensor_map_t m;
  sensor_state_t st = {{0}};
  char out[1024];
  provision_parse_sensors(SENSORS, &m);
  st.v[SENSOR_CABLE_TEMPERATURE] = NAN; /* open-circuit NTC */
  st.v[SENSOR_CURRENT] = 12.5;
  buffer_init(&b);
  buffer_push(&b, "", &st); /* clock not synced */
  int n = payload_build_batch(&b, &m, out, sizeof out);
  CHECK(n == 2);                       /* ambient + current; cable (NAN) left out */
  CHECK(!strstr(out, "\"sensorId\":\"b\"")); /* the NAN channel */
  CHECK(!strstr(out, "timestamp"));    /* server stamps it */
  CHECK(!strstr(out, "nan"));
  DONE("payload: NAN channels skipped, empty timestamp omitted");
}

static void test_adc_conversions(void) {
  /* NTC: mid-scale is 25 degC by construction (equal resistances). */
  CHECK(fabs(adc_to_cable_celsius(2048) - 25.0) < 0.2);
  CHECK(adc_to_cable_celsius(3000) < 25.0);  /* more counts = colder for this divider */
  CHECK(adc_to_cable_celsius(1000) > 25.0);
  CHECK(isnan(adc_to_cable_celsius(0)));     /* shorted / open sensor is not a temperature */
  CHECK(isnan(adc_to_cable_celsius(ADC_MAX_COUNTS)));
  CHECK(adc_to_current_amps(0) == 0.0);
  CHECK(fabs(adc_to_current_amps(ADC_MAX_COUNTS) - 250.0) < 1e-9);
  CHECK(adc_to_current_amps(-50) == 0.0);    /* clamped */
  CHECK(adc_to_current_amps(9999) == 250.0);
  CHECK(fabs(adc_to_arc_percent(2048) - 50.0) < 0.1);
  /* Microphone: loudness is the swing around the mid-scale bias, not the level. */
  int quiet[4] = {2048, 2048, 2048, 2048};
  int loud[4] = {0, ADC_MAX_COUNTS, 0, ADC_MAX_COUNTS};
  int idle_noise[4] = {2048 + 200, 2048 - 200, 2048 + 200, 2048 - 200};
  CHECK(acoustic_rms_counts(quiet, 4) == 0.0);
  CHECK(acoustic_db_from_rms(acoustic_rms_counts(quiet, 4)) == 40.0);  /* bias alone is silence */
  CHECK(acoustic_db_from_rms(acoustic_rms_counts(idle_noise, 4)) == 40.0);  /* below the noise floor */
  CHECK(fabs(acoustic_db_from_rms(acoustic_rms_counts(loud, 4)) - 100.0) < 1e-9);
  CHECK(isnan(acoustic_rms_counts(quiet, 1)));
  CHECK(isnan(acoustic_db_from_rms(NAN)));
  DONE("adc: conversions, clamping and open/short detection");
}

static void test_synthetic_source(void) {
  synthetic_source_t src;
  sensor_state_t a, b;
  srand(7);
  synthetic_source_init(&src, SCENARIO_ARC_FLASH);
  CHECK(synthetic_source_read(&src, &a) == 0);
  for (int i = 0; i < 8; i++) CHECK(synthetic_source_read(&src, &b) == 0);
  CHECK(b.v[SENSOR_ARC_FLASH] > a.v[SENSOR_ARC_FLASH]);
  DONE("synthetic source: initialises lazily and advances the scenario");
}

static void test_critical_band(void) {
  sensor_state_t st = {{28, 38, 45, 85, 1, 40}};
  CHECK(!sensors_in_critical_band(&st));
  st.v[SENSOR_CABLE_TEMPERATURE] = 80;
  CHECK(sensors_in_critical_band(&st));
  st.v[SENSOR_CABLE_TEMPERATURE] = 38;
  st.v[SENSOR_ARC_FLASH] = 45;
  CHECK(sensors_in_critical_band(&st));
  st.v[SENSOR_ARC_FLASH] = 1;
  st.v[SENSOR_CURRENT] = NAN; /* unreadable channel must not raise the alarm */
  CHECK(!sensors_in_critical_band(&st));
  st.v[SENSOR_AMBIENT_TEMPERATURE] = 500; /* ambient is never a fault source */
  CHECK(!sensors_in_critical_band(&st));
  DONE("critical band: per-channel limits, NAN ignored, ambient excluded");
}

int main(void) {
  test_json_ignores_nested_keys();
  test_provision_sensors();
  test_buffer_overflow_drops_oldest();
  test_payload();
  test_full_buffer_fits_api_limit();
  test_scenarios();
  test_names();
  test_payload_skips_unreadable_and_unsynced();
  test_adc_conversions();
  test_synthetic_source();
  test_critical_band();
  printf("%d test groups passed\n", passed);
  return 0;
}

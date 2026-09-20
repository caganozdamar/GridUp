/* Main-loop tests against a scriptable fake server (tests/hal_fake.c). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../core/module.h"
#include "../core/sensors.h"
#include "hal_fake.h"

static int passed;
#define CHECK(cond) do { if (!(cond)) { fprintf(stderr, "FAIL %s:%d %s\n", __FILE__, __LINE__, #cond); exit(1); } } while (0)
#define DONE(name) do { passed++; printf("ok  %s\n", name); } while (0)

#define READINGS_PER_TICK 6 /* the fake server knows all six sensor kinds */

typedef struct { int ticks; int link_ok_true; int last_link_ok; int flip_at; void (*flip)(void); } observed_t;

static void on_tick(void *ctx, const sensor_state_t *st, int link_ok) {
  (void)st;
  observed_t *o = ctx;
  o->ticks++;
  o->last_link_ok = link_ok;
  if (link_ok) o->link_ok_true++;
  if (o->flip && o->ticks == o->flip_at) o->flip();
}

static observed_t run(unsigned ticks, observed_t o) {
  synthetic_source_t src;
  synthetic_source_init(&src, SCENARIO_NORMAL);
  module_config_t cfg = {
      .api_base = "http://fake", .panel_code = "PANO-003", .interval_ms = 1, .max_ticks = ticks,
      .read = synthetic_source_read, .read_ctx = &src, .on_tick = on_tick, .on_tick_ctx = &o,
  };
  CHECK(module_run(&cfg) == 0);
  return o;
}

static void test_happy_path(void) {
  hal_fake_reset();
  observed_t o = run(4, (observed_t){0});
  CHECK(o.ticks == 4);
  CHECK(hal_fake.post_calls == 4);                       /* one POST per tick */
  CHECK(hal_fake_last_post_readings() == READINGS_PER_TICK);
  CHECK(o.last_link_ok == 1);
  CHECK(hal_fake.get_calls == 2);                        /* provisioned once: panels + sensors */
  DONE("module: provisions once, sends one tick per POST");
}

static void enable_server(void) { hal_fake.get_transport_fail = 0; }

static void test_starts_without_server(void) {
  hal_fake_reset();
  hal_fake.get_transport_fail = 1;
  /* Server comes up after tick 3; retry is every 5 ticks, so provisioning
   * succeeds at tick 6 and everything buffered until then is flushed at once. */
  observed_t o = run(6, (observed_t){.flip_at = 3, .flip = enable_server});
  CHECK(o.ticks == 6);                                   /* kept sampling with no server */
  CHECK(hal_fake.post_calls == 1);
  CHECK(hal_fake_last_post_readings() == 6 * READINGS_PER_TICK);
  CHECK(o.last_link_ok == 1);
  DONE("module: boots without the server, buffers, flushes after provisioning");
}

static void test_never_provisions(void) {
  hal_fake_reset();
  hal_fake.get_transport_fail = 1;
  observed_t o = run(12, (observed_t){0});
  CHECK(o.ticks == 12);                                  /* still sampling: Wokwi with no route to the API */
  CHECK(hal_fake.post_calls == 0);
  CHECK(o.link_ok_true == 0);
  CHECK(hal_fake.get_calls == 3);                        /* attempts at ticks 1, 6, 11 (first GET fails) */
  DONE("module: keeps reading and retries sparsely when the server never appears");
}

static void set_ok(void) { hal_fake.post_status = 201; }

static void test_5xx_keeps_data(void) {
  hal_fake_reset();
  hal_fake.post_status = 503;
  observed_t o = run(5, (observed_t){.flip_at = 3, .flip = set_ok});
  CHECK(o.ticks == 5);
  /* Ticks 1-3 failed (flip happens after tick 3's send), tick 4 sends 4 ticks. */
  CHECK(hal_fake.post_calls == 5);
  CHECK(hal_fake_last_post_readings() == 1 * READINGS_PER_TICK); /* tick 5 alone; tick 4 flushed the backlog */
  CHECK(o.last_link_ok == 1);
  DONE("module: 5xx keeps data, the backlog goes out once the server recovers");
}

static void test_transport_failure_keeps_data(void) {
  hal_fake_reset();
  hal_fake.post_transport_fail = 1;
  observed_t o = run(3, (observed_t){0});
  CHECK(o.last_link_ok == 0);
  CHECK(hal_fake_last_post_readings() == 3 * READINGS_PER_TICK); /* nothing dropped */
  DONE("module: network failure keeps every tick");
}

static void test_4xx_drops_batch(void) {
  hal_fake_reset();
  hal_fake.post_status = 400;
  run(3, (observed_t){0});
  CHECK(hal_fake.post_calls == 3);
  CHECK(hal_fake_last_post_readings() == READINGS_PER_TICK);     /* poison batch not retried forever */
  DONE("module: 4xx drops the batch instead of retrying it");
}

static void test_unsynced_clock(void) {
  hal_fake_reset();
  hal_fake.clock_synced = 0;
  run(1, (observed_t){0});
  CHECK(hal_fake_last_post_readings() == READINGS_PER_TICK);
  CHECK(strstr(hal_fake.last_post_body, "timestamp") == NULL);
  DONE("module: sends without timestamps until the clock is synced");
}

static int failing_read(void *ctx, sensor_state_t *out) { (void)ctx; (void)out; return -1; }

static void test_failed_read_skips_tick(void) {
  hal_fake_reset();
  module_config_t cfg = {
      .api_base = "http://fake", .panel_code = "PANO-003", .interval_ms = 1, .max_ticks = 3,
      .read = failing_read,
  };
  CHECK(module_run(&cfg) == 0);
  CHECK(hal_fake.post_calls == 0);
  CHECK(hal_fake.get_calls == 0);
  DONE("module: a failed sensor read skips the tick without crashing");
}

int main(void) {
  test_happy_path();
  test_starts_without_server();
  test_never_provisions();
  test_5xx_keeps_data();
  test_transport_failure_keeps_data();
  test_4xx_drops_batch();
  test_unsynced_clock();
  test_failed_read_skips_tick();
  printf("%d module test groups passed\n", passed);
  return 0;
}

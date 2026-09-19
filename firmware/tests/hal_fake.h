/* Scriptable HAL for module tests: serves canned /panels and /sensors JSON and
 * lets a test decide how the server answers each POST. */
#ifndef GRIDUP_HAL_FAKE_H
#define GRIDUP_HAL_FAKE_H

typedef struct {
  int get_transport_fail; /* 1 = GETs fail as if the server were unreachable */
  int post_transport_fail;
  int post_status;        /* HTTP status returned by POST /readings/batch */
  int clock_synced;       /* 0 = fw_iso_now returns "" */
  int get_calls;
  int post_calls;
  char last_post_body[65536];
  int sleeps;
} hal_fake_t;

extern hal_fake_t hal_fake;
void hal_fake_reset(void);
/* Number of readings in the last POST body (counts "sensorId"). */
int hal_fake_last_post_readings(void);

#endif

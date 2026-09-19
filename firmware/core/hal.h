/* Hardware/OS abstraction. core/ only talks to the outside world (network,
 * clock, logging, randomness) through these functions, so it contains no
 * platform-specific code. Each target supplies its own implementation; the
 * ESP32 one is still to be written. Unit tests link tests/hal_stub.c instead.
 * Every function is blocking and returns 0 on success. */
#ifndef GRIDUP_HAL_H
#define GRIDUP_HAL_H

#include <stddef.h>

/* HTTP GET/POST. Response body is written NUL-terminated into out (truncated
 * to out_size-1). *status receives the HTTP status code. Returns non-zero on
 * transport failure (no connection, timeout). */
int hal_http_get(const char *url, char *out, size_t out_size, int *status);
int hal_http_post_json(const char *url, const char *body, char *out, size_t out_size, int *status);

/* ISO 8601 UTC timestamp, e.g. 2026-09-19T20:43:21.818Z. */
void hal_iso_now(char *out, size_t out_size);

void hal_sleep_ms(unsigned ms);
void hal_log(const char *fmt, ...);

/* Uniform random in [0,1). */
double hal_random(void);

#endif

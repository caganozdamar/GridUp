/* Platform abstraction. core/ only talks to the outside world (network, clock,
 * logging, randomness) through these functions, so it contains no
 * platform-specific code. esp32/main/hal_esp32.c implements them for the ESP32;
 * unit tests link tests/hal_stub.c or tests/hal_fake.c instead.
 *
 * The fw_ prefix is deliberate: ESP-IDF's Wi-Fi library exports its own
 * hal_random, so a hal_ prefix collides at link time.
 * Every function is blocking and returns 0 on success. */

#ifndef GRIDUP_HAL_H
#define GRIDUP_HAL_H

#include <stddef.h>

/* HTTP GET/POST. Response body is written NUL-terminated into out (truncated
 * to out_size-1). *status receives the HTTP status code. Returns non-zero on
 * transport failure (no connection, timeout). */
int fw_http_get(const char *url, char *out, size_t out_size, int *status);
int fw_http_post_json(const char *url, const char *body, char *out, size_t out_size, int *status);

/* ISO 8601 UTC timestamp, e.g. 2026-09-19T20:43:21.818Z. */
void fw_iso_now(char *out, size_t out_size);

void fw_sleep_ms(unsigned ms);
void fw_log(const char *fmt, ...);

/* Uniform random in [0,1). */
double fw_random(void);

#endif

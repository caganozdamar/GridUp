/* HAL stubs for host-side unit tests: no network, deterministic randomness. */
#include <stdarg.h>
#include <stdlib.h>

#include "../core/hal.h"

int hal_http_get(const char *u, char *o, size_t s, int *st) { (void)u; (void)o; (void)s; *st = 0; return -1; }
int hal_http_post_json(const char *u, const char *b, char *o, size_t s, int *st) {
  (void)u; (void)b; (void)o; (void)s; *st = 0; return -1;
}
void hal_iso_now(char *o, size_t s) { (void)s; o[0] = '\0'; }
void hal_sleep_ms(unsigned ms) { (void)ms; }
void hal_log(const char *f, ...) { (void)f; }
double hal_random(void) { return rand() / ((double)RAND_MAX + 1.0); }

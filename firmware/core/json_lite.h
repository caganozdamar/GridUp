/* Tiny read-only JSON scanner. Enough to walk an array of flat-ish objects
 * and read top-level string/bool fields; nested objects are skipped, so a
 * nested "id" (e.g. panel.site.id) is never mistaken for the top-level one. */
#ifndef GRIDUP_JSON_LITE_H
#define GRIDUP_JSON_LITE_H

#include <stddef.h>

/* Finds the next top-level {...} element at or after *pos in a JSON array.
 * On success sets start and len to the object text, advances *pos, returns 1. */
int json_next_object(const char *json, size_t *pos, const char **start, size_t *len);

/* Copies a top-level string field of obj into out. Returns 1 if found. */
int json_get_string(const char *obj, size_t len, const char *key, char *out, size_t out_size);

/* Reads a top-level boolean field. Returns 1 if found (value in *out). */
int json_get_bool(const char *obj, size_t len, const char *key, int *out);

#endif

#ifndef GRIDUP_PAYLOAD_H
#define GRIDUP_PAYLOAD_H

#include <stddef.h>

#include "buffer.h"
#include "provision.h"

/* Builds the POST /readings/batch body from every buffered tick, one reading
 * per sensor kind the backend knows about. Returns the number of readings, or
 * -1 if out is too small. */
int payload_build_batch(const tick_buffer_t *b, const sensor_map_t *map, char *out, size_t out_size);

#endif

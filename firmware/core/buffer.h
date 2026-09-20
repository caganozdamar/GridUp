/* Store-and-forward ring buffer. Holds whole ticks while the network is down
 * so a short outage loses no data; when full, the oldest tick is dropped. */
#ifndef GRIDUP_BUFFER_H
#define GRIDUP_BUFFER_H

#include <stddef.h>

#include "sensors.h"

/* Ticks held while offline. 64 ticks x 6 sensors = 384 readings, under the API's
 * limit of 500 per batch. Small targets can lower it at build time. */
#ifndef BUFFER_CAPACITY
#define BUFFER_CAPACITY 64
#endif

typedef struct {
  char timestamp[32];
  sensor_state_t state;
} tick_t;

typedef struct {
  tick_t ticks[BUFFER_CAPACITY];
  size_t head;  /* index of oldest tick */
  size_t count;
  unsigned dropped; /* ticks lost to overflow since start */
} tick_buffer_t;

void buffer_init(tick_buffer_t *b);
void buffer_push(tick_buffer_t *b, const char *timestamp, const sensor_state_t *state);
/* i-th oldest tick (0 = oldest); i must be < b->count. */
const tick_t *buffer_at(const tick_buffer_t *b, size_t i);
void buffer_clear(tick_buffer_t *b);

#endif

#include "buffer.h"

#include <string.h>

void buffer_init(tick_buffer_t *b) { memset(b, 0, sizeof *b); }

void buffer_push(tick_buffer_t *b, const char *timestamp, const sensor_state_t *state) {
  if (b->count == BUFFER_CAPACITY) {
    b->head = (b->head + 1) % BUFFER_CAPACITY;
    b->count--;
    b->dropped++;
  }
  tick_t *t = &b->ticks[(b->head + b->count) % BUFFER_CAPACITY];
  strncpy(t->timestamp, timestamp, sizeof t->timestamp - 1);
  t->timestamp[sizeof t->timestamp - 1] = '\0';
  t->state = *state;
  b->count++;
}

const tick_t *buffer_at(const tick_buffer_t *b, size_t i) {
  return &b->ticks[(b->head + i) % BUFFER_CAPACITY];
}

void buffer_clear(tick_buffer_t *b) {
  b->head = 0;
  b->count = 0;
}

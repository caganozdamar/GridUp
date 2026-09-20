#ifndef GRIDUP_DHT22_H
#define GRIDUP_DHT22_H

#include "driver/gpio.h"

/* Reads a DHT22 on `pin`. Returns 0 on success; non-zero on timeout or a bad
 * checksum. The sensor cannot be polled faster than once every 2 seconds. */
int dht22_read(gpio_num_t pin, double *temperature_c, double *humidity_pct);

#endif

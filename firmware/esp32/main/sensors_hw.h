#ifndef GRIDUP_SENSORS_HW_H
#define GRIDUP_SENSORS_HW_H

#include "sensors.h"

/* Board wiring (see firmware/wokwi/diagram.json). All analog inputs are on
 * ADC1: ADC2 cannot be used while Wi-Fi is running. */
#define PIN_DHT22 4
#define PIN_NTC 34      /* cable temperature */
#define PIN_CURRENT 35  /* CT, simulated by a potentiometer */
#define PIN_ARC 32      /* LDR, optical arc flash */
#define PIN_ACOUSTIC 33 /* sound sensor */

void sensors_hw_init(void);
/* sensor_read_fn for the real inputs. Channels that cannot be read become NAN. */
int sensors_hw_read(void *ctx, sensor_state_t *out);

#endif

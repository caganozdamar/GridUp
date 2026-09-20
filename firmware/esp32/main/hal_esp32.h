#ifndef GRIDUP_HAL_ESP32_H
#define GRIDUP_HAL_ESP32_H

/* Starts Wi-Fi (station) and, once an address is obtained, SNTP. Blocks up to
 * ~15 s for the connection; returns 0 if connected. The module works offline
 * either way (it buffers), and Wi-Fi keeps retrying in the background. */
int hal_esp32_wifi_start(void);

#endif

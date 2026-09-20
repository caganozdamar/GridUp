/* ESP32 implementation of core/hal.h: esp_http_client over Wi-Fi, SNTP time,
 * stdout logging (UART, so it shows in the Wokwi serial monitor). */
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>

#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_random.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "hal.h"
#include "hal_esp32.h"
#include "sdkconfig.h"

#define GOT_IP_BIT BIT0
#define HTTP_TIMEOUT_MS 5000
#define WIFI_WAIT_MS 15000
/* Anything before this is the un-synced 1970 epoch. */
#define CLOCK_SYNCED_AFTER 1700000000L

static EventGroupHandle_t s_events;

static void on_wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
  (void)arg;
  (void)data;
  if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
    fw_log("[wifi] disconnected, retrying");
    xEventGroupClearBits(s_events, GOT_IP_BIT);
    esp_wifi_connect();
  } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
    xEventGroupSetBits(s_events, GOT_IP_BIT);
  }
}

int hal_esp32_wifi_start(void) {
  s_events = xEventGroupCreate();
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_sta();

  wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&init));
  ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_wifi_event, NULL));
  ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_wifi_event, NULL));

  wifi_config_t wifi = {0};
  strncpy((char *)wifi.sta.ssid, CONFIG_GRIDUP_WIFI_SSID, sizeof wifi.sta.ssid - 1);
  strncpy((char *)wifi.sta.password, CONFIG_GRIDUP_WIFI_PASSWORD, sizeof wifi.sta.password - 1);
  wifi.sta.threshold.authmode = CONFIG_GRIDUP_WIFI_PASSWORD[0] ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi));
  ESP_ERROR_CHECK(esp_wifi_start());

  fw_log("[wifi] connecting to \"%s\"", CONFIG_GRIDUP_WIFI_SSID);
  EventBits_t bits = xEventGroupWaitBits(s_events, GOT_IP_BIT, pdFALSE, pdTRUE, pdMS_TO_TICKS(WIFI_WAIT_MS));
  if (!(bits & GOT_IP_BIT)) {
    fw_log("[wifi] no connection yet, continuing offline (readings are buffered)");
    return -1;
  }

  fw_log("[wifi] connected");
  esp_sntp_config_t sntp = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
  esp_netif_sntp_init(&sntp);
  return 0;
}

typedef struct {
  char *buf;
  size_t size, used;
} sink_t;

static esp_err_t on_http_event(esp_http_client_event_t *e) {
  if (e->event_id == HTTP_EVENT_ON_DATA && e->user_data) {
    sink_t *s = e->user_data;
    size_t room = s->size > s->used + 1 ? s->size - s->used - 1 : 0;
    size_t take = (size_t)e->data_len < room ? (size_t)e->data_len : room;
    memcpy(s->buf + s->used, e->data, take);
    s->used += take;
    s->buf[s->used] = '\0';
  }
  return ESP_OK;
}

static int perform(const char *url, const char *post_body, char *out, size_t out_size, int *status) {
  sink_t sink = {out, out_size, 0};
  if (out_size) out[0] = '\0';
  *status = 0;

  esp_http_client_config_t cfg = {
      .url = url,
      .event_handler = on_http_event,
      .user_data = &sink,
      .timeout_ms = HTTP_TIMEOUT_MS,
      .method = post_body ? HTTP_METHOD_POST : HTTP_METHOD_GET,
  };
  esp_http_client_handle_t client = esp_http_client_init(&cfg);
  if (!client) return -1;
  if (post_body) {
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, post_body, (int)strlen(post_body));
  }

  esp_err_t err = esp_http_client_perform(client);
  if (err == ESP_OK) *status = esp_http_client_get_status_code(client);
  esp_http_client_cleanup(client);
  return err == ESP_OK ? 0 : -1;
}

int fw_http_get(const char *url, char *out, size_t out_size, int *status) {
  return perform(url, NULL, out, out_size, status);
}

int fw_http_post_json(const char *url, const char *body, char *out, size_t out_size, int *status) {
  return perform(url, body, out, out_size, status);
}

void fw_iso_now(char *out, size_t out_size) {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  if (tv.tv_sec < CLOCK_SYNCED_AFTER) {
    if (out_size) out[0] = '\0'; /* not synced: core omits the timestamp, the server stamps it */
    return;
  }
  struct tm tm;
  gmtime_r(&tv.tv_sec, &tm);
  char date[24];
  strftime(date, sizeof date, "%Y-%m-%dT%H:%M:%S", &tm);
  snprintf(out, out_size, "%s.%03ldZ", date, (long)(tv.tv_usec / 1000));
}

void fw_sleep_ms(unsigned ms) { vTaskDelay(pdMS_TO_TICKS(ms)); }

void fw_log(const char *fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  vprintf(fmt, ap);
  va_end(ap);
  putchar('\n');
}

double fw_random(void) { return esp_random() / 4294967296.0; }

# The platform-independent core lives in ../../core and is compiled in as-is.
set(CORE ${CMAKE_CURRENT_LIST_DIR}/../../core)

idf_component_register(
    SRCS
        main.c
        hal_esp32.c
        dht22.c
        sensors_hw.c
        ${CORE}/adc_convert.c
        ${CORE}/buffer.c
        ${CORE}/json_lite.c
        ${CORE}/module.c
        ${CORE}/payload.c
        ${CORE}/provision.c
        ${CORE}/sensors.c
    INCLUDE_DIRS "." ${CORE}
    REQUIRES
        driver esp_adc esp_event esp_http_client esp_netif esp_timer esp_wifi esp_hw_support nvs_flash
)

# Fewer buffered ticks than the 64 default: the ESP32 has ~300 KB of RAM.
target_compile_definitions(${COMPONENT_LIB} PRIVATE BUFFER_CAPACITY=32)

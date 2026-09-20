CC      ?= gcc
CFLAGS  ?= -std=c11 -O2 -Wall -Wextra -Wpedantic
BUILD   := build
CORE    := core/json_lite.c core/sensors.c core/provision.c core/buffer.c core/payload.c core/adc_convert.c core/module.c

.PHONY: test clean

# Host-side unit tests for the platform-independent core. core_tests links a
# stub HAL (no network); module_tests links a scriptable fake HAL that plays
# the server, so the main loop can be tested without any hardware.
$(BUILD)/core-tests: tests/core_tests.c $(CORE) tests/hal_stub.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -o $@ -lm

$(BUILD)/module-tests: tests/module_tests.c $(CORE) tests/hal_fake.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -o $@ -lm

test: $(BUILD)/core-tests $(BUILD)/module-tests
	./$(BUILD)/core-tests
	./$(BUILD)/module-tests

clean:
	rm -rf $(BUILD)

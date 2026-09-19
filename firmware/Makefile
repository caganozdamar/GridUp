CC      ?= gcc
CFLAGS  ?= -std=c11 -O2 -Wall -Wextra -Wpedantic
BUILD   := build

.PHONY: test clean

# Host-side unit tests for the platform-independent core. They link against
# tests/hal_stub.c, so no network, sensors or target hardware are needed.
$(BUILD)/core-tests: tests/core_tests.c core/json_lite.c core/sensors.c core/provision.c core/buffer.c core/payload.c tests/hal_stub.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -o $@

test: $(BUILD)/core-tests
	./$(BUILD)/core-tests

clean:
	rm -rf $(BUILD)

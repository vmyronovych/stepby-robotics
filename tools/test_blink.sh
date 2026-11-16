#!/bin/sh
# Standalone bench test; run with only the ESP32 connected by USB.
set -eu
cd "$(dirname "$0")/.."
MCAR_BLINK_PORT="${1:-/dev/cu.usbserial-0001}"
MCAR_BLINK_CLI="${MCAR_ARDUINO_CLI:-tools/arduino-bin/arduino-cli}"
mkdir -p firmware/blink/build validation
"$MCAR_BLINK_CLI" compile --config-file .cache/arduino-cli.yaml \
  --fqbn esp32:esp32:esp32 --warnings all \
  --build-path .cache/blink-build --output-dir firmware/blink/build firmware/blink \
  > validation/blink-build.log 2>&1 || { cat validation/blink-build.log; exit 1; }
cat validation/blink-build.log
"$MCAR_BLINK_CLI" upload --config-file .cache/arduino-cli.yaml \
  --fqbn esp32:esp32:esp32:UploadSpeed=115200 --port "$MCAR_BLINK_PORT" \
  --input-dir firmware/blink/build firmware/blink \
  > validation/blink-upload.log 2>&1 || { cat validation/blink-upload.log; exit 1; }
cat validation/blink-upload.log
python3 tools/monitor_blink.py "$MCAR_BLINK_PORT"

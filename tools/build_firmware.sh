#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p validation firmware/build
MCAR_CLI="${MCAR_ARDUINO_CLI:-arduino-cli}"
if [ -x tools/arduino-bin/arduino-cli ] && [ "$MCAR_CLI" = arduino-cli ]; then MCAR_CLI=tools/arduino-bin/arduino-cli; fi
if ! command -v "$MCAR_CLI" >/dev/null 2>&1; then
  echo 'ESP32 build NOT RUN: arduino-cli is not installed.' >validation/esp32-build.log
  cat validation/esp32-build.log >&2
  exit 2
fi
if [ ! -f firmware/src/workshop_assets.h ]; then
  echo 'Legacy Wi-Fi firmware requires its archived firmware/src/workshop_assets.h. The current USB website build does not generate this file.' >&2
  exit 2
fi
set -- compile --fqbn esp32:esp32:esp32:PartitionScheme=min_spiffs --warnings all --output-dir firmware/build firmware/src
if [ -f .cache/arduino-cli.yaml ]; then set -- "$@" --config-file .cache/arduino-cli.yaml; fi
"$MCAR_CLI" "$@" >validation/esp32-build.log 2>&1 || { cat validation/esp32-build.log; exit 1; }
cp firmware/build/src.ino.bin firmware/build/mandrivnyk-esp32-ota.bin
cat validation/esp32-build.log

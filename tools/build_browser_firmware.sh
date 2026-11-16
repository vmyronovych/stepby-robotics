#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p firmware/browser/build validation
node --input-type=module -e "import fs from 'node:fs'; import {gpioSource} from './web/src/usb-gpio-source.js'; fs.writeFileSync('firmware/browser/gpio_runtime.h', '// Generated from web/src/usb-gpio-source.js. Do not edit.\\n'+gpioSource);"
MCAR_BROWSER_CLI="${MCAR_ARDUINO_CLI:-tools/arduino-bin/arduino-cli}"
"$MCAR_BROWSER_CLI" compile --config-file .cache/arduino-cli.yaml \
 --fqbn esp32:esp32:esp32 --warnings all --build-path .cache/browser-build \
 --output-dir firmware/browser/build firmware/browser >validation/browser-build.log 2>&1 || { cat validation/browser-build.log; exit 1; }
node web/scripts/package-browser-firmware.mjs
cat validation/browser-build.log

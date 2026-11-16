"""Observe the real USB serial stream; never infer LED light from GPIO logs."""
import re
import sys
import time
from pathlib import Path

import serial

port = sys.argv[1] if len(sys.argv) > 1 else '/dev/cu.usbserial-0001'
pattern = re.compile(r'^tick=(\d+) ms=(\d+) GPIO2=(HIGH|LOW)$')
samples = []
Path('validation').mkdir(exist_ok=True)
connection = serial.Serial(baudrate=115200, timeout=0.5)
connection.dtr = False
connection.rts = False
connection.port = port
try:
    connection.open()
    with connection, Path('validation/blink-serial.log').open('w') as log:
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline and len(samples) < 12:
            line = connection.readline().decode('utf-8', errors='replace').strip()
            if not line:
                continue
            print(line, flush=True)
            log.write(line + '\n')
            match = pattern.fullmatch(line)
            if match:
                samples.append((int(match[1]), int(match[2]), match[3]))
except serial.SerialException as error:
    sys.exit(f'USB serial unavailable: {error}')

if len(samples) < 10:
    sys.exit('Serial test FAIL: fewer than 10 GPIO transitions received in 12 seconds.')
for previous, current in zip(samples, samples[1:]):
    elapsed = (current[1] - previous[1]) & 0xFFFFFFFF
    if current[0] != previous[0] + 1 or current[2] == previous[2] or not 450 <= elapsed <= 600:
        sys.exit(f'Serial test FAIL: unexpected transition {previous} -> {current}')
print('Serial test PASS: GPIO2 alternates HIGH/LOW every ~500 ms without a reset.')
print('Visual check still required: does the on-board LED blink once per second?')

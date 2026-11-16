"""Bounded observation after a USB-blocks upload; no GPIO writes or port reset."""
import sys
import time
import serial

port = serial.Serial(baudrate=115200, timeout=0.25)
port.dtr = False
port.rts = False
port.port = sys.argv[1]
port.open()
with port:
    deadline = time.monotonic() + 7
    lines = 0
    while time.monotonic() < deadline and lines < 100:
        text = port.readline().decode('utf-8', errors='replace').strip()
        if text:
            print(text, flush=True)
            lines += 1

"""Test-only Web Streams adapter bridge. Never needed on student computers."""
import base64, json, sys, threading, array, fcntl, termios
import serial
signal_mode = sys.argv[3] if len(sys.argv) > 3 else 'atomic'
if signal_mode not in ('atomic', 'chromium'): raise ValueError('Unknown signal mode')
port = serial.Serial(sys.argv[1], int(sys.argv[2]), timeout=0.05)
lock = threading.Lock()
stopping = threading.Event()
def send(value):
    with lock:
        print(json.dumps(value), flush=True)
def read():
    while not stopping.is_set():
        try:
            data = port.read(max(1, port.in_waiting))
            if data: send({'data': base64.b64encode(data).decode()})
        except serial.SerialException: break
thread = threading.Thread(target=read, daemon=True)
thread.start()
send({'id': 0, 'ok': True})
try:
    for line in sys.stdin:
        command = json.loads(line)
        try:
            if command['op'] == 'write': port.write(base64.b64decode(command['data']))
            elif command['op'] == 'signals':
                signals = command['signals']
                # Chromium's POSIX split-DTR/RTS path updates DTR first, then RTS.
                # A single Web Serial call therefore need not be atomic in hardware.
                if signal_mode == 'chromium':
                    for name, mask in [('dataTerminalReady', termios.TIOCM_DTR), ('requestToSend', termios.TIOCM_RTS)]:
                        if name in signals:
                            fcntl.ioctl(port.fileno(), termios.TIOCMBIS if signals[name] else termios.TIOCMBIC, array.array('i', [mask]))
                else:
                    bits = array.array('i', [0])
                    fcntl.ioctl(port.fileno(), termios.TIOCMGET, bits, True)
                    for name, mask in [('dataTerminalReady', termios.TIOCM_DTR), ('requestToSend', termios.TIOCM_RTS)]:
                        if name in signals:
                            bits[0] = (bits[0] | mask) if signals[name] else (bits[0] & ~mask)
                    fcntl.ioctl(port.fileno(), termios.TIOCMSET, bits)
            elif command['op'] == 'close':
                stopping.set(); thread.join(1); port.close()
                send({'id': command['id'], 'ok': True}); break
            send({'id': command['id'], 'ok': True})
        except Exception as error: send({'id': command['id'], 'error': str(error)})
finally:
    stopping.set()
    if port.is_open: port.close()

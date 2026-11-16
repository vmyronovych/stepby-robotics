# Persistent USB runtime

The ESP32 runs a cooperative MCARUSB1 bytecode interpreter and an always-available serial receiver, including after program completion or runtime errors. The browser can replace the algorithm without a ROM reset. The initial installation/recovery still uses esptool-js and may require BOOT on boards with unreliable auto-reset.

## USB protocol

Runtime `gpio2-v5` preserves variables between phone events and leaves output levels unchanged after a handler completes. `Machine::start` initializes a newly loaded program; `startEvent` resets execution position, stack and waits while preserving its variables. Every upload initializes the VM even when reusing the same Program object. STOP, lease loss and runtime errors clear variables and switch off outputs. Release handlers retain variables; outputs are switched off before the release handler runs. State is in RAM and resets on board restart.

Runtime `gpio2-v4` adds console text: `M length` followed by `length` data instructions `b byte` (0–120 UTF-8 bytes), then the next executable instruction. Data instructions cannot be jump targets. Console records use `MCAR_LOG <hex UTF-8>`; excess output is counted in `MCAR_LOG_DROPPED <count>`. Browser console and normal uploads share one serialized USB session; ROM installation closes the console first. The firmware limits output to ten records per one-second window and skips output when the UART buffer lacks capacity, preserving the remote safety loop.

Runtime `gpio2-v3` adds phone event handlers. `T 1..8` marks a press handler, `T 9..16` a release handler; each handler ends with `H`, and a remote program begins with `H` so boot stays idle. Handler entry stacks and jumps are validated independently. `RUNNING` acknowledges installation for remote programs but does not imply motion: they wait for a phone event. HELLO also reports the board's Wi-Fi credentials over physical USB; do not publish that log. See [phone remote](../../docs/phone-remote.md) for setup and safety acceptance.

115200 baud, ASCII lines ending in LF. Every request carries a fresh 16-character lowercase hexadecimal nonce. The protocol prefix is `MCAR2`; the algorithm's binary format remains `MCARUSB1`. This USB protocol is separate from the robot's Wi-Fi program API.

| Browser request | Runtime response |
| --- | --- |
| `MCAR2 HELLO nonce` | `MCAR2 READY nonce gpio2-v5 16400` |
| `MCAR2 BEGIN nonce length crc` | `MCAR2 ACCEPT nonce 0` |
| `MCAR2 DATA nonce offset hex` | `MCAR2 ACK nonce nextOffset` |
| `MCAR2 COMMIT nonce` | `MCAR2 SAVED nonce crc`, then `MCAR2 RUNNING nonce crc` |
| `MCAR2 CANCEL nonce` | `MCAR2 CANCELLED nonce` |

`crc` is eight lowercase hex characters: the MCARUSB1 instruction-payload CRC32. The header's checksum, instruction count, exact payload length and VM validation must all agree. DATA contains at most 256 binary bytes encoded as 512 hex characters; offsets must be contiguous. Maximum program size is 16,400 bytes. A transfer with no activity for 10 seconds is discarded. Lines exceeding 599 characters are discarded through the next newline. Unsupported commands and invalid transfers cannot replace a saved algorithm.

Errors use `MCAR2 ERROR nonce reason`. The nonce prevents stale replies from acknowledging a different upload; it is not authentication. Access is controlled by the browser's serial permission and physical USB connection.

The browser probes for up to 3.5 seconds, including the firmware's 1.5-second startup delay. Silence returns a finished `connection-error` job without downloading firmware or entering the ROM loader. Only a recognized incompatible runtime returns `setup-required`. Recovery offers HELLO-only checks, port reselection, and diagnostics with credentials redacted. Installation requires a separate explicit action with `install: true`; a ROM connection/boot-mode failure returns to recovery instead of another BOOT loop. Missing replies do not prove that the base firmware is absent. On resume the console releases its previous session before probing again; checks are deferred during transfers. Serial open, write, signals and cleanup operations have bounded waits; a timed-out session cannot be reused until page reload. Once a receiver is recognized, a failed transfer never automatically falls back to a ROM flash. The browser checks SAVED/RUNNING against the exact nonce and CRC, then observes 750 ms for immediate `PROGRAM_ERROR` output. RUNNING means the VM accepted and started the program, not that every future branch has been verified.

## Persistent storage

The existing 64-KB `program` partition contains two 32-KB slots. Each starts with a complete MCARUSB1 image. The last 24 bytes contain an eight-byte `MCARSLOT` marker followed by little-endian generation, image length, program CRC32 and footer CRC32. The footer CRC covers the preceding 20 footer bytes.

The runtime validates in RAM before erasing the inactive slot. It writes the image, reads it back, writes the footer last and verifies it. Boot selects the highest valid generation whose footer and program pass validation. A torn erase, image or footer preserves the active slot. Legacy images at offset zero remain readable when no committed slot exists; their first update commits into slot one. Generation overflow is rejected.

Initial installation writes a full 64-KB image containing the initial algorithm and 0xFF padding, invalidating both previous slots. Normal algorithm updates never erase the active slot. An interrupted transfer does not stop the old VM. After a verified commit, its configured outputs are stopped and the new VM starts from its first instruction.

## Build and verification

Run `sh tools/build_browser_firmware.sh`. The shared GPIO helper is generated from `web/src/usb-gpio-source.js`. Packaging records hashes of every runtime source and image in `web/public/firmware/esp32-gpio-v2/manifest.json`.

`npm test --prefix web` includes native C++ tests for partial erase/write/commit recovery, legacy migration, protocol validation and actual interoperability between the browser client and the C++ receiver. Browser tests exercise the real client with simulated serial streams; these do not prove the OS permission/driver path.

Hardware tools are explicit and are never run by CI:

- `node web/scripts/install-runtime-preserving-program.mjs --install-connected-esp32` backs up the current partition and installs the runtime while preserving the active algorithm.
- `node web/scripts/check-runtime-hardware.mjs --update-connected-esp32` sends two known LED algorithms, restores the original and checks persistence after a simulated interrupted transfer and reset. It uses the backup/evidence from the installation tool.
- `node web/scripts/check-auto-boot.mjs 3 chromium` reproduces the problematic sequential DTR/RTS reset path without writing flash; `atomic` selects the original system adapter.

The system serial adapter is test-only. Student browsers need no Python, Node.js or local server. Windows 10/11 classroom acceptance and a native browser-to-board run remain distinct from adapter tests.

The connection screen uses `probeRuntime` (HELLO only) before revealing the editor. It never sends BEGIN/DATA/COMMIT during onboarding or reconnect. Automatic discovery is limited to ports already authorized through the browser's user-initiated chooser. Disconnect invalidates the current connection epoch, so a stale readiness/upload result cannot reopen the editor. First setup from this screen installs the blink example independently of the saved Blockly workspace; the workspace remains unchanged until the user edits it or explicitly opens a different project.

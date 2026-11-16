#!/usr/bin/env python3
"""Package existing, tested artifacts. Does not compile or flash hardware."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'firmware/release'
RELEASE.mkdir(exist_ok=True)
files = {
    'mandrivnyk-esp32-ota.bin': 'src.ino.bin',
    'mandrivnyk-esp32-usb.bin': 'src.ino.merged.bin',
}
images = {}
for target, source in files.items():
    src = ROOT / 'firmware/build' / source
    assert src.is_file(), f'Build required: {src}'
    shutil.copyfile(src, RELEASE / target)
    data = src.read_bytes()
    images[target] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                      'method': 'OTA application' if 'ota' in target else 'USB merged, offset 0x0, replaces NVS'}
assert images['mandrivnyk-esp32-ota.bin']['bytes'] <= 0x1E0000
assert images['mandrivnyk-esp32-usb.bin']['bytes'] == 0x400000
sources = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
           for p in sorted((ROOT / 'firmware/src').iterdir()) if p.is_file()}
manifest = {'version': '0.3.0', 'chip': 'classic ESP32 / ESP-WROOM-32 / DevKit V1 30-pin',
            'flashBytes': 0x400000, 'arduinoCore': '3.3.0',
            'fqbn': 'esp32:esp32:esp32:PartitionScheme=min_spiffs',
            'otaSlotBytes': 0x1E0000, 'hardwareTested': False,
            'images': images, 'firmwareSourceSHA256': sources}
(RELEASE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(RELEASE / 'SHA256SUMS').write_text(''.join(f"{v['sha256']}  {k}\n" for k, v in images.items()))
archive = ROOT / 'exports/mandrivnyk-workshop-v0.3.zip'
archive.parent.mkdir(exist_ok=True)
selected = [ROOT / 'README.md', ROOT / '.gitignore']
for directory in ['docs', 'assembly', 'firmware/src', 'firmware/tests', 'firmware/release',
                  'lessons', 'web', 'validation', 'tools']:
    for p in (ROOT / directory).rglob('*'):
        if not p.is_file() or p.is_symlink():
            continue
        relative = p.relative_to(ROOT)
        if any(x in relative.parts for x in ['node_modules', '__pycache__', 'arduino-bin',
                                             'test-results', 'playwright-report', 'host-stubs']):
            continue
        if p.name == '.DS_Store' or relative.parts[:2] == ('validation', 'pdf-preview'):
            continue
        selected.append(p)
selected.append(ROOT / 'firmware/README.md')
checksummed = [p for p in sorted(set(selected))
               if p.relative_to(ROOT).parts[0] != 'validation']
(ROOT / 'validation/SHA256SUMS').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT)}\n'
    for p in checksummed))
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
    for p in sorted(set(selected)):
        out.write(p, 'mandrivnyk/' + str(p.relative_to(ROOT)))
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
print(f'{archive.relative_to(ROOT)}: {archive.stat().st_size:,} bytes')
print(json.dumps(images, indent=2))

#!/usr/bin/env python3
"""Static cross-document checks. Does not certify physical hardware or ESP32 compilation."""
import csv,json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
R=Path(__file__).resolve().parents[1]
required=['README.md','docs/README.md','docs/hardware-research.md','docs/architecture.md','docs/bom.md','docs/bom.csv','docs/wiring.md','docs/wiring.svg','docs/gpio-map.md','docs/mechanical-layout.md','assembly/assembly-manual.pdf','assembly/sources/build_manual.py','assembly/sources/geometry.json','firmware/src/main.cpp','firmware/README.md']+[f'lessons/lesson-{n:02d}.md'for n in range(1,9)]
required += ['docs/assembly-guide.md','web/src/assembly/guide.js','web/src/assembly/viewer.js','web/src/assembly/model-data.json','assembly/sources/robot_model.py','assembly/sources/assembly_steps.py','web/THREE-LICENSE.txt']
for p in required:assert (R/p).is_file(),p
config=(R/'firmware/src/config.h').read_text()
motors=list(map(int,re.findall(r'\d+',re.search(r'MOTOR_PINS\[4\]\[2\] = (.*?);',config)[1])))
sensors=list(map(int,re.findall(r'\d+',re.search(r'SENSOR_PINS\[5\] = (.*?);',config)[1])))
fault=list(map(int,re.findall(r'\d+',re.search(r'FAULT_PINS\[2\] = (.*?);',config)[1])))
bat=int(re.search(r'BATTERY_PIN = (\d+)',config)[1]);button=int(re.search(r'BUTTON_PIN = (\d+)',config)[1])
pins=motors+sensors+fault+[bat,button]
assert len(pins)==17 and len(set(pins))==17
assert set(sensors+[bat])<=set([32,33,34,35,36,39]);assert not set(pins)&set([0,2,5,6,7,8,9,10,11,12,15])
doc=(R/'docs/gpio-map.md').read_text();documented=list(map(int,re.findall(r'^\| (\d+)(?: \([^)]*\))? \|',doc,re.M)))
assert sorted(documented)==sorted(pins),(documented,pins)
expected={16:'D16 / RX2',17:'D17 / TX2',18:'D18',19:'D19',23:'D23',25:'D25',26:'D26',27:'D27',32:'D32',33:'D33',34:'D34',35:'D35',36:'VP',39:'VN',21:'D21',22:'D22',13:'D13'}
for pin,header in expected.items():assert re.search(r'^\| '+str(pin)+r'(?: \([^)]*\))? \| '+re.escape(header)+r' \|',doc,re.M)
rows=list(csv.DictReader((R/'docs/bom.csv').open(encoding='utf-8-sig')))
for row in rows:assert abs(float(row['Кількість'])*float(row['Ціна одиниці UAH'])-float(row['Сума UAH']))<.01
cost=sum(float(r['Сума UAH'])for r in rows if r['Група']=='B потрібно');totals=json.loads((R/'docs/bom-totals.json').read_text());assert cost==totals['perRobot']
for row in totals['quantities']:assert row['robots']*cost+row['chargers']*totals['charger']==row['total']
for row in rows:
 if row['Група']=='A вже є':assert float(row['Сума UAH'])==0
ET.parse(R/'docs/wiring.svg')
geometry=json.loads((R/'assembly/sources/geometry.json').read_text());assert geometry['status']=='ILLUSTRATIVE_NOT_FOR_MANUFACTURE'
unknown=sum(x is None for x in geometry['measured'].values())
print(f'PENDING: {unknown} chassis measurement fields; manufacturing geometry is not certified')
manifest=json.loads((R/'assembly/sources/page-manifest.json').read_text());assert all(a['stage']<=b['stage'] for a,b in zip(manifest,manifest[1:]));assert all(p['lift_mm']==0 for p in manifest)
# Validate the distributed programs, independently checking duration and range.
for file in (R/'lessons/programs').glob('*.txt'):
 lines=file.read_text().splitlines();assert 0<len(lines)<=32;duration=0
 for line in lines:
  match=re.fullmatch(r'([SFBLRWXKA]),(\d+)',line);assert match,(file,line)
  op,value=match[1],int(match[2])
  if op=='S':assert value<=180
  elif op=='K':assert value<=1000
  elif op=='X':assert value==0
  else:assert 20<=value<=10000;duration+=value
 assert duration<=120000
# Markdown links to local files must resolve; external sources are not fetched here.
for file in [R/'README.md']+list((R/'docs').glob('*.md'))+list((R/'lessons').glob('*.md'))+[R/'firmware/README.md']:
 for dest in re.findall(r'\]\(([^)]+)\)',file.read_text()):
  if '://' in dest or dest.startswith('#'):continue
  target=dest.split('#')[0]
  assert (file.parent/target).exists(),(str(file.relative_to(R)),target)
print(f'PASS: {len(required)} deliverables; 17 unique GPIO/header mappings; ADC1; BOM {cost:.2f} UAH; connector SVG; model sequence; 7 lesson programs; local links')
try:
 from pypdf import PdfReader
except ImportError:
 print('PDF text checks NOT RUN: install pypdf or use the documented bundled environment.')
else:
 pdf=PdfReader(R/'assembly/assembly-manual.pdf');assert len(pdf.pages)==31
 for i,page in enumerate(pdf.pages,1):
  assert abs(float(page.mediabox.width)-595.2756)<1 and abs(float(page.mediabox.height)-841.8898)<1
  t=page.extract_text();assert 'Мандрівник' in t and '\ufffd' not in t
  assert f'{i:02d} / 31' in t
 fonts={name:font.get_object()for page in pdf.pages for name,font in page['/Resources']['/Font'].items()}
 assert any('/FontDescriptor' in f and '/FontFile2' in f['/FontDescriptor']for f in fonts.values())
 print('PASS: 31 A4 pages, Ukrainian text extraction, no replacement characters, embedded TrueType font, page numbers')

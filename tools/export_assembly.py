#!/usr/bin/env python3
"""Export the same parts and assembly steps used by the A4 manual to the web app."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'assembly/sources'))
from robot_model import parts,G,P,wire_paths,TRACE,MESH,BATTERY
from assembly_steps import PAGES
steps=[dict(id='prepare',title='Зберімо твого Мандрівника',stage=18,new=None,lift=0,preview=True,
    need='2 платформи • 4 мотори • 4 колеса • відсік AA • підготовлена електроніка',
    action='Обертай модель, щоб роздивитися майбутню машинку. Розклади деталі й поклич напарника. Один складає, другий перевіряє!',
    check='Учитель підготував кріплення й проводку. S1 вимкнений, AA вийняті, USB комп’ютера від’єднаний.',arrows=[])]
for page,p in enumerate(PAGES,1):
    if p['kind']=='build': steps.append({**p,'id':f'page-{page:02}','page':page})
    elif p['kind']=='inspection':steps.append(dict(id='inspection',page=page,title=p['title'],stage=17,new=None,lift=0,need='Робот без AA • допомога вчителя',
        action='Передай робот учителю. Разом перевірте роз’єми, ізоляцію, гвинти та вільне обертання коліс.',check='Плюс і мінус звірені зі схемою. Проводи не дістають коліс. Відсік закріплений знизу; доступ до AA вільний.',arrows=[]))
steps += [dict(id='complete',title='Ти зібрав машинку!',stage=18,new=None,lift=0,preview=True,need='Готова конструкція • перевірка вчителя',
    action='Знайди чотири колеса, п’ять очей, плату ESP32 та головний вимикач. Покажи напарнику відсік знизу та перевір його утримання.',
    check='Готовність до руху підтверджує вчитель після перевірки напруг, струмів і кожного мотора.',arrows=[]),
    dict(id='power',title='Перший запуск — разом з учителем',stage=18,new=None,lift=0,preview=True,need='Стійка підставка • чотири вільні колеса',
    action='Учитель уперше записує прошивку через USB самого ESP32: AA вийняті, J5 від’єднаний. Після USB він повертає живлення і перевіряє кожне колесо.',
    check='При ввімкненні робот стоїть. Після перевірки й калібрування повернися до блоків та обери «Перша подорож».',arrows=[])]
# Preserve exact vertex positions; de-duplicate within each part to keep ESP32 flash compact.
objects=[]
for i,p in enumerate(parts):
    vertices=[];index={};faces=[]
    for face in p.faces:
        indices=[]
        for v in face:
            v=tuple(round(x,5) for x in v)
            if v not in index:index[v]=len(vertices);vertices.append(v)
            indices.append(index[v])
        faces.append(indices)
    objects.append(dict(key=f'{p.id}-{i}',id=p.id,stage=p.stage,color=p.color,vertices=vertices,faces=faces))
data=dict(schema=2,status=G['status'],units=G['units'],axes=G['axes'],parts=objects,steps=steps,
    chassis=dict(status=TRACE['status'],openingCount=MESH['openingCount'],length=TRACE['length_mm'],width=TRACE['width_mm'],thickness=MESH['thickness_mm'],clearGap=MESH['clear_gap_mm']),
    battery=BATTERY,display=G['assembly_display'],
    wires=wire_paths(18),liftedWires=wire_paths(18,82),
    sourceSHA256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'assembly/sources/geometry.json',ROOT/'assembly/sources/robot_model.py',ROOT/'assembly/sources/assembly_steps.py',ROOT/'assembly/sources/chassis_geometry.py',ROOT/'assembly/sources/chassis-photo-trace.json',ROOT/'assembly/sources/chassis-planar-mesh.json',ROOT/'assembly/sources/battery-measurements.json']})
target=ROOT/'web/src/assembly/model-data.json';target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'web/public/wiring.svg').write_bytes((ROOT/'docs/wiring.svg').read_bytes())
print(f'Exported {len(objects)} parts, {len(steps)} steps, {target.stat().st_size:,} bytes; reviewed chassis; component mounts remain schematic.')

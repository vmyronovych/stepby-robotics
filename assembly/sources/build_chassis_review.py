"""Review artifacts from retained photo observations. Never a drilling template."""
from pathlib import Path
import json, html, base64
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
ROOT=Path(__file__).resolve().parents[2]
j=json.loads((ROOT/'assembly/sources/chassis-photo-trace.json').read_text())
battery=json.loads((ROOT/'assembly/sources/battery-measurements.json').read_text())
BW,BL,BH=battery['width_mm'],battery['length_mm'],battery['height_with_cells_mm']
OUT=ROOT/'assembly';PUB=ROOT/'web/public';OUT.mkdir(exist_ok=True)
for name,file in [('UA','Arial.ttf'),('UAB','Arial Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+file))
colors={'round':'#4164a0','slot':'#208575'}
def uv(p):x,y=p;return (127.5-y,x+75)
def path(points,convert=uv):return 'M '+' L '.join(f'{a:.3f},{b:.3f}' for a,b in map(convert,points))+' Z'
outline=j['outline']['polygon_xy'];features=j['features'];allpath=' '.join(path(ps) for ps in [outline]+[f['polygon_xy'] for f in features])
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -16 279 184" role="img" aria-label="Пластина 255 на 150 міліметрів: контур та 72 отвори за фотографіями">', '<style>text{font-family:Arial,sans-serif}.hole{fill:transparent;stroke:#346187;stroke-width:.2;cursor:pointer}.hole:hover,.hole.selected{fill:#ffb534;fill-opacity:.65;stroke:#774000;stroke-width:.6}.labels{pointer-events:none}.labels text{font-size:2.2px;fill:#254364;paint-order:stroke;stroke:white;stroke-width:.8;stroke-linejoin:round} .size{font-size:3.4px;fill:#294457}</style>',f'<path d="{allpath}" fill="#e2cf9b" fill-rule="evenodd" stroke="#5f563e" stroke-width=".35"/>']
for f in features:svg.append(f'<path tabindex="0" role="button" class="hole" data-id="{f["id"]}" aria-label="Отвір {f["id"]}, фото {f["source_image"]}, координати оцінні" d="{path(f["polygon_xy"])}"><title>{f["id"]} · фото {f["source_image"]} · оцінка за фото</title></path>')
svg.append('<g class="labels">')
for f in features:
 pts=[uv(p) for p in f['polygon_xy']];x=sum(p[0] for p in pts)/len(pts);y=sum(p[1] for p in pts)/len(pts)
 # Place circular-aperture labels beside their centres to avoid filling small holes.
 dx=3 if f['id'].startswith('H') else 0;dy=-2.5 if f['id'].startswith('H') else .8
 svg.append(f'<text x="{x+dx:.2f}" y="{y+dy:.2f}" text-anchor="middle">{f["id"]}</text>')
svg+=['</g>','<g fill="none" stroke="#546d79" stroke-width=".25"><path d="M0,-5 H255 M0,-7 V-3 M255,-7 V-3 M-5,0 V150 M-7,0 H-3 M-7,150 H-3"/></g>','<g class="size"><text x="127.5" y="-8" text-anchor="middle">255 мм — вимір користувача</text><text transform="translate(-8,75) rotate(-90)" text-anchor="middle">150 мм — вимір користувача</text><text x="-3" y="78" text-anchor="end">A</text><text x="258" y="78">B</text><text x="127.5" y="161" text-anchor="middle">Розташування отворів оцінене за фото. Не шаблон для свердління.</text></g></svg>']
cx,cy=uv(battery['display_pose']['centre_xy_mm'])
svg.insert(-1,f'<g id="batteryFootprint" pointer-events="none"><rect x="{cx-BL/2}" y="{cy-BW/2}" width="{BL}" height="{BW}" fill="#236eb4" fill-opacity=".12" stroke="#236eb4" stroke-width=".5" stroke-dasharray="2 1"/><text x="{cx}" y="{cy-BW/2-2}" text-anchor="middle" font-family="Arial" font-size="3" fill="#164e89">Відсік {BL} × {BW} мм · під пластиною, положення приблизне</text></g>')
svg='\n'.join(svg)
(OUT/'chassis-review.svg').write_text(svg)
(PUB/'chassis-review.svg').write_text(svg)
# Auditable overlay: original image is embedded without resampling or modification.
photo=ROOT/'assembly/references/2026-10-15/03-width-end.png'
b64=base64.b64encode(photo.read_bytes()).decode();u0,v0,u1,v1=j['normalization']['pixel_bounds']
def back(p):x,y=p;return (u0+(127.5-y)/255*(u1-u0),v0+(x+75)/150*(v1-v0))
overlay=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200"><image width="1600" height="1200" href="data:image/png;base64,{b64}"/>'
overlay+=f'<path d="{path(outline,back)}" fill="none" stroke="#ff3344" stroke-width="3"/>'
for f in features:overlay+=f'<path d="{path(f["polygon_xy"],back)}" fill="none" stroke="{"#00ffae" if f["source_image"]==3 else "#ffbf00"}" stroke-width="2"/>'
overlay+='</svg>'
(OUT/'references/2026-10-15/trace-overlay.svg').write_text(overlay)
# Standalone browser review, embedded vector only: no photo payload on the ESP32.
page='''<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Реальна пластина · Мандрівник</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ee;color:#233445;font:17px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}a{color:#245f98}h1{font-size:clamp(25px,4vw,40px);margin:16px 0 8px}p{max-width:920px}.note{background:#fff2d4;border:1px solid #ddc78d;border-radius:14px;padding:16px}.tools{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:18px 0}button{border:1px solid #bdc9cc;border-radius:9px;background:white;color:#233445;padding:10px 14px;font:inherit;cursor:pointer}#viewport{overflow:auto;background:white;border:1px solid #d7ddd7;border-radius:16px}#drawing{width:100%}svg{width:100%;display:block}#selection{padding:14px;background:#e7eee3;border-radius:10px;min-height:58px}.legend{font-size:15px;color:#52666a}.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.facts section{background:white;border-radius:14px;padding:18px}h2{font-size:20px;margin:0 0 10px}li{margin:7px 0}@media(max-width:600px){main{padding:16px}.note{font-size:15px}}
</style><main><a href="/#assembly">← До гайда Мандрівника</a><h1>Реальна пластина шасі</h1><p>Верхня й нижня пластини однакові за повідомленням власника. Контур і 72 отвори відтворено за фотографіями від 15.10.2026.</p><p class="note"><strong>Карта для звірки.</strong> 255 × 150 мм — повідомлені габарити. Координати й розміри отворів оцінені з фото, точність ще не підтверджена. Виміряно: товщина пластини 3 мм, чистий проміжок 30 мм. За цією картою не свердлимо й не ріжемо.</p><section aria-label="Об’ємна модель корпусу"><div id="chassisPresentation" class="chassis-presentation"><h2>Дві пластини: 3 + 30 + 3 мм</h2><div id="chassis3d"></div><div class="tools"><label for="chassisComponentSelect">Деталі <select id="chassisComponentSelect"><option value="">Обери компонент</option><option value="chassis">Корпус</option><option value="BT1">Відсік AA</option></select></label><button id="chassisFullscreen" class="model-fullscreen-toggle" disabled>⛶ На весь екран</button><button data-chassis-view="iso">Об’ємний вигляд</button><button data-chassis-view="side">Збоку</button><button data-chassis-view="top">Зверху</button><button data-chassis-view="bottom">Знизу</button><label><input id="hideUpper" type="checkbox"> Приховати верхню</label><label><input id="showBattery" type="checkbox" checked> Відсік під платформою</label></div></div><p id="chassis3dStatus" role="status">Завантажуємо об’ємну модель…</p><p class="legend">Перетягуй, щоб обертати; коліщатко або жест двома пальцями змінюють масштаб. Розташування отворів оцінене за фото. Положення пластин взаємно суміщене; опори й кріплення ще не визначені. Синій прямокутний об’єм показує виміряний габарит відсіку, а не його внутрішні деталі.</p><p class="note"><strong>Відсік 4×AA: 62 × 58 × 18 мм.</strong> Між пластинами не поміщається — перевірено власником. Обрано розміщення під нижньою платформою: власник підтвердив посадку й відсутність контакту з підлогою. Власник повідомив зазор 3–4 мм; отвори відсіку зі штатними прорізами не збігаються. Обрано двосторонній скотч. Його товщина зменшить зазор, тому після приклеювання перевіряємо його повторно. У моделі показано габарит без шару скотчу: його товщина й точне положення ще невідомі. Доступ до AA — знизу при вимкненому живленні; утримання елементів потребує перевірки.</p></section><section class="note" aria-label="Кріплення відсіку"><h2>Приклеюємо відсік разом з учителем</h2><ol><li>Вимкни живлення, від’єднай USB, вийми AA.</li><li>Зніми захисний папір або плівку з місця приклеювання на акрилі. Очисть і висуши обидві поверхні.</li><li>Учитель наклеює скотч на суцільні ділянки дна відсіку, що прилягають до акрилу. Прорізи не є поверхнею приклеювання. Притисни та витримай час за інструкцією скотчу.</li><li>Встав AA, перевір утримання відсіку й елементів. Постав авто на колеса: відсік і дроти не мають торкатися підлоги чи коліс.</li><li>З учителем перевір повільний рух і поворот на рівній твердій поверхні. Якщо відсік чіпляє підлогу або відклеюється — зупини авто.</li></ol><p>Артикул, товщина та площа скотчу ще не визначені. Зазор 3–4 мм не підтверджує прохідність через стики, пороги чи килим.</p></section><h2>Карта отворів</h2><div class="tools"><button id="zoomIn">＋ Збільшити</button><button id="zoomOut">− Зменшити</button><button id="reset">Уся пластина</button><label><input type="checkbox" id="labels" checked> Номери отворів</label></div><div id="viewport"><div id="drawing">SVG_HERE</div></div><p id="selection" role="status">Натисни на отвір, щоб побачити його позначення.</p><p class="legend">H — малий круглий отвір · C — великий круглий отвір · R — прямокутний · X — хрестоподібний · S — довгий проріз. Це позначення карти, а не номери кріплень. A і B — торці; перед робота ще не призначено.</p><div class="facts"><section><h2>Що змінилося</h2><ul><li>Замість овальної пластини — контур реального шасі.</li><li>Відтворені виступи, вирізи біля коліс і видимі отвори.</li><li>Асиметричний X04 збережено за фото.</li></ul></section><section><h2>Ще потрібно виміряти</h2><ul><li>Зазор із AA після приклеювання; до приклеювання — 3–4 мм.</li><li>Товщину обраного скотчу та утримання відсіку після приклеювання.</li><li>Кріплення моторів та опор; положення відсіку на пластині.</li></ul></section></div><p><strong>Монтажна інструкція ще не готова.</strong> Старі розташування моторів, стійок та електроніки не перенесені на цю карту. Відповідність корпусу не доводить сумісності кріплень.</p></main><script>
let zoom=1;const drawing=document.querySelector('#drawing');function scale(){drawing.style.width=(zoom*100)+'%'}document.querySelector('#zoomIn').onclick=()=>{zoom=Math.min(4,zoom+.5);scale()};document.querySelector('#zoomOut').onclick=()=>{zoom=Math.max(1,zoom-.5);scale()};document.querySelector('#reset').onclick=()=>{zoom=1;scale();document.querySelector('#viewport').scrollTo(0,0)};document.querySelector('#labels').onchange=e=>document.querySelector('.labels').style.display=e.target.checked?'':'none';function select(el){document.querySelectorAll('.hole.selected').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');document.querySelector('#selection').textContent=el.getAttribute('aria-label')+'. Призначення для монтажу ще не визначене.'}document.querySelectorAll('.hole').forEach(el=>{el.onclick=()=>select(el);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(el)}}});
</script><script type="module" src="/src/assembly/chassis-review-3d.js"></script></html>'''.replace('SVG_HERE',svg)
(ROOT/'web/chassis-review.html').write_text(page)
# A4 landscape PDF; 1st page is the map, 2nd is the evidence/measurement sheet.
c=canvas.Canvas(str(OUT/'chassis-review.pdf'),pagesize=(841.89,595.28));c.setTitle('Мандрівник: реальна пластина — карта для звірки')
def text(x,y,s,size=12,bold=False):c.setFillColor(HexColor('#233445'));c.setFont('UAB' if bold else 'UA',size);c.drawString(x,y,s)
def lines(y,ss,size=13):
 for s in ss:text(36,y,s,size);y-=21
 return y
text(36,554,'Реальна пластина шасі',24,True)
text(36,530,'255 × 150 мм — дані власника. Контур і отвори — оцінка за фото від 15.10.2026.',12)
scale=2.65;ox=85;oy=90
def pdfxy(p):u,v=uv(p);return ox+u*scale,oy+(150-v)*scale
p=c.beginPath()
for poly in [outline]+[f['polygon_xy'] for f in features]:
 pts=[pdfxy(p) for p in poly];p.moveTo(*pts[0]);[p.lineTo(*q) for q in pts[1:]];p.close()
c.setFillColor(HexColor('#e2cf9b'));c.setStrokeColor(HexColor('#5f563e'));c.setLineWidth(.5);c.drawPath(p,fill=1,stroke=1,fillMode=0)
for f in features:
 pts=[pdfxy(p) for p in f['polygon_xy']];x=sum(p[0] for p in pts)/len(pts);y=sum(p[1] for p in pts)/len(pts)
 dx=7 if f['id'].startswith('H') else -5;dy=7 if f['id'].startswith('H') else -2
 text(x+dx,y+dy,f['id'],6)
c.setStrokeColor(HexColor('#236eb4'));c.setLineWidth(1);c.setDash(4,2);c.rect(ox+(127.5-BL/2)*scale,oy+(75-BW/2)*scale,BL*scale,BW*scale,fill=0,stroke=1);c.setDash()
text(ox+(127.5-BL/2)*scale,oy+(75+BW/2)*scale+6,f'Відсік {BL} × {BW} мм під пластиною: положення приблизне',8)
text(65,285,'A',15,True);text(775,285,'B',15,True)
text(36,54,'H / C — круглі · R — прямокутні · X — хрестоподібні · S — довгі прорізи.',12)
text(36,32,'Карта для звірки. Не шаблон для свердління. Масштаб друку не 1:1.',12,True);text(782,20,'1 / 3',10)
c.showPage();text(36,551,'Що підтвердити перед складанням',24,True)
lines(510,['Пластини однакові за повідомленням власника. Позначення отворів додані для обговорення.', 'Торці A та B не визначають перед і зад машинки. Номери H/C/R/X/S не означають', 'готових монтажних місць: кріплення моторів, опор і електроніки ще потрібно зіставити.'])
text(36,424,'Відомі розміри та наступні виміри',17,True)
lines(393,['Товщина пластини без плівки: 3 мм (вимір власника).', 'Чистий проміжок між пластинами: 30 мм (вимір власника).' , 'Довжина опор без різьби / діаметр різьби: __________ / __________', f'Відсік AA з елементами: {BL} × {BW} × {BH} мм (вимір власника).' , 'Зазор до приклеювання: 3–4 мм; після приклеювання з AA: __________ мм.', 'Отвори не збігаються. Кріплення: двосторонній скотч; товщина ще невідома.'])
text(36,239,'Відсік під нижньою платформою',17,True)
# Side profile, not a mounting drawing: no invented fasteners or support positions.
side_scale=420/j['length_mm']
for z in (0,33):
 c.setFillColor(HexColor('#d4c28f'));c.rect(42,110+z*side_scale,420,3*side_scale,fill=1,stroke=0)
text(482,170,'Верхня пластина: 3 мм',12)
c.setFillColor(HexColor('#8cb6db'));c.rect(42+210-BL*side_scale/2,110-BH*side_scale,BL*side_scale,BH*side_scale,fill=1,stroke=0)
text(482,151,'Між пластинами: 30 мм',12)
text(482,132,f'Відсік унизу: {BH} мм, без кріплення',12)
text(482,111,'Нижня пластина: 3 мм',12)
text(36,68,'Скотч зменшить зазор. Після приклеювання перевірити утримання й рух із AA.',12)
text(36,53,'Джерело: фотографії та виміри пластин і відсіку від власника, 14–15.10.2026.',11)
text(36,31,'Мандрівник · карта пластини для звірки · 15.10.2026',11);text(782,20,'2 / 3',10)
c.showPage();text(36,551,'Кріпимо відсік двостороннім скотчем',23,True)
text(36,520,'Разом з учителем. Відсік під нижньою платформою; отвори не збігаються.',13)
for y,title,body in [
 (470,'1. Вимкни живлення',['Від’єднай USB, вийми AA. Переверни шасі для доступу знизу.']),
 (400,'2. Підготуй місце',['Зніми захисний папір або плівку з акрилу в місці приклеювання.', 'Очисть і висуши акрил та дно відсіку.']),
 (310,'3. Приклей разом з учителем',['Скотч має прилягати до суцільних ділянок дна й акрилу, не до прорізів.', 'Притисни та витримай час за інструкцією виробника скотчу.']),
 (220,'4. Перевір зі вставленими AA',['Відсік і елементи тримаються. Дроти не торкаються коліс чи підлоги.', 'Постав на колеса й виміряй зазор. До скотчу власник виміряв 3–4 мм.']),
 (130,'5. Повільний пробний рух',['Перевір із учителем рух і поворот на рівній твердій поверхні.', 'Якщо відсік чіпляє підлогу або відклеюється — зупини авто.'])]:
 text(36,y,title,17,True);lines(y-27,body,13)
text(36,35,'Товщина, артикул і площа скотчу ще невідомі. Стики, пороги й килим не перевірені.',11)
text(782,20,'3 / 3',10);c.save()
print('Created chassis-review.svg, chassis-review.pdf, interactive web page and photo overlay.')

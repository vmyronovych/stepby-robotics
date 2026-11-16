from pathlib import Path
from html import escape
R=Path(__file__).resolve().parents[1]
a=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1780" viewBox="0 0 1600 1780"><title>Мандрівник: живлення, сигнали та роз’єми</title><rect width="1600" height="1780" fill="white"/><style>text{font-family:Arial,DejaVu Sans,sans-serif;fill:#142d49}.title{font-size:30px;font-weight:bold}.head{font-size:23px;font-weight:bold}.body{font-size:19px}.small{font-size:16px}.wire{fill:none;stroke:#c44747;stroke-width:4}.gnd{fill:none;stroke:#283e53;stroke-width:3}</style>']
def text(x,y,s,cls='body'):a.append(f'<text x="{x}" y="{y}" class="{cls}">{escape(s)}</text>')
def box(x,y,w,h,title,lines=(),color='#eef4f9'):
    a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{color}" stroke="#92a7b9"/>');text(x+15,y+29,title,'head')
    for i,s in enumerate(lines):text(x+15,y+58+25*i,s)
def line(points,cls='wire'):
    a.append(f'<polyline points="'+ ' '.join(f'{x},{y}'for x,y in points)+f'" class="{cls}"/>')
def dot(x,y):a.append(f'<circle cx="{x}" cy="{y}" r="5" fill="#c44747"/>')
text(40,48,'Мандрівник • Електрична схема для вчителя','title')
text(40,80,'ESP-WROOM-32 / DevKit V1 30-pin + плата розширення 30P. Номери GPIO не є номерами ніжок.','body')
box(40,112,225,105,'BT1 • 4×NiMH AA',['4,8 В номінально','Тримач уже в наборі'])
box(310,112,175,105,'F1 • T3,15A',['Біля плюса BT1','Закритий тримач'])
box(530,112,220,105,'S1 • SPST',['≥5 А DC / ≥12 В','Вимикає весь робот'])
box(795,112,285,105,'D0 • SS54',['Анод ← S1','Катод (смуга) → VBAT_SW'])
for start,end in [(265,310),(485,530),(750,795)]:line([(start,158),(end,158)])
line([(1080,158),(1500,158),(1500,253),(270,253)])
text(1140,145,'VBAT_SW після D0','head')
for x in (270,740,1240):line([(x,253),(x,290)]);dot(x,253)
box(40,290,460,185,'D1 • Pololu DRV8833 #2130',['VIN ← VBAT_SW; GND → зірка','AOUT1 / AOUT2 → JM1.1 / JM1.2 → LF','BOUT1 / BOUT2 → JM2.1 / JM2.2 → RF','VMM → C5 470 мкФ + C5a 100 нФ → GND','nSLEEP: штатний стан, НЕ до ESP32'])
box(520,290,460,185,'D2 • Pololu DRV8833 #2130',['VIN ← VBAT_SW; GND → зірка','AOUT1 / AOUT2 → JM3.1 / JM3.2 → LR','BOUT1 / BOUT2 → JM4.1 / JM4.2 → RR','VMM → C6 470 мкФ + C6a 100 нФ → GND','nSLEEP: штатний стан, НЕ до ESP32'])
box(1000,290,550,185,'F2 T1A → U2 S13V30F5 #4082',['VIN після F2; GND → зірка; EN відкритий','C7 100 мкФ / 16 В: VIN (+) → GND (−)','5 В → J5.1 → Micro-USB 30P → VIN','GND → J5.2 → Micro-USB GND → ESP32','C8 470 мкФ + C8a 100 нФ: 5V → GND'])
line([(270,475),(270,540)],'gnd');line([(740,475),(740,540)],'gnd');line([(1240,475),(1240,540)],'gnd');line([(150,217),(150,235),(20,235),(20,540),(1520,540)],'gnd')
text(45,565,'BT1− → спільна GND зірка; окремі силові повернення від D1, D2 та U2','head')
text(45,597,'C1–C4: 100 нФ безпосередньо між двома клемами кожного мотору. Моторні клеми НЕ з’єднувати з GND.')
text(45,627,'C5/C6: 16 В; C8: 10 В. Плюси електролітів до відповідного плюса. VMM двох драйверів НЕ об’єднувати.')
box(40,662,470,303,'JD1 • сигнали передніх моторів',[
'1  GND','2  GPIO16 (D16/RX2) → D1 AIN1','3  GPIO17 (D17/TX2) → D1 AIN2','4  GPIO18 (D18) → D1 BIN1','5  GPIO19 (D19) → D1 BIN2','6  D1 nFAULT → GPIO21 (D21)','Кожний AIN/BIN: 10 кΩ до GND','nFAULT: окремі 10 кΩ до 3V3','AISEN, BISEN: по 0,25 Ω → GND'])
box(530,662,470,303,'JD2 • сигнали задніх моторів',[
'1  GND','2  GPIO23 (D23) → D2 AIN1','3  GPIO25 (D25) → D2 AIN2','4  GPIO26 (D26) → D2 BIN1','5  GPIO27 (D27) → D2 BIN2','6  D2 nFAULT → GPIO22 (D22)','Кожний AIN/BIN: 10 кΩ до GND','nFAULT: окремі 10 кΩ до 3V3','AISEN, BISEN: по 0,25 Ω → GND'])
box(1020,662,530,303,'JS • QTR-MD-05A #4245',[
'1  ESP32 3V3 (3V3) → QTR VCC','2  ESP32 GND → QTR GND','3  Крайній лівий OUT1 → GPIO32 (D32)','4  OUT2 → GPIO33 (D33)','5  Середній OUT3 → GPIO34 (D34)','6  OUT4 → GPIO35 (D35)','7  Крайній правий OUT5 → GPIO36 (VP)','CTRL відкритий; штатний pull-up','C10 10 мкФ + C10a 100 нФ: VCC → GND'])
text(45,1002,'Чотири шунти 0,25 Ω ±1%, ≥0,5 Вт: вирізати штатні обхідні перемички AISEN/BISEN за інструкцією Pololu.')
text(45,1030,'Номінальний ліміт 0,8 А/мотор; розрахунковий допуск 0,69–0,91 А. Перевірити реально перед класом.')
box(40,1062,720,260,'Батарейний ADC • GPIO39 / VN',[])
line([(75,1142),(255,1142)]);box(255,1115,150,60,'R9 100 кΩ',[]);line([(405,1142),(500,1142)])
text(75,1121,'VBAT_SW');dot(490,1142);text(518,1125,'GPIO39')
line([(490,1142),(490,1200)],'gnd');box(408,1200,165,60,'R10 100 кΩ',[]);line([(490,1260),(490,1290)],'gnd');text(590,1288,'GND')
line([(490,1142),(650,1142),(650,1200)],'gnd');text(591,1224,'C9 100 нФ');line([(650,1235),(650,1290),(490,1290)],'gnd')
text(65,1298,'Поріг 4,2 В після D0; калібрувати мультиметром.','small')
box(780,1062,770,118,'JB • кнопка лінія / програма / стоп',['JB.1 → GPIO13 (D13); JB.2 → GND','Нормально розімкнена; INPUT_PULLUP; програмний debounce 40 мс'])
box(780,1200,770,122,'JP • розподільник живлення',['XT30 «+» → VBAT_SW; «−» → GND','Не плутати JP з сервісним J5 (регульовані 5 В).','Роз’єми промарковані з обох боків; pin 1 позначає вчитель.'])
box(40,1350,1510,166,'Правила підключення',[
'Усі 17 GPIO унікальні. Аналогові входи тільки ADC1. Жоден GPIO не отримує 5 В або моторну напругу.',
'Перед USB: S1 вимкнути, AA зняти, J5 фізично роз’єднати. USB та зовнішні 5 В не живлять плату одночасно.',
'JD1/JD2 = XH-6; JS = XH-7; JM1…JM4, J5, JB = XH-2. XH на 30P немає: сигнальні кінці → S/G/3V3.',
'30P: перемичка 3.3V; S = GPIO, V = живлення, G = земля. DC та USB-C вільні. USB для запису — на ESP32.'])
box(40,1540,1510,172,'До першого запуску',[
'Виміряти струми всіх моторів. Перевірити контакти 4×AA при 2 А, тепловий режим та старт під обмеженням струму.',
'Перевірити Micro-USB 30P → VIN, полярність, шину V=3,3 В, просідання при Wi-Fi. Схема 30P ще не випробувана.',
'Уся проводка, пайка, зміна шунтів і захист контактів готуються дорослим. Діти з’єднують готові підписані джгути.',
'Повна таблиця мереж: docs/wiring.md. Таблиця ніжок: docs/gpio-map.md. Приймання: validation/bench-checklist.md.'])
text(40,1750,'Версія 12.10.2026 • Сигнальні мережі позначені назвами, без перехрещення ліній. Масштаб довільний.','small')
a.append('</svg>');(R/'docs/wiring.svg').write_text('\n'.join(a))
print('Created docs/wiring.svg')

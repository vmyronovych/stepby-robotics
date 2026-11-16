import {MOTOR_CONTACTS} from './motor-contacts.js';
import {hw627Pins} from './hw627.js';
import {ESP_PINS,EXPANSION_PINS} from './board-layouts.js';
// Project connections: docs/gpio-map.md, docs/wiring.md, firmware/src/config.h.
// Physical module layouts follow the user-supplied photos; old wiring needs revalidation.
const pin=(name,group,role,connection,note='')=>({name,group,role,connection,note});
function driver(id,gpios,fault,motors){
 const front=id==='D1';
 return {id,title:`${id} · драйвер моторів`,subtitle:'DRV8833 · HW-627',model:'hw627',stage:12,
 summary:`Допомагає мозку обертати два ${front?'передні':'задні'} колеса.`,
 facts:['12 контактів','Чорна плата HW-627','Відтворено за фото'],
 diagramNote:'Порядок контактів відтворено зі схеми продавця. Схема показує зворотний бік; при перевертанні плати лівий і правий ряди міняються місцями.',
 pins:hw627Pins(id,gpios,fault,motors),
 notes:['Розміри та дрібні деталі 3D оцінено за фотографіями — це навчальна реконструкція, не виміряна CAD-модель.',
 'Карта GPIO — приклад підключення. Стан J1 та налаштування обмеження струму вашого HW-627 у моделі не визначені.',
 'Попередні PDF і електрична схема описують Pololu #2130. Їхні VMM, AISEN, BISEN і модифікації шунтів не є інструкцією для цієї плати.'],
 source:{label:'Фото та схема Uamper · артикул 11309',url:'https://uamper.com/index.php?route=product/product&product_id=1309'},related:front?['D2','ESP32','M1','M2']:['D1','ESP32','M3','M4']};
}
export const COMPONENTS={
 D1:driver('D1',[16,17,18,19],21,['JM1','JM2']),
 D2:driver('D2',[23,25,26,27],22,['JM3','JM4']),
 ESP32:{id:'ESP32',title:'ESP32 · мозок машинки',subtitle:'Ваш модуль · 38 контактів',model:'esp32',stage:11,
 summary:'Читає датчики й надсилає команди колесам.',facts:['2 ряди по 19 контактів','Micro-USB','Логіка 3,3 В'],pins:ESP_PINS,
 diagramNote:'Вигляд зі сторони компонентів: антена зверху, USB знизу. Підписи та порядок контактів — з ваших фотографій.',
 notes:['Габарити моделі оцінені за фото. Посадку в плату розширення ще потрібно звірити.', 'SD0–SD3, CMD та CLK залишаємо для пам’яті. GPIO34–39 тільки вхідні.', 'Попередня документація 30P описує іншу плату. Сумісність живлення й монтажу перевіряється окремо.'],related:['D1','D2','QTR','30P']},
 '30P':{id:'30P',title:'Плата розширення · 38P',subtitle:'ESP32S 38P/4 · за вашим фото',model:'expansion',stage:10,
 summary:'Допомагає під’єднати датчики й драйвери до мозку.',facts:['Сигнал S','Живлення V','Земля G'],pins:EXPANSION_PINS,
 diagramNote:'Розташування гнізд і рядів S/V/G — за фотографією. Два нижні ряди гнізд показані окремо; механічну сумісність перевірити на платі.',
 notes:['Ідентифікатор 30P у коді залишено для сумісності зі старим посібником; відображається ваша плата 38P.', 'Розміри — пропорції фото. Положення перемички JUMP у 3D не є рекомендацією напруги.', 'Перед монтажем перевірити напругу V–G, полярність і шлях живлення. Напис DC6.5–16V відтворює маркування на фото.', 'JS, JD1 і JD2 — назви проєктних джгутів, а не готових гнізд цієї плати.', 'USB плати розширення використовується для живлення; прошивання — через USB самого ESP32.'],related:['ESP32','U2']},
 QTR:{id:'QTR',title:'Датчик лінії',subtitle:'Pololu QTR-MD-05A · #4245',stage:8,summary:'П’ять аналогових каналів бачать поверхню під машинкою.',facts:['37 × 20 × 2,5 мм','Живлення в проєкті 3,3 В'],pins:[pin('VCC','Живлення','Живлення','3V3 · JS.1'),pin('GND','Живлення','Земля','GND · JS.2'),...[32,33,34,35,36].map((g,i)=>pin(`OUT${i+1}`,'Датчики',`Канал ${i+1}${i===0?' · крайній лівий':i===4?' · крайній правий':''}`,`GPIO${g} · JS.${i+3}`))],notes:['Номери JS — контакти нашого джгута. Написи на самому датчику звіряє вчитель.','П’ять віконець дивляться вниз. Робочий зазор перевіряють перед калібруванням.'],related:['ESP32']},
 U2:{id:'U2',title:'U2 · стабілізатор 5 В',subtitle:'Pololu S13V30F5 · #4082',stage:13,summary:'Живить електроніку стабілізованими 5 В. Мотори мають окрему гілку живлення.',facts:['22,9 × 22,9 × 9,7 мм'],pins:[pin('VIN','Живлення','Вхід','VBAT_SW через F2 T1A'),pin('GND','Живлення','Земля','GND-зірка та J5.2'),pin('VOUT','Живлення','Вихід 5 В','J5.1 → вхід живлення плати розширення (перевірити)'),pin('EN','Керування','Дозвіл роботи','Залишити штатно увімкненим · не вести на GPIO')],notes:['Перед вставленням ESP32 учитель вимірює 4,85–5,15 В на виході без навантаження.'],related:['30P','BT1']},
 BT1:{id:'BT1',title:'BT1 · відсік AA',subtitle:'Чотири акумулятори NiMH',stage:6,summary:'Відсік під нижньою платформою, кріплення двостороннім скотчем.',facts:['62 × 58 × 18 мм'],pins:[pin('+','Живлення','Плюс батареї','F1 T3,15A → S1 → D0 → VBAT_SW'),pin('−','Живлення','Мінус батареї','GND-зірка')],notes:['Зазор 3–4 мм повідомлено до приклеювання. Остаточний зазор виміряти з AA та скотчем.','Точне положення та товщина скотчу ще невідомі.'],related:['U2','D1','D2']},
 chassis:{id:'chassis',title:'Корпус машинки',subtitle:'Дві однакові акрилові пластини',stage:1,summary:'Контур і 72 отвори відтворено за фотографіями реального шасі.',facts:['255 × 150 мм','Товщина 3 мм','Проміжок 30 мм'],pins:[],notes:['Контур оцінений за фото. Положення кріплень треба звірити з реальними деталями.'],related:['BT1']},
 button:{id:'button',title:'Кнопка старт / стоп',subtitle:'GPIO13',stage:13,summary:'Кнопка до землі. Контролер використовує внутрішнє підтягування.',facts:[],pins:[pin('Сигнал','Керування','Вхід кнопки','GPIO13'),pin('GND','Керування','Земля','GND')],notes:[],related:['ESP32']},
 switch:{id:'switch',title:'S1 · головний вимикач',subtitle:'Розмикає живлення машинки',stage:13,summary:'Фізичне вимкнення живлення від батарей.',facts:[],pins:[pin('Контакт 1','Живлення','Вхід','Вихід F1'),pin('Контакт 2','Живлення','Вихід','Анод D0 SS54')],notes:['Програмний STOP не замінює цей вимикач.'],related:['BT1']},
};
for(let i=0;i<4;i++){
 const id=`M${i+1}`,driver=i<2?'D1':'D2',channel=i%2?'B':'A',location=['лівий передній','правий передній','лівий задній','правий задній'][i];
 COMPONENTS[id]={id,title:`${id} · ${location} мотор`,subtitle:'Жовтий мотор-редуктор · за вашим фото',model:'motor',stage:i===0?2:3,summary:'Перетворює електрику на обертання колеса.',facts:['Два проводи','Редуктор','Вал для колеса'],pins:[
 {name:'red',label:'Червоний провід',...MOTOR_CONTACTS[0],group:'Мотор',role:'Провід до драйвера',short:'Разом із другим проводом обертає мотор.',destination:driver,target:driver,connection:`${driver} OUT${i%2?3:1} · JM${i+1}.1 (проєктне підключення)`,color:'#c65450',icon:'motor',direction:'in'},
 {name:'black',label:'Чорний провід',...MOTOR_CONTACTS[1],group:'Мотор',role:'Провід до драйвера',short:'Драйвер змінює напрям струму — колесо їде назад.',destination:driver,target:driver,connection:`${driver} OUT${i%2?4:2} · JM${i+1}.2 (проєктне підключення)`,color:'#596875',icon:'motor',direction:'in'}],
 notes:['Колір проводів не означає постійний плюс і мінус: обидва під’єднуються до виходів драйвера, не до GND.', 'Зовнішній вигляд відтворено з фото. Точна напруга, передатне число, струм і розміри за цим зображенням не встановлені.', 'Напрям обертання й відповідність виходів перевіряє вчитель.'],source:{label:'Мотор Uamper · product_id=3011',url:'https://uamper.com/index.php?route=product/product&product_id=3011'},related:[driver]};
}
export function componentKey(part){
 const id=part?.id||'';
 const driver=id.match(/^(?:driver|driverchip|drivercap|driverMount)([01])$/);
 if(driver)return driver[1]==='0'?'D1':'D2';
 if(id==='driversocket')return part.vertices?.[0]?.[0]<0?'D1':'D2';
 if(['regulator','inductor','regMount'].includes(id))return 'U2';
 if(/^button/.test(id))return 'button';if(/^switch/.test(id))return 'switch';
 if(['lower','upper'].includes(id)||/^post|^upperthumb/.test(id))return 'chassis';
 if(id==='batteryEnvelope'||/^cell\d/.test(id))return 'BT1';
 const motor=id.match(/^(?:motor|motorcan|shaft|wheel|hub|hubcap)([0-3])$/);if(motor)return `M${+motor[1]+1}`;
 if(part?.stage===11)return 'ESP32';if(part?.stage===10)return '30P';if(part?.stage===8)return 'QTR';
 return null;
}

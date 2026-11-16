// Component-side order transcribed from the user's photos, antenna at the top.
// Coordinates are illustrative display units, not a measured mechanical drawing.
export const ESP_LEFT=['3V3','EN','SP','SN','GPIO34','GPIO35','GPIO32','GPIO33','GPIO25','GPIO26','GPIO27','GPIO14','GPIO12','GND','GPIO13','SD2','SD3','CMD','5V'];
export const ESP_RIGHT=['GND','GPIO23','GPIO22','TX','RX','GPIO21','GND','GPIO19','GPIO18','GPIO5','GPIO17','GPIO16','GPIO4','GPIO0','GPIO2','GPIO15','SD1','SD0','CLK'];
const gpioConnections={16:'D1 IN1',17:'D1 IN2',18:'D1 IN3',19:'D1 IN4',23:'D2 IN1',25:'D2 IN2',26:'D2 IN3',27:'D2 IN4',21:'D1 FAULT',22:'D2 FAULT',32:'QTR OUT1',33:'QTR OUT2',34:'QTR OUT3',35:'QTR OUT4',36:'QTR OUT5',39:'Дільник напруги батарей',13:'Кнопка старт / стоп'};
function signal(label){
 const n=['SP','SVP'].includes(label)?36:['SN','SVN'].includes(label)?39:Number(label.replace('GPIO',''));
 if(label==='GND')return {role:'Спільний «мінус»',short:'Земля електроніки.',destination:'Спільна земля',connection:'GND',color:'#63727a',icon:'ground',direction:'none'};
 if(['3V3','5V'].includes(label))return {role:'Живлення',short:label==='3V3'?'Живлення 3,3 вольта.':'Контакт живлення з написом 5V.',destination:label,connection:label,color:'#dc8a30',icon:'battery',note:'Напругу та шлях живлення перевірити перед підключенням.'};
 if(['SD0','SD1','SD2','SD3','CMD','CLK'].includes(label))return {role:'Пам’ять програми',short:'Залишаємо для роботи пам’яті.',destination:'Пам’ять',connection:'Не використовуємо для периферії',color:'#8d819c',icon:'chip'};
 return {role:label==='EN'?'Перезапуск мозку':'Сигнал',short:label==='EN'?'Допомагає перезапустити контролер.':n>=34?'Цей контакт слухає датчики.':'Тут проходять команди або покази датчиків.',destination:gpioConnections[n]?.split(' ')[0]||'ESP32',connection:gpioConnections[n]||'Не призначено в проєкті',color:'#388fc4',icon:gpioConnections[n]?.startsWith('D')?'chip':gpioConnections[n]?.startsWith('QTR')?'eye':'brain',direction:n>=34||[21,22].includes(n)?'in':'out',note:n>=34?'GPIO34–39 — лише вхідні.':'Призначення в машинці взято з поточної карти GPIO; монтаж перевіряє вчитель.'};
}
export const ESP_PINS=[...ESP_LEFT.map((label,row)=>({label,name:`L${row+1}`,x:-12.7,y:22.86-row*2.54,z:1.2})),...ESP_RIGHT.map((label,row)=>({label,name:`R${row+1}`,x:12.7,y:22.86-row*2.54,z:1.2}))].map(p=>({...p,...signal(p.label),group:'Контакти ESP32'}));
// Explicit 17-column headers transcribed from the owner's expansion-board photo.
// Preserve existing column IDs: the missing 5V is appended as bottom-*-16.
const topSignals=['GPIO23','GPIO22','TX','RX','GPIO21','GPIO19','GPIO18','GPIO5','GPIO17','GPIO16','GPIO4','GPIO0','GPIO2','GPIO15','SD1','SD0','CLK'];
const expansionLeft=ESP_LEFT.map(p=>p==='SP'?'SVP':p==='SN'?'SVN':p);
const bottomSignals=['EN','SVP','SVN','GPIO34','GPIO35','GPIO32','GPIO33','GPIO25','GPIO26','GPIO27','GPIO14','GPIO12','GPIO13','SD2','SD3','CMD','5V'];
export const EXPANSION_PINS=[];
for(const [edge,labels,y] of [['top',ESP_RIGHT,13],['bottom',expansionLeft,-13],['wide',expansionLeft,-15.8]]){
 labels.forEach((label,i)=>EXPANSION_PINS.push({name:`socket-${edge}-${i}`,label:`${label} · ${edge==='wide'?'широке гніздо':'гніздо'}`,x:-31+i*2.54,y,z:3,...signal(label),group:'Гнізда ESP32'}));
}
for(const [edge,labels,sign]of [['top',topSignals,1],['bottom',bottomSignals,-1]])for(const [row,band,color]of [[0,'S','#398dcc'],[1,'V','#dc8a30'],[2,'G','#63727a']]){
 labels.forEach((label,i)=>EXPANSION_PINS.push({name:`${edge}-${band}-${i}`,label:`${label} · ${band}`,x:-31+i*2.54,y:sign*(25.08-row*2.54),z:4,group:`Ряд ${band}`,color,...(band==='S'?signal(label):band==='V'?{role:'Живлення периферії',short:'Напругу цього ряду обирає перемичка.',destination:'3,3 В / 5 В',connection:'Шина V; положення JUMP і напругу перевіряє вчитель',icon:'battery'}:{role:'Спільний «мінус»',short:'Земля для підключеного модуля.',destination:'Спільна земля',connection:'GND',icon:'ground',direction:'none'})}));
}

// Separate black 2×4 header beside the barrel jack, as printed in the photo.
// VCC is deliberately not assigned a voltage or a connection to the V rail.
for(const [row,labels,y]of [['top',['TX','RX','VCC','GND'],25.08],['bottom',['D22','D21','VCC','GND'],22.54]]){
 labels.forEach((label,i)=>EXPANSION_PINS.push({name:`aux-${row}-${i}`,label,x:14+i*2.54,y,z:4,group:'Окрема гребінка',...(['D21','D22'].includes(label)?signal(label.replace('D','GPIO')):label==='VCC'?{role:'Живлення VCC',short:'Контакт VCC. Напругу та внутрішній шлях живлення потрібно звірити.',connection:'VCC · напругу не підтверджено',destination:'VCC',icon:'battery',color:'#c19741'}:['TX','RX'].includes(label)?{role:'Обмін через USB',short:'Залишаємо для прошивання й обміну з комп’ютером.',connection:label==='TX'?'GPIO1 / TX':'GPIO3 / RX',destination:'USB',icon:'chip',color:'#8d819c'}:signal(label))}));
}

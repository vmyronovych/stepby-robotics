import {boardPins,supportsPin} from './usb-pins.js';
import {jumperVoltage} from './assembly/expansion-jumper.js';

const modes=[['write','Вихід · 0 / 1'],['pwm','ШІМ · 0…255'],['read','Вхід · 0 / 1'],['pullup','Кнопка · підтягування'],['analog','Аналоговий вхід · 0…4095']];
const kinds={signal:'Вхід / вихід',input:'Лише вхід',power:'Живлення',ground:'Земля',reserved:'Службовий контакт'};

// Use the same host-pin descriptions and capabilities as the ESP32 inspector.
// A column name on V/G is a physical address, never that column's GPIO.
export function expansionPinDocs(terminal){
 if(!terminal.id.startsWith('exp-'))return null;
 const {id,component}=terminal,aux=id.startsWith('exp-aux-');
 const band=aux?null:id.split('-')[2];
 const doc={title:terminal.label,kind:'',path:'',description:'',warning:'',modes:[],jumper:false};
 if(terminal.role==='ground')return {...doc,title:terminal.label,kind:'Земля',path:aux?'Окрема гребінка · GND':'Чорний ряд G → GND ESP32',description:'Спільний «мінус» для ESP32, датчиків і драйвера. З’єднай тут GND модуля. Це не програмований контакт.'};
 if(band==='V')return {...doc,title:'V · живлення модулів',kind:'Живлення',path:`JUMP → червоний ряд V → модуль`,description:`На схемі обрано ${String(jumperVoltage(component)).replace('.',',')} В. Перемичка JUMP обирає для ряду V живлення 3,3 В або 5 В.`,warning:'Цифра GPIO біля стовпчика стосується лише ряду S. Ряд V не передає команди. Звір перемичку й виміряй V відносно G на реальній платі.',jumper:true};
 if(aux&&terminal.role==='unknown')return {...doc,title:terminal.label,kind:'Живлення · напругу слід звірити',path:'Окрема гребінка · VCC',description:'Контакт живлення модуля. Це не GPIO.',warning:'Напруга VCC на цій гребінці не підтверджена. Положення JUMP її не визначає напевно: виміряй VCC відносно сусіднього GND разом із учителем.'};
 const host=boardPins.find(p=>p.id===terminal.hostPin)||(band==='S'&&terminal.voltage===5?boardPins.find(p=>p.label==='5V'):null);
 if(!host)return {...doc,kind:'Контакт плати розширення',description:'Звір маркування цього контакту з реальною платою.'};
 const name=host.gpio===null?host.label:`GPIO${host.gpio}`;
 return {...doc,title:host.gpio===null?terminal.label:name,kind:kinds[host.kind],path:`${terminal.label} → ${name} ESP32`,description:host.description,
  warning:host.kind==='power'?'Перед зовнішнім живленням звір напругу та розводку. Не поєднуй його з USB-живленням без підтвердженої розв’язки.':host.warning,
  modes:modes.filter(([action])=>supportsPin(host.gpio,action)).map(([,label])=>label),
  signalVoltage:host.gpio!==null?'Сигнали GPIO: 0–3,3 В. JUMP не змінює їхню напругу.':null,
  hostPin:host.id,
 };
}

import {getParameterScope} from './my-block-parameters.js';
import {ESP_LEFT,ESP_RIGHT} from './assembly/board-layouts.js';

// Classic ESP32-WROOM, 38-pin board photographed by the owner. UART0 stays
// reserved for uploading/startup verification; SD0–3/CMD/CLK belong to flash.
export const OUTPUT_PINS=[0,2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33];
export const INPUT_PINS=[...OUTPUT_PINS,34,35,36,39];
export const ANALOG_PINS=[0,2,4,12,13,14,15,25,26,27,32,33,34,35,36,39];
export const PULLUP_PINS=OUTPUT_PINS;
export const pinOptions=pins=>[...pins].sort((a,b)=>(b===2)-(a===2)).map(pin=>[`GPIO${pin}`,String(pin)]);
export function supportsPin(pin,action){return ({write:OUTPUT_PINS,pwm:OUTPUT_PINS,read:INPUT_PINS,pullup:PULLUP_PINS,analog:ANALOG_PINS}[action]||[]).includes(pin);}
export const pinActions={usb_pin_write:'write',usb_pin_pwm:'pwm',usb_pin_read:'read',usb_pin_button:'pullup',usb_pin_analog:'analog'};
// Blockly dropdowns replace invalid imported values with a default. Reject those
// values first so opening a project never silently changes a physical GPIO.
export function validatePinState(node,depth=0,scope=null){
 if(depth>80)throw Error('Програма надто вкладена.');
 if(!node||typeof node!=='object')return;
 if(Array.isArray(node.myBlocks))for(const def of node.myBlocks)validatePinState(def.body,depth+1,def);
 const action=pinActions[node.type]||(node.type==='my_block_pin'?'read':null),value=node.fields?.PIN;
 const parameter=typeof value==='string'&&value.startsWith('param:');
 if(parameter&&(!pinActions[node.type]||!scope?.parameters?.some(p=>p.id===value.slice(6)&&p.kind==='pin')))throw Error('Параметр піна доступний лише всередині своєї команди.');
 if(action&&!parameter&&value!==undefined&&(!/^\d+$/.test(String(value))||!supportsPin(Number(value),action)))throw Error('Цей пін не підтримує обрану дію. Перевір файл програми.');
 for(const [key,value] of Object.entries(node))if(key!=='myBlocks'&&value&&typeof value==='object')validatePinState(value,depth+1,scope);
}
export const boardPins=[...ESP_LEFT.map((label,row)=>({label,row,side:'left'})),...ESP_RIGHT.map((label,row)=>({label,row,side:'right'}))].map(p=>{
 const gpio=p.label==='SP'?36:p.label==='SN'?39:p.label.startsWith('GPIO')?Number(p.label.slice(4)):null;
 const id=`${p.side}-${p.row}`,strapping=[0,2,5,12,15].includes(gpio);
 let kind='reserved',description='Ці контакти з’єднані з пам’яттю програми. Залишаємо їх вільними.';
 if(p.label==='GND'){kind='ground';description='Спільний «мінус» для плати й підключених модулів.';}
 else if(['3V3','5V'].includes(p.label)){kind='power';description=p.label==='3V3'?'Живлення 3,3 В для сумісних датчиків.':'Контакт живлення 5 В. Це не програмований вихід.';}
 else if(p.label==='EN')description='Перезапуск ESP32. Це не програмований пін.';
 else if(['TX','RX'].includes(p.label))description=`GPIO${p.label==='TX'?1:3} · обмін із комп’ютером через USB. Залишаємо для прошивання й перевірки запуску.`;
 else if(gpio!==null){kind=OUTPUT_PINS.includes(gpio)?'signal':'input';description=gpio===2?'Блок «світлодіод» керує цим виходом. Вбудований LED підключений до GPIO2 лише на деяких платах. Індикатор USB може блимати незалежно від нього.':kind==='input'?'Слухає датчик. Передавати сигнал цим піном не можна.':'Може передавати команди або слухати датчик.';}
 return {...p,id,gpio,kind,strapping,description,warning:strapping?'Цей пін також бере участь у запуску плати. Зовнішнє підключення узгодь із учителем.':gpio>=34?'Лише вхід. Для кнопки потрібен зовнішній резистор.':''};
});

export function scopedPinOptions(pins){return function(){return [...(getParameterScope(this.getSourceBlock()?.workspace)?.parameters||[]).filter(p=>p.kind==='pin').map(p=>[`Параметр: ${p.name}`,`param:${p.id}`]),...pinOptions(pins)];};}

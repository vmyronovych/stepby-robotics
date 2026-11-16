import {Blockly,num} from './blocks.js';
import {remoteCommands} from './remote-commands.js';
import {WIRED_CATEGORY} from './wiring-state.js';
import {MY_BLOCKS_CATEGORY} from './my-blocks.js';
import {OUTPUT_PINS,INPUT_PINS,ANALOG_PINS,PULLUP_PINS,pinOptions,scopedPinOptions} from './usb-pins.js';
const pinField=pins=>({type:'field_dropdown',name:'PIN',options:scopedPinOptions(pins)});
Blockly.common.defineBlocksWithJsonArray([
 {type:'usb_print',message0:'вивести в консоль %1',args0:[{type:'field_input',name:'TEXT',text:'Привіт із ESP32!'}],previousStatement:null,nextStatement:null,colour:'#47766f',tooltip:'Текст від ESP32 у консолі під блоками. Залиш USB підключеним. До 120 байтів UTF-8.'},
 {type:'usb_remote',message0:'коли на телефоні %1 %2',args0:[{type:'field_dropdown',name:'EVENT',options:[['натиснуто','PRESS'],['відпущено','RELEASE']]},{type:'field_dropdown',name:'COMMAND',options:remoteCommands.map((name,index)=>[name,String(index+1)])}],nextStatement:null,colour:'#4078b8',tooltip:'Пульт: Wi-Fi машинки → http://192.168.4.1. Команди виконуються на ESP32. Не поєднуй із запуском при ввімкненні.'},
 {type:'usb_pin_write',message0:'пін %1 %2',args0:[pinField(OUTPUT_PINS),{type:'field_dropdown',name:'STATE',options:[['увімкнути · 1','ON'],['вимкнути · 0','OFF']]}],previousStatement:null,nextStatement:null,colour:'#238b89',tooltip:'Цифровий вихід: 1 = 3,3 В; 0 = 0 В.'},
 {type:'usb_pin_pwm',message0:'пін %1 ШІМ %2 / 255',args0:[pinField(OUTPUT_PINS),{type:'input_value',name:'DUTY',check:'Number'}],previousStatement:null,nextStatement:null,colour:'#238b89',tooltip:'PWM: 0 — вимкнено, 255 — максимум. Частота 5 кГц.'},
 {type:'usb_pin_read',message0:'сигнал на %1 = 1',args0:[pinField(INPUT_PINS)],output:'Boolean',colour:'#238b89',tooltip:'Цифровий вхід без підтягування: високий рівень = істина.'},
 {type:'usb_pin_button',message0:'кнопку на %1 натиснуто',args0:[pinField(PULLUP_PINS)],output:'Boolean',colour:'#238b89',tooltip:'Внутрішнє підтягування до 3,3 В. Підключи кнопку між цим піном та GND.'},
 {type:'usb_pin_analog',message0:'датчик на %1 · 0…4095',args0:[pinField(ANALOG_PINS)],output:'Number',colour:'#238b89',tooltip:'Аналоговий вхід, 12 біт. Подавай лише сигнал у межах 0–3,3 В.'},
 {type:'usb_start',message0:'коли плата увімкнеться',nextStatement:null,colour:'#E4A321',tooltip:'Програма запускається після прошивання або перезапуску ESP32.'},
 {type:'usb_led',message0:'світлодіод GPIO2 %1',args0:[{type:'field_dropdown',name:'STATE',options:[['увімкнути','ON'],['вимкнути','OFF']]}],previousStatement:null,nextStatement:null,colour:'#A767D6',tooltip:'Керує GPIO2. Потрібен світлодіод, підключений саме до GPIO2; на деяких платах вбудованого LED на цьому піні немає.'},
 {type:'usb_forever',message0:'завжди %1',args0:[{type:'input_statement',name:'DO'}],previousStatement:null,colour:'#C98B21',tooltip:'Повторює вкладені блоки до вимкнення або нового прошивання.'},
]);
export const usbToolbox={kind:'categoryToolbox',contents:[
 MY_BLOCKS_CATEGORY,
 WIRED_CATEGORY,
 {kind:'category',name:'Консоль',colour:'#47766f',contents:[{kind:'block',type:'usb_print'}]},
 {kind:'category',name:'Телефон',colour:'#4078b8',contents:[{kind:'block',type:'usb_remote'}]},
 {kind:'category',name:'Початок',colour:'#E4A321',contents:[{kind:'block',type:'usb_start'}]},
 {kind:'category',name:'Світлодіод',colour:'#A767D6',contents:[{kind:'block',type:'usb_led',fields:{STATE:'ON'}},{kind:'block',type:'usb_led',fields:{STATE:'OFF'}}]},
 {kind:'category',name:'Піни',colour:'#238b89',contents:[{kind:'block',type:'my_block_pin'},{kind:'block',type:'usb_pin_write',fields:{PIN:'2'}},{kind:'block',type:'usb_pin_pwm',fields:{PIN:'2'},inputs:{DUTY:num(128)}},{kind:'block',type:'usb_pin_button',fields:{PIN:'13'}},{kind:'block',type:'usb_pin_read',fields:{PIN:'34'}},{kind:'block',type:'usb_pin_analog',fields:{PIN:'34'}}]},
 {kind:'category',name:'Керування',colour:'#C98B21',contents:[{kind:'block',type:'usb_forever'},{kind:'block',type:'controls_repeat_ext',inputs:{TIMES:num(10)}},{kind:'block',type:'robot_wait',inputs:{TIME:num(.5)}},{kind:'block',type:'controls_if'},{kind:'block',type:'controls_whileUntil'}]},
 {kind:'category',name:'Логіка',colour:'#7C69CE',contents:['logic_compare','logic_operation','logic_negate','logic_boolean'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'Числа',colour:'#668ACB',contents:['math_number','math_arithmetic'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'Змінні',colour:'#DD8053',custom:'VARIABLE'},
]};
const chain=(...blocks)=>blocks.reduceRight((next,block)=>({...block,...next?{next:{block:next}}:{}}),null);
const led=state=>({type:'usb_led',fields:{STATE:state}}),wait=seconds=>({type:'robot_wait',inputs:{TIME:num(seconds)}});
export const usbExamples={
 toggle:{name:'Телефон → перемикач GPIO19',workspace:{variables:[{id:'toggle-state',name:'стан'}],blocks:{languageVersion:0,blocks:[{...chain({type:'usb_remote',fields:{COMMAND:'7',EVENT:'PRESS'}},{type:'controls_if',extraState:{hasElse:true},inputs:{IF0:{block:{type:'logic_compare',fields:{OP:'EQ'},inputs:{A:{block:{type:'variables_get',fields:{VAR:{id:'toggle-state'}}}},B:num(0)}}},DO0:{block:chain({type:'usb_pin_write',fields:{PIN:'19',STATE:'ON'}},{type:'variables_set',fields:{VAR:{id:'toggle-state'}},inputs:{VALUE:num(1)}})},ELSE:{block:chain({type:'usb_pin_write',fields:{PIN:'19',STATE:'OFF'}},{type:'variables_set',fields:{VAR:{id:'toggle-state'}},inputs:{VALUE:num(0)}})}}}),x:40,y:35}]}}},
 console:{name:'Телефон → консоль',workspace:{blocks:{languageVersion:0,blocks:[{...chain({type:'usb_remote',fields:{COMMAND:'7',EVENT:'PRESS'}},{type:'usb_print',fields:{TEXT:'Кнопку отримано!'}},wait(1),{type:'usb_print',fields:{TEXT:'Готово'}}),x:40,y:35}]}}},
 remote:{name:'Світлодіод із телефона',workspace:{blocks:{languageVersion:0,blocks:[{...chain({type:'usb_remote',fields:{COMMAND:'5',EVENT:'PRESS'}},{type:'controls_repeat_ext',inputs:{TIMES:num(3),DO:{block:chain(led('ON'),wait(.3),led('OFF'),wait(.3))}}}),x:40,y:35},{...chain({type:'usb_remote',fields:{COMMAND:'7',EVENT:'PRESS'}},led('ON')),x:40,y:340},{...chain({type:'usb_remote',fields:{COMMAND:'7',EVENT:'RELEASE'}},led('OFF')),x:40,y:460}]}}},
 blink:{name:'Моє блимання',workspace:{blocks:{languageVersion:0,blocks:[{...chain({type:'usb_start'},{type:'usb_forever',inputs:{DO:{block:chain(led('ON'),wait(.5),led('OFF'),wait(.5))}}}),x:40,y:35}]}}},
 pulses:{name:'Три спалахи',workspace:{blocks:{languageVersion:0,blocks:[{...chain({type:'usb_start'},{type:'usb_forever',inputs:{DO:{block:chain({type:'controls_repeat_ext',inputs:{TIMES:num(3),DO:{block:chain(led('ON'),wait(.15),led('OFF'),wait(.15))}}},wait(1.5))}}}),x:40,y:35}]}}},
 empty:{name:'Моя програма',workspace:{blocks:{languageVersion:0,blocks:[{type:'usb_start',x:40,y:35}]}}},
};
export {Blockly};

import {withResolvedWiring} from './wiring-state.js';
import {Blockly} from './usb-blocks.js';
import {CompileError} from './compile-error.js';
import {supportsPin,validatePinState} from './usb-pins.js';
import {gpioSource} from './usb-gpio-source.js';
import {consoleBytes} from './console-text.js';
import {remoteEventId} from './remote-commands.js';
import {withExpandedMyBlocks} from './my-blocks.js';

export function compileUsb(workspace,{allowRemote=false}={}){return withExpandedMyBlocks(workspace,w=>withResolvedWiring(w,resolved=>compileExpandedUsb(resolved,allowRemote)));}
function compileExpandedUsb(workspace,allowRemote){
 const all=workspace.getAllBlocks(false);if(all.length>256)throw new CompileError('Максимум 256 блоків.');
 const enabled=workspace.getTopBlocks(true).filter(b=>b.isEnabled());
 const remote=enabled.some(b=>b.type==='usb_remote');
 const tops=remote?enabled.filter(b=>b.type!=='usb_start'||b.getNextBlock()):enabled;
 if(remote){
  const events=new Set();
  for(const block of tops){
   if(block.type!=='usb_remote')throw new CompileError('Для пульта використовуй лише блоки «коли на телефоні». При ввімкненні машинка має стояти.',block);
   const event=remoteEventId(block);
   if(events.has(event))throw new CompileError('Для цієї кнопки й події вже є обробник.',block);
   events.add(event);
  }
  for(const event of events)if(event>8&&!events.has(event-8))throw new CompileError('Додай обробник натискання для кнопки з відпусканням.');
 }else if(tops.length!==1||tops[0].type!=='usb_start')throw new CompileError('З’єднай усі блоки під одним блоком «коли плата увімкнеться».',tops[0]);
 for(const block of tops)if(!block.getNextBlock())throw new CompileError('Додай команду під блоком початку.',block);
 const variables=new Map();let loop=0;
 const pin=(b,action)=>{const value=Number(b.getFieldValue('PIN'));if(!supportsPin(value,action))throw new CompileError('Цей пін не підтримує обрану дію.',b);if(remote&&action==='analog'&&![32,33,34,35,36,39].includes(value))throw new CompileError('З Wi-Fi використовуй аналогові входи ADC1: 32–39.',b);return value;};
 const variable=b=>{const id=b.getFieldValue('VAR');if(!variables.has(id)){if(variables.size>=8)throw new CompileError('Максимум 8 змінних разом із числовими та логічними параметрами вкладених викликів.',b);variables.set(id,variables.size);}return `v[${variables.get(id)}]`;};
 const input=(b,name,depth)=>{const child=b.getInputTargetBlock(name);if(!child)throw new CompileError('Заповни порожнє місце в блоці.',b);return expression(child,depth+1);};
 function expression(b,depth=0){
  if(depth>32)throw new CompileError('Забагато вкладених значень.',b);
  if(!b.isEnabled())throw new CompileError('Увімкни блок зі значенням.',b);
  switch(b.type){
   case 'usb_pin_read':return `(mcarRead(${pin(b,'read')}, false) != 0)`;
   case 'usb_pin_button':return `(mcarRead(${pin(b,'pullup')}, true) == 0)`;
   case 'usb_pin_analog':return `mcarAnalog(${pin(b,'analog')})`;
   case 'math_number':{const n=Number(b.getFieldValue('NUM'));if(!Number.isFinite(n)||Math.abs(n)>1e6)throw new CompileError('Число має бути між −1000000 та 1000000.',b);return `${n.toFixed(6)}f`;}
   case 'logic_boolean':return b.getFieldValue('BOOL')==='TRUE'?'true':'false';
   case 'variables_get':return variable(b);
   case 'logic_negate':return `(!(${input(b,'BOOL',depth)}))`;
   case 'logic_operation':{const op={AND:'&&',OR:'||'}[b.getFieldValue('OP')];if(!op)throw new CompileError('Невідома логічна дія.',b);return `((${input(b,'A',depth)}) ${op} (${input(b,'B',depth)}))`;}
   case 'logic_compare':{const op={EQ:'==',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='}[b.getFieldValue('OP')];if(!op)throw new CompileError('Невідоме порівняння.',b);return `((${input(b,'A',depth)}) ${op} (${input(b,'B',depth)}))`;}
   case 'math_arithmetic':{const op=b.getFieldValue('OP'),a=input(b,'A',depth),c=input(b,'B',depth);if(op==='POWER')return `checked(powf(${a}, ${c}))`;if(op==='DIVIDE')return `divide(${a}, ${c})`;const symbol={ADD:'+',MINUS:'-',MULTIPLY:'*'}[op];if(!symbol)throw new CompileError('Невідома математична дія.',b);return `checked((${a}) ${symbol} (${c}))`;}
   default:throw new CompileError('Цей блок не підтримується у USB-майстерні.',b);
  }
 }
 function statements(first,depth=0){
  if(depth>8)throw new CompileError('Максимум 8 вкладених циклів або умов.',first);
  const lines=[];
  for(let b=first;b;b=b.getNextBlock()){
   if(!b.isEnabled())continue;
   switch(b.type){
    case 'usb_print':{const hex=Array.from(consoleBytes(b),byte=>byte.toString(16).padStart(2,'0')).join('');lines.push(`Serial.println("MCAR_LOG ${hex}");`);break;}
    case 'usb_pin_write':{const state=b.getFieldValue('STATE');if(!['ON','OFF'].includes(state))throw new CompileError('Обери стан піна.',b);lines.push(`mcarWrite(${pin(b,'write')}, ${state==='ON'?'true':'false'});`);break;}
    case 'usb_pin_pwm':lines.push(`if (!mcarPwm(${pin(b,'pwm')}, ${input(b,'DUTY',0)})) failProgram("PROGRAM_ERROR: PWM must be integer 0..255; check available channels");`);break;
    case 'usb_led':{const state=b.getFieldValue('STATE');if(!['ON','OFF'].includes(state))throw new CompileError('Оберіть стан світлодіода.',b);lines.push(`setLed(${state==='ON'?'true':'false'});`);break;}
    case 'robot_wait':lines.push(`waitSeconds(${input(b,'TIME',0)});`);break;
    case 'variables_set':lines.push(`${variable(b)} = checked(${input(b,'VALUE',0)});`);break;
    case 'math_change':{const name=variable(b);lines.push(`${name} = checked(${name} + (${input(b,'DELTA',0)}));`);break;}
    case 'controls_repeat_ext':{const id=loop++;lines.push(`for (int i${id}=0, n${id}=repeatCount(${input(b,'TIMES',0)}); i${id}<n${id}; ++i${id}) {`,...statements(b.getInputTargetBlock('DO'),depth+1),'delay(1);','}');break;}
    case 'usb_forever':lines.push('while (true) {',...statements(b.getInputTargetBlock('DO'),depth+1),'delay(1);','}');break;
    case 'controls_whileUntil':{const condition=input(b,'BOOL',0),mode=b.getFieldValue('MODE');if(!['WHILE','UNTIL'].includes(mode))throw new CompileError('Невідомий тип циклу.',b);lines.push(`while (${mode==='UNTIL'?'!':''}(${condition})) {`,...statements(b.getInputTargetBlock('DO'),depth+1),'delay(1);','}');break;}
    case 'controls_if':{let i=0;while(b.getInput('IF'+i)){lines.push(`${i?'else ':''}if (${input(b,'IF'+i,0)}) {`,...statements(b.getInputTargetBlock('DO'+i),depth+1),'}');i++;}if(b.getInput('ELSE'))lines.push('else {',...statements(b.getInputTargetBlock('ELSE'),depth+1),'}');break;}
    default:throw new CompileError('Цей блок не підтримується у USB-майстерні.',b);
   }
  }
  return lines;
 }
 const body=tops.flatMap(block=>statements(block.getNextBlock()));
 if(remote){if(!allowRemote)throw new CompileError('Команди телефона потребують браузерного USB-завантаження; окремий Arduino-код не підтримується.');return null;}
 // All emitted names/operators are fixed; user-controlled strings never become C++.
 return `#include <Arduino.h>\n#include <math.h>\nconstexpr uint8_t LED_PIN = 2;\nfloat v[8] = {};\n
${gpioSource}
void failProgram(const char* message) { mcarStopPins(); Serial.println(message); while (true) delay(1000); }
float checked(float value) { if (!isfinite(value) || fabsf(value)>1000000.0f) failProgram("PROGRAM_ERROR: number out of range"); return value; }
float divide(float a, float b) { if (b==0) failProgram("PROGRAM_ERROR: division by zero"); return checked(a/b); }
void waitSeconds(float value) { checked(value); if (value<0 || value>60) failProgram("PROGRAM_ERROR: wait must be 0..60 seconds"); delay((uint32_t)(value*1000.0f)); }
int repeatCount(float value) { checked(value); if (value<0 || value>1000) failProgram("PROGRAM_ERROR: repeat must be 0..1000"); return (int)value; }
void setLed(bool on) { mcarWrite(LED_PIN, on); Serial.printf("LED2=%s ms=%lu\\n", on ? "ON" : "OFF", (unsigned long)millis()); }
void setup() {
 mcarWrite(LED_PIN, false);
 Serial.begin(115200); delay(1500);
 Serial.println("MCAR_USB_BLOCKS BOOT");
 ${body.join('\n ')}
 Serial.println("MCAR_USB_BLOCKS DONE");
}
void loop() { delay(1000); }
`;
}
export function compileUsbState(state){
 const text=JSON.stringify(state);if(!text||text.length>100000)throw new CompileError('Файл програми завеликий.');
 validatePinState(state);
 // Reject extra/custom serializers and unknown block types before Blockly loads them.
 const allowed=new Set(['wired_pin_write','wired_pin_pwm','wired_pin_read','my_block_call','my_block_parameter','my_block_pin','usb_pin_write','usb_pin_pwm','usb_pin_read','usb_pin_button','usb_pin_analog','usb_start','usb_led','usb_forever','robot_wait','controls_repeat_ext','controls_whileUntil','controls_if','variables_get','variables_set','math_change','math_number','math_arithmetic','logic_boolean','logic_negate','logic_operation','logic_compare']);
 allowed.add('usb_remote');
 allowed.add('usb_print');
 let count=0;
 function inspect(node,depth=0){if(depth>80)throw new CompileError('Програма надто вкладена.');if(!node||typeof node!=='object')return;if(node.type!==undefined&&node.type!==''){if(!allowed.has(node.type)||++count>256)throw new CompileError('Програма містить непідтримуваний блок або забагато блоків.');}for(const value of Object.values(node))if(value&&typeof value==='object')inspect(value,depth+1);}
 if(!state||Object.keys(state).some(k=>!['blocks','variables','myBlocks','wiring'].includes(k)))throw new CompileError('Невідомий формат блоків.');inspect({blocks:state.blocks,variables:state.variables,myBlocks:state.myBlocks});
 const workspace=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,workspace);return compileUsb(workspace);}finally{workspace.dispose();}
}

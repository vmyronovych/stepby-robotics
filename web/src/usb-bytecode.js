import {withResolvedWiring} from './wiring-state.js';
import {compileUsb} from './usb-compiler.js';
import {CompileError} from './compile-error.js';
import {remoteEventId} from './remote-commands.js';
import {consoleBytes} from './console-text.js';
import {withExpandedMyBlocks} from './my-blocks.js';
export const PROGRAM_ADDRESS=0x310000;
export const MAX_INSTRUCTIONS=2048;
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function compileUsbBytecode(workspace){return withExpandedMyBlocks(workspace,w=>withResolvedWiring(w,compileExpandedBytecode));}
function compileExpandedBytecode(workspace){
 // Share all user-facing graph validation and limits with the local C++ compiler.
 compileUsb(workspace,{allowRemote:true});
 const code=[],variables=new Map(),temps=[];
 const emit=(op,value=0)=>{if(code.length>=MAX_INSTRUCTIONS)throw new CompileError('Програма завелика. Спрости блоки.');code.push({op,value});return code.length-1;};
 const patch=i=>code[i].value=code.length;
 const variable=b=>{const id=b.getFieldValue('VAR');if(!variables.has(id))variables.set(id,variables.size);return variables.get(id);};
 function expr(b){
  const input=name=>expr(b.getInputTargetBlock(name));
  switch(b.type){
   case 'usb_pin_read':emit('r',Number(b.getFieldValue('PIN')));break;
   case 'usb_pin_button':emit('u',Number(b.getFieldValue('PIN')));emit('!');break;
   case 'usb_pin_analog':emit('a',Number(b.getFieldValue('PIN')));break;
   case 'math_number':emit('P',Number(Number(b.getFieldValue('NUM')).toFixed(6)));break;
   case 'logic_boolean':emit('P',b.getFieldValue('BOOL')==='TRUE'?1:0);break;
   case 'variables_get':emit('V',variable(b));break;
   case 'logic_negate':input('BOOL');emit('!');break;
   case 'logic_operation':{
    input('A');const branch=emit('C');
    if(b.getFieldValue('OP')==='AND'){input('B');emit('!');emit('!');const end=emit('J');patch(branch);emit('P',0);patch(end);}
    else{emit('P',1);const end=emit('J');patch(branch);input('B');emit('!');emit('!');patch(end);}break;
   }
   case 'logic_compare':input('A');input('B');emit({EQ:'E',NEQ:'N',LT:'<',LTE:'Q',GT:'>',GTE:'G'}[b.getFieldValue('OP')]);break;
   case 'math_arithmetic':input('A');input('B');emit({ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/',POWER:'^'}[b.getFieldValue('OP')]);break;
   default:throw new CompileError('Непідтримуване значення.',b);
  }
 }
 function statements(first){
  for(let b=first;b;b=b.getNextBlock()){
   if(!b.isEnabled())continue;
   const input=name=>expr(b.getInputTargetBlock(name));
   switch(b.type){
    case 'usb_print':{const bytes=consoleBytes(b);emit('M',bytes.length);for(const byte of bytes)emit('b',byte);break;}
    case 'usb_pin_write':emit('P',b.getFieldValue('STATE')==='ON'?1:0);emit('o',Number(b.getFieldValue('PIN')));break;
    case 'usb_pin_pwm':input('DUTY');emit('p',Number(b.getFieldValue('PIN')));break;
    case 'usb_led':emit('L',b.getFieldValue('STATE')==='ON'?1:0);break;
    case 'robot_wait':input('TIME');emit('W');break;
    case 'variables_set':{const id=variable(b);input('VALUE');emit('=',id);break;}
    case 'math_change':{const id=variable(b);emit('V',id);input('DELTA');emit('+');emit('=',id);break;}
    case 'usb_forever':{const start=code.length;statements(b.getInputTargetBlock('DO'));emit('D');emit('J',start);break;}
    case 'controls_repeat_ext':{
     const temp=8+temps.length;temps.push(temp);input('TIMES');emit('I',temp);const start=code.length;emit('V',temp);emit('P',0);emit('>');const end=emit('C');
     statements(b.getInputTargetBlock('DO'));emit('V',temp);emit('P',1);emit('-');emit('=',temp);emit('D');emit('J',start);patch(end);temps.pop();break;
    }
    case 'controls_whileUntil':{const start=code.length;input('BOOL');if(b.getFieldValue('MODE')==='UNTIL')emit('!');const end=emit('C');statements(b.getInputTargetBlock('DO'));emit('D');emit('J',start);patch(end);break;}
    case 'controls_if':{const ends=[];let i=0;while(b.getInput('IF'+i)){input('IF'+i);const next=emit('C');statements(b.getInputTargetBlock('DO'+i));ends.push(emit('J'));patch(next);i++;}statements(b.getInputTargetBlock('ELSE'));ends.forEach(patch);break;}
    default:throw new CompileError('Непідтримувана команда.',b);
   }
  }
 }
 const handlers=workspace.getTopBlocks(true).filter(b=>b.isEnabled()&&b.type==='usb_remote');
 if(handlers.length){
  emit('H');
  for(const block of handlers){emit('T',remoteEventId(block));statements(block.getNextBlock());emit('H');}
 }else{statements(workspace.getTopBlocks(true).find(b=>b.isEnabled()).getNextBlock());emit('H');}
 const bytes=new Uint8Array(16+code.length*8),view=new DataView(bytes.buffer);
 bytes.set(new TextEncoder().encode('MCARUSB1'));view.setUint32(8,code.length,true);
 code.forEach(({op,value},i)=>{view.setUint8(16+i*8,op.charCodeAt(0));view.setFloat32(20+i*8,value,true);});
 const checksum=crc32(bytes.subarray(16));view.setUint32(12,checksum,true);
 return {bytes,checksum:checksum.toString(16).padStart(8,'0'),code};
}

import {CompileError} from './compile-error.js';
export function consoleBytes(block){
 const text=block.getFieldValue('TEXT');
 if(typeof text!=='string'||/[\u0000-\u001f\u007f]/u.test(text))throw new CompileError('Повідомлення консолі має бути одним рядком без керівних символів.',block);
 const bytes=new TextEncoder().encode(text);
 if(bytes.length>120)throw new CompileError('Повідомлення завелике: максимум 120 байтів UTF-8 (приблизно 60 українських літер).',block);
 return bytes;
}
export function decodeConsoleLine(line){
 const match=/^MCAR_LOG ([0-9a-f]{0,240})$/.exec(line);
 if(!match||match[1].length%2)return null;
 try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(match[1].match(/../g)||[],byte=>parseInt(byte,16)));}catch{return null;}
}

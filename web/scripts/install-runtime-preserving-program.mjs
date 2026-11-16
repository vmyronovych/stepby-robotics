// One-time developer installation on the owner's connected ESP32. Preserve its
// current algorithm instead of replacing it with a demo. Uses the test adapter.
import {ESPLoader,Transport} from 'esptool-js';
import {TestSerialPort} from './serial-test-port.mjs';
import {crc32} from '../src/usb-bytecode.js';
import {flashBrowserProgram,loadFirmware} from '../src/browser-flasher.js';
import fs from 'node:fs/promises';
import path from 'node:path';
if(!process.argv.includes('--install-connected-esp32'))throw Error('Explicit installation flag required.');
const root=path.resolve(import.meta.dirname,'../..');
const transport=new Transport(new TestSerialPort(),false),loader=new ESPLoader({transport,baudrate:115200,romBaudrate:115200});
let backup;
try{
 await loader.main();if(loader.chip?.CHIP_NAME!=='ESP32')throw Error('Wrong chip');
 backup=await loader.readFlash(0x310000,0x10000);
}finally{try{await transport.setDTR(false);await transport.setRTS(true);await new Promise(r=>setTimeout(r,100));await transport.setRTS(false);}finally{await transport.disconnect();}}
const file='validation/program-before-runtime-v2-'+Date.now()+'.bin';await fs.writeFile(path.join(root,file),backup);console.log('Backup:',file);
function candidate(offset,length){
 const b=backup.subarray(offset),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='MCARUSB1')return null;
 const count=v.getUint32(8,true),size=16+count*8;if(!count||count>2048||(length&&size!==length))return null;
 const bytes=b.slice(0,size),checksum=crc32(bytes.subarray(16));if(checksum!==v.getUint32(12,true))return null;
 return {bytes,checksum:checksum.toString(16).padStart(8,'0')};
}
let program=null,generation=0;
for(let slot=0;slot<2;slot++){
 const footer=backup.subarray((slot+1)*32768-24,(slot+1)*32768),view=new DataView(footer.buffer,footer.byteOffset,24);
 if(new TextDecoder().decode(footer.subarray(0,8))!=='MCARSLOT'||crc32(footer.subarray(0,20))!==view.getUint32(20,true))continue;
 const p=candidate(slot*32768,view.getUint32(12,true)),g=view.getUint32(8,true);
 if(p&&parseInt(p.checksum,16)===view.getUint32(16,true)&&g>generation){program=p;generation=g;}
}
program||=candidate(0);if(!program)throw Error('Cannot validate existing algorithm. Backup saved; installation cancelled.');
console.log('Preserving algorithm CRC:',program.checksum);
let phase='';const result=await flashBrowserProgram({install:true,port:new TestSerialPort(),program,load:()=>loadFirmware(async url=>new Response(await fs.readFile(path.join(root,'web/public',url)))),onJob:j=>{if(phase!==j.phase){phase=j.phase;console.log(phase);}if(j.finished)console.log(j.message);}});
await fs.writeFile(path.join(root,'validation/runtime-v2-install.json'),JSON.stringify({...result,backup:file,programChecksum:program.checksum,transport:'esptool-js with system serial test adapter; not native Web Serial'},null,2));
if(result.phase!=='done')process.exitCode=1;

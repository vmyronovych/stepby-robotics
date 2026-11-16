// Real-board MCAR2 test with Chromium-style signal updates. The browser permission
// layer is not exercised by this adapter. Always restore the owner's algorithm.
import fs from 'node:fs/promises';
import path from 'node:path';
import {TestSerialPort} from './serial-test-port.mjs';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode,crc32} from '../src/usb-bytecode.js';
import {flashBrowserProgram,verifyBoot} from '../src/browser-flasher.js';
if(!process.argv.includes('--update-connected-esp32'))throw Error('Explicit hardware-update flag required.');
const root=path.resolve(import.meta.dirname,'../..'),installation=JSON.parse(await fs.readFile(path.join(root,'validation/runtime-v2-install.json'),'utf8'));
const backup=new Uint8Array(await fs.readFile(path.join(root,installation.backup)));
const original=[0,32768].map(offset=>{const b=backup.subarray(offset),size=16+new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(8,true)*8;return {bytes:b.slice(0,size),size,checksum:installation.programChecksum};}).find(p=>p.size>=24&&p.size<=16400&&new TextDecoder().decode(p.bytes.subarray(0,8))==='MCARUSB1'&&crc32(p.bytes.subarray(16)).toString(16).padStart(8,'0')===p.checksum);
if(!original)throw Error('Invalid backup');
const compile=name=>{const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(usbExamples[name].workspace,w);return compileUsbBytecode(w);}finally{w.dispose();}};
const evidence={transport:'Real ESP32 via test adapter with Chromium-style sequential DTR/RTS; not native browser permission',updates:[],originalChecksum:original.checksum};
async function update(program,port=new TestSerialPort('chromium')){
 const job=await flashBrowserProgram({port,program,load:()=>{throw Error('Unexpected ROM fallback');}});
 evidence.updates.push({...job,checksum:program.checksum});console.log(job.phase,job.mode,program.checksum,job.finishedAt-job.startedAt,'ms');
 return job;
}
let restored=false;
try{
 for(const program of [compile('blink'),compile('pulses'),original]){const result=await update(program);if(result.phase!=='done'||result.mode!=='algorithm')throw Error(result.log+'\n'+result.message);}
 restored=true;
 class InterruptedPort extends TestSerialPort {
  async open(options){await super.open(options);this.originalWriter=this.writable.getWriter();this.writable=new WritableStream({write:bytes=>{if(new TextDecoder().decode(bytes).includes(' COMMIT '))throw Error('Simulated cable loss before COMMIT');return this.originalWriter.write(bytes);}});}
  async close(){this.originalWriter.releaseLock();return super.close();}
 }
 const interrupted=await update(compile('blink'),new InterruptedPort('chromium'));
 if(interrupted.phase!=='error'||!interrupted.log.includes('Simulated cable loss'))throw Error('Expected interrupted update');
 evidence.restart=await verifyBoot(new TestSerialPort('chromium'),original.checksum,text=>{evidence.restartLog=(evidence.restartLog||'')+text;});
 if(evidence.restart.phase!=='done')throw Error('Original program did not survive interrupted transfer/reset');
 console.log('PASS original algorithm survived reset and interrupted transfer');
}finally{
 if(!restored){const result=await update(original);evidence.restored=result.phase==='done';}
 await fs.writeFile(path.join(root,'validation/runtime-v2-hardware.json'),JSON.stringify(evidence,null,2));
}

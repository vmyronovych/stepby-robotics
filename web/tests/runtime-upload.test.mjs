import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode,crc32} from '../src/usb-bytecode.js';
import {uploadAlgorithm,probeRuntime} from '../src/runtime-upload.js';
import {flashBrowserProgram} from '../src/browser-flasher.js';
import {watchSerialConnection} from '../src/serial-session.js';
const root=path.resolve(import.meta.dirname,'../..'),dir=mkdtempSync(path.join(tmpdir(),'mcar-receiver-')),binary=path.join(dir,'receiver');
before(()=>{const result=spawnSync('c++',['-std=c++17','-Wall','-Wextra',path.join(root,'firmware/tests/usb_receiver_runner.cpp'),'-o',binary],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
after(()=>rmSync(dir,{recursive:true,force:true}));
function compile(state=usbExamples.blink.workspace){const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,w);return compileUsbBytecode(w);}finally{w.dispose();}}
class ReceiverPort {
 constructor({corrupt=false,silent=false,dropRunning=false}={}){Object.assign(this,{corrupt,silent,dropRunning});this.writes=[];this.signals=[];this.closed=false;}
 async open(){
  this.child=spawn(binary);let controller;
  this.readable=new ReadableStream({start:c=>controller=c,cancel:()=>{this.cancelled=true;}});this.cancelled=false;
  this.child.stdout.on('data',data=>{const text=data.toString().split('\n').filter(line=>!this.dropRunning||!line.includes(' RUNNING ')).join('\n');if(!this.cancelled&&text)controller.enqueue(new TextEncoder().encode(text));});
  this.writable=new WritableStream({write:bytes=>{let text=new TextDecoder().decode(bytes);this.writes.push(text);if(this.silent)return;if(this.corrupt&&text.includes(' DATA ')){const i=text.lastIndexOf(' ')+1;text=text.slice(0,i)+'00'+text.slice(i+2);}this.child.stdin.write(text);}});
 }
 async setSignals(signals){this.signals.push(signals);assert.deepEqual(signals,{dataTerminalReady:false,requestToSend:false},'algorithm updates must never assert reset/BOOT');}
 async close(){this.child.stdin.end();await new Promise(resolve=>{this.child.once('exit',resolve);});this.closed=true;}
}
test('real C++ flash store and receiver survive interrupted updates and malformed commands',()=>{const result=spawnSync(binary,['--self-test'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS storage/);assert.match(result.stdout,/PASS receiver/);});
test('browser protocol interoperates with the real C++ receiver without ROM flashing',async()=>{
 const port=new ReceiverPort(),jobs=[],program=compile();
 const result=await flashBrowserProgram({port,program,onJob:j=>jobs.push(j),load:()=>{throw Error('must not load ROM firmware');},Loader:class{constructor(){throw Error('must not construct ROM loader');}}});
 assert.equal(result.phase,'done',result.log);assert.equal(result.mode,'algorithm');assert.ok(jobs.some(j=>j.phase==='uploading'));assert.ok(port.writes.some(s=>s.includes(' COMMIT ')));assert.ok(port.closed);assert.equal(port.signals.length,1);
});
test('corrupt transfer never commits or falls back to reflashing',async()=>{
 const port=new ReceiverPort({corrupt:true});let loaded=false;
 const result=await flashBrowserProgram({port,program:compile(),load:async()=>{loaded=true;throw Error('unexpected ROM');}});
 assert.equal(result.phase,'error');assert.match(result.log,/INVALID_PROGRAM/);assert.equal(loaded,false);assert.ok(port.closed);
});
test('maximum-size algorithm crosses every chunk boundary and commits through the real receiver',async()=>{
 const bytes=new Uint8Array(16400),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('MCARUSB1'));view.setUint32(8,2048,true);
 for(let i=0;i<2048;i++)bytes[16+i*8]=(i===2047?'H':'D').charCodeAt(0);
 const crc=crc32(bytes.subarray(16));view.setUint32(12,crc,true);const port=new ReceiverPort();
 const result=await uploadAlgorithm({port,program:{bytes,checksum:crc.toString(16).padStart(8,'0')},settleMs:1});
 assert.equal(result.phase,'done');assert.equal(port.writes.filter(line=>line.includes(' DATA ')).length,65);assert.ok(port.closed);
});
test('no receiver returns no result; missing run acknowledgement is not success',async()=>{
 const silent=new ReceiverPort({silent:true});assert.equal(await uploadAlgorithm({port:silent,program:compile(),probeTimeout:20}),null);assert.ok(silent.closed);
 const port=new ReceiverPort({dropRunning:true});await assert.rejects(uploadAlgorithm({port,program:compile(),ackTimeout:50}),/запуск не підтверджено/);assert.ok(port.closed);
});
test('known older firmware is distinguished from silence without sending a program',async()=>{
 const writes=[];let controller;
 const port={async open(){this.readable=new ReadableStream({start:c=>controller=c});this.writable=new WritableStream({write:bytes=>{const command=new TextDecoder().decode(bytes).trim();writes.push(command);controller.enqueue(new TextEncoder().encode(`MCAR2 READY ${command.split(' ')[2]} gpio2-v3 16400\n`));}});},async setSignals(){},async close(){}};
 assert.deepEqual(await probeRuntime({port}),{runtime:'gpio2-v3',maxBytes:16400,compatible:false});
 const result=await uploadAlgorithm({port,program:compile()});
 assert.equal(result.phase,'setup-required');assert.equal(result.reason,'runtime-version');
 assert.ok(writes.every(line=>line.includes(' HELLO ')));
});
test('an immediately failing algorithm reports runtime-error after a verified save',async()=>{
 const state={blocks:{blocks:[{type:'usb_start',next:{block:{type:'robot_wait',inputs:{TIME:{block:{type:'math_number',fields:{NUM:-1}}}}}}}]}};
 const result=await uploadAlgorithm({port:new ReceiverPort(),program:compile(state),settleMs:50});assert.equal(result.phase,'runtime-error');
});

test('connection readiness probe never starts a transfer or changes the running algorithm',async()=>{
 const port=new ReceiverPort();const result=await probeRuntime({port});assert.equal(result.runtime,'gpio2-v5');assert.ok(port.writes.length);assert.ok(port.writes.every(line=>line.includes(' HELLO ')));assert.ok(port.closed);
});
test('console and uploads share one reader and port; release waits for pending uploads',async()=>{
 const port=new ReceiverPort(),lines=[];
 const stop=await watchSerialConnection(port,line=>lines.push(line));
 const first=await uploadAlgorithm({port,program:compile(),settleMs:1});
 assert.equal(first.phase,'done');assert.equal(port.signals.length,1);assert.equal(port.closed,false);
 assert.ok(lines.some(line=>line.includes(' SAVED ')));
 const second=uploadAlgorithm({port,program:compile(),settleMs:1});
 const release=stop();assert.equal((await second).phase,'done');await release;
 assert.equal(port.signals.length,1);assert.equal(port.closed,true);await stop();
});
test('disconnect releases the failed console reader before reconnect',async()=>{
 let controller,opened=false,failures=0;
 const port={async open(){assert.equal(opened,false);opened=true;this.readable=new ReadableStream({start:value=>controller=value});},async setSignals(){},async close(){opened=false;}};
 const stop=await watchSerialConnection(port,()=>{},()=>failures++);
 controller.error(Error('unplugged'));await new Promise(resolve=>setTimeout(resolve,0));
 await stop();assert.equal(opened,false);assert.equal(failures,1);
 const stopAgain=await watchSerialConnection(port,()=>{});assert.equal(opened,true);await stopAgain();assert.equal(opened,false);
});
test('already-disconnected hardware can reject close without blocking console cleanup',async()=>{
 let controller;
 const port={async open(){this.readable=new ReadableStream({start:value=>controller=value});},async setSignals(){},async close(){throw new DOMException('already closed','InvalidStateError');}};
 const stop=await watchSerialConnection(port,()=>{});
 controller.error(Error('USB unplugged'));await new Promise(resolve=>setTimeout(resolve,0));port.readable=null;port.writable=null;
 await stop();
});

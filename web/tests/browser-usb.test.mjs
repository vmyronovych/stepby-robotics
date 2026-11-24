import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode,crc32} from '../src/usb-bytecode.js';
import {compileUsb} from '../src/usb-compiler.js';
import {program as wiredProgram} from './wiring-fixture.mjs';
import {OUTPUT_PINS,INPUT_PINS,ANALOG_PINS} from '../src/usb-pins.js';
import {flashBrowserProgram,loadFirmware,verifyBoot} from '../src/browser-flasher.js';
const root=path.resolve(import.meta.dirname,'../..'),dir=mkdtempSync(path.join(tmpdir(),'mcar-vm-'));
before(()=>{const result=spawnSync('c++',['-std=c++17','-Wall','-Wextra',path.join(root,'firmware/tests/usb_vm_runner.cpp'),'-o',path.join(dir,'vm')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
after(()=>rmSync(dir,{recursive:true,force:true}));
function compile(state){const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,w);return compileUsbBytecode(w);}finally{w.dispose();}}
function execute(bytes){const file=path.join(dir,'program.bin');writeFileSync(file,bytes);return spawnSync(path.join(dir,'vm'),[file],{encoding:'utf8'});}
const number=n=>({block:{type:'math_number',fields:{NUM:n}}});
const led=state=>({type:'usb_led',fields:{STATE:state}});
const chain=(...blocks)=>blocks.reduceRight((next,block)=>({...block,...(next?{next:{block:next}}:{})}),null);
const program=first=>({blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:first}}]}});
test('GPIO blocks execute outputs, PWM and sensor conditions through the actual VM',()=>{
 const pin=(type,n)=>({type,fields:{PIN:String(n)}});
 const condition=read=>({type:'controls_if',inputs:{IF0:{block:read},DO0:{block:led('ON')}}});
 const state=program(chain({...pin('usb_pin_write',23),fields:{PIN:'23',STATE:'ON'}},{...pin('usb_pin_pwm',2),inputs:{DUTY:number(128)}},condition(pin('usb_pin_button',13)),condition(pin('usb_pin_read',34)),condition({type:'logic_compare',fields:{OP:'GT'},inputs:{A:{block:pin('usb_pin_analog',36)},B:number(2000)}})));
 const result=execute(compile(state).bytes);assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/WRITE 23 1\nPWM 2 128\nREAD 13 1\n0 ON\nREAD 34 0\n1 ON\nANALOG 36\n2 ON\nDONE/);
 const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,w);const cpp=compileUsb(w);assert.match(cpp,/mcarPwm\(2, 128/);assert.match(cpp,/mcarRead\(13, true\) == 0/);assert.match(cpp,/mcarAnalog\(36\)/);}finally{w.dispose();}
 for(const duty of [-1,256,1.5]){const bad=execute(compile(program({...pin('usb_pin_pwm',2),inputs:{DUTY:number(duty)}})).bytes);assert.equal(bad.status,3);assert.match(bad.stderr,/PWM/);assert.doesNotMatch(bad.stdout,/PWM/);}
});
test('firmware independently enforces every GPIO capability, including tampered bytecode',()=>{
 function payload(op,pin){const code=['o','p'].includes(op)?[{op:'P',value:1},{op,value:pin},{op:'H',value:0}]:[{op,value:pin},{op:'=',value:0},{op:'H',value:0}];const bytes=new Uint8Array(16+code.length*8),v=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('MCARUSB1'));v.setUint32(8,code.length,true);code.forEach((i,n)=>{bytes[16+n*8]=i.op.charCodeAt(0);v.setFloat32(20+n*8,i.value,true);});v.setUint32(12,crc32(bytes.subarray(16)),true);return bytes;}
 for(const [op,allowed] of [['o',OUTPUT_PINS],['p',OUTPUT_PINS],['r',INPUT_PINS],['u',OUTPUT_PINS],['a',ANALOG_PINS]])for(let pin=-1;pin<=40;pin++)assert.equal(execute(payload(op,pin)).status,allowed.includes(pin)?0:2,`${op} GPIO${pin}`);
 const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(program({type:'usb_pin_write',fields:{PIN:'2',STATE:'ON'}}),w);const block=w.getAllBlocks().find(b=>b.type==='usb_pin_write'),original=block.getFieldValue.bind(block);block.getFieldValue=name=>name==='PIN'?'34':original(name);assert.throws(()=>compileUsbBytecode(w),/пін не підтримує/);}finally{w.dispose();}
});
test('browser bytecode runs the real firmware VM: blink, pulse loop and standalone finite program',()=>{
 const blink=execute(compile(usbExamples.blink.workspace).bytes);assert.equal(blink.status,0,blink.stderr);const events=blink.stdout.trim().split('\n').slice(0,4).map(s=>s.split(' '));assert.deepEqual(events.map(e=>e[1]),['ON','OFF','ON','OFF']);for(let i=1;i<events.length;i++)assert.ok(+events[i][0]-events[i-1][0]>=500&&+events[i][0]-events[i-1][0]<=504);
 const pulses=execute(compile(usbExamples.pulses.workspace).bytes);assert.equal(pulses.status,0,pulses.stderr);assert.match(pulses.stdout,/ON\n\d+ OFF\n\d+ ON/);
 const finite=execute(compile(program(chain(led('ON'),{type:'robot_wait',inputs:{TIME:number(1)}},led('OFF')))).bytes);assert.equal(finite.status,0,finite.stderr);assert.match(finite.stdout,/^0 ON\n1001 OFF\nDONE\n$/);
});
test('browser compiler preserves logical short circuit, variables, repeat, if and while',()=>{
 const zeroDivision={block:{type:'math_arithmetic',fields:{OP:'DIVIDE'},inputs:{A:number(1),B:number(0)}}};
 const condition={block:{type:'logic_operation',fields:{OP:'AND'},inputs:{A:{block:{type:'logic_boolean',fields:{BOOL:'FALSE'}}},B:{block:{type:'logic_compare',fields:{OP:'GT'},inputs:{A:zeroDivision,B:number(0)}}}}}};
 const guarded=program({type:'controls_if',inputs:{IF0:condition,DO0:{block:led('ON')}},next:{block:led('OFF')}});const output=execute(compile(guarded).bytes);assert.equal(output.status,0,output.stderr);assert.equal(output.stdout,'0 OFF\nDONE\n');
 const get={block:{type:'variables_get',fields:{VAR:{id:'x'}}}};
 const state=program(chain({type:'variables_set',fields:{VAR:{id:'x'}},inputs:{VALUE:number(0)}},{type:'controls_whileUntil',fields:{MODE:'WHILE'},inputs:{BOOL:{block:{type:'logic_compare',fields:{OP:'LT'},inputs:{A:get,B:number(3)}}},DO:{block:chain(led('ON'),{type:'math_change',fields:{VAR:{id:'x'}},inputs:{DELTA:number(1)}},led('OFF'))}}}));state.variables=[{id:'x',name:'counter',type:''}];
 const counter=execute(compile(state).bytes);assert.equal(counter.status,0,counter.stderr);assert.equal((counter.stdout.match(/ ON\n/g)||[]).length,3);assert.match(counter.stdout,/DONE/);
});
test('VM rejects corrupt payloads and unsafe jumps, and reports arithmetic and wait errors',()=>{
 const valid=compile(usbExamples.blink.workspace).bytes;const corrupt=valid.slice();corrupt[20]^=1;assert.equal(execute(corrupt).status,2);
 const badJump=valid.slice();badJump[16]='J'.charCodeAt(0);new DataView(badJump.buffer).setFloat32(20,9999,true);new DataView(badJump.buffer).setUint32(12,crc32(badJump.subarray(16)),true);assert.equal(execute(badJump).status,2);
 const wait=execute(compile(program({type:'robot_wait',inputs:{TIME:number(-1)}})).bytes);assert.equal(wait.status,3);assert.match(wait.stderr,/wait/);
 const divide=execute(compile(program({type:'robot_wait',inputs:{TIME:{block:{type:'math_arithmetic',fields:{OP:'DIVIDE'},inputs:{A:number(1),B:number(0)}}}}})).bytes);assert.equal(divide.status,3);assert.match(divide.stderr,/division by zero/);
});
const fetchFiles=async url=>{const file=path.join(root,'web/public',url);try{return new Response(readFileSync(file),{status:200});}catch{return new Response('',{status:404});}};
test('packaged images are verified, match source hashes, and use the declared non-overlapping partition addresses',async()=>{
 const {files,manifest}=await loadFirmware(fetchFiles);assert.deepEqual(files.map(f=>f.address),[0x1000,0x8000,0x10000]);
 for(const source of manifest.sources){const digest=Buffer.from(await crypto.subtle.digest('SHA-256',readFileSync(path.join(root,source.file)))).toString('hex');assert.equal(digest,source.sha256,'rebuild browser firmware after source changes');}
 for(let i=1;i<files.length;i++)assert.ok(files[i-1].address+files[i-1].data.length<=files[i].address);
 await assert.rejects(loadFirmware(async url=>url.endsWith('runtime.bin')?new Response(new Uint8Array(10)):fetchFiles(url)),/пошкоджено/);
 // ESP-IDF partition entries: little-endian magic, type/subtype, offset and size.
 const partitions=new DataView(files[1].data.buffer,files[1].data.byteOffset);assert.equal(partitions.getUint32(3*32+4,true),0x310000);assert.equal(partitions.getUint32(3*32+8,true),0x10000);
});
test('Web Serial flow verifies chip/flash before write, verifies each image, resets and checks matching program boot',async()=>{
 const calls=[],jobs=[];class Transport{async setDTR(v){assert.equal(v,false);}async setRTS(v){assert.equal(v,true);}async disconnect(){calls.push('close');}}
 class Loader{chip={CHIP_NAME:'ESP32'};async main(){calls.push('connect');}async detectFlashSize(){return '4MB';}flashSizeBytes(){return 4194304;}async writeFlash(options){assert.equal(options.eraseAll,false);assert.equal(options.fileArray.length,4);assert.equal(options.fileArray[3].address,0x310000);assert.equal(options.fileArray[3].data.length,65536);assert.ok(options.fileArray[3].data.subarray(32768).every(b=>b===255),'initial installation invalidates old committed slots');assert.equal(options.calculateMD5Hash(new TextEncoder().encode('abc')),'900150983cd24fb0d6963f7d28e17f72');options.reportProgress(3,10,10);calls.push('write');}async after(mode){assert.equal(mode,'hard_reset');calls.push('reset');}}
 const result=await flashBrowserProgram({install:true,port:{},program:compile(usbExamples.blink.workspace),onJob:j=>jobs.push(j),Loader,SerialTransport:Transport,load:()=>loadFirmware(fetchFiles),verify:async()=>{calls.push('verify');return {phase:'done',message:'ok'};}});
 assert.equal(result.phase,'done');assert.deepEqual(calls,['connect','write','reset','close','verify']);assert.ok(jobs.some(j=>j.uploadPercent===100));
 class WrongChip extends Loader{chip={CHIP_NAME:'ESP32-S3'};}
 calls.length=0;const wrong=await flashBrowserProgram({install:true,port:{},program:compile(usbExamples.blink.workspace),Loader:WrongChip,SerialTransport:Transport,load:()=>loadFirmware(fetchFiles)});assert.equal(wrong.phase,'error');assert.ok(!calls.includes('write'));
});
test('startup verification requires the exact new program identity and never hides runtime errors',async()=>{
 const port=text=>({async open(){},async setSignals(){},async close(){},readable:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(text));c.close();}})});
 assert.equal((await verifyBoot(port('MCAR_BROWSER_V1 BOOT deadbeef\n'),'deadbeef',()=>{})).phase,'done');
 assert.equal((await verifyBoot(port('MCAR_BROWSER_V1 BOOT 00000000\n'),'deadbeef',()=>{})).phase,'uploaded');
 assert.equal((await verifyBoot(port('MCAR_BROWSER_V1 BOOT deadbeef\nPROGRAM_ERROR: x\n'),'deadbeef',()=>{})).phase,'runtime-error');
});

test('a silent board offers connection recovery without assuming firmware is missing',async()=>{
 let touched=false;const jobs=[];
 const result=await flashBrowserProgram({port:{},program:compile(usbExamples.blink.workspace),runtimeUpload:async()=>null,load:async()=>{touched=true;throw Error('must wait for setup action');},onJob:j=>jobs.push(j)});
 assert.equal(result.phase,'connection-error');assert.equal(result.finished,true);assert.equal(touched,false);
 assert.ok(jobs.some(j=>j.mode==='detecting'));assert.equal(result.mode,'detecting');assert.match(result.message,/не означає/);
 assert.equal(result.connectionIssue?.title,'Перевір інші вкладки');assert.match(result.message,/Можливо/);
});
for(const [name,title] of [['NetworkError','USB-порт недоступний'],['InvalidStateError','USB-порт уже відкритий']])test(`${name} while opening reports a recoverable connection issue, not an installation error`,async()=>{
 const port={async open(){throw new DOMException('Failed to open serial port.',name);}};
 const result=await flashBrowserProgram({port,program:compile(usbExamples.blink.workspace),load:()=>assert.fail('must not fetch firmware')});
 assert.equal(result.phase,'connection-error');assert.equal(result.connectionIssue?.title,title);
 assert.match(result.message,/інша вкладка/);assert.match(result.log,new RegExp(name));assert.equal(result.finished,true);
});
test('failed ROM connection leaves the BOOT retry loop and exposes recovery',async()=>{
 class Transport{async disconnect(){}}
 class Loader{async main(){throw Error('Failed to connect with the device');}}
 const options={install:true,port:{},program:compile(usbExamples.blink.workspace),load:async()=>({files:[]}),Loader,SerialTransport:Transport};
 const result=await flashBrowserProgram(options);assert.equal(result.phase,'connection-error');assert.equal(result.setupRetry,undefined);assert.equal(result.failedPhase,'connecting');assert.match(result.log,/Failed to connect/);
 class Busy extends Loader{async main(){throw new DOMException('busy','NetworkError');}}
 const busy=await flashBrowserProgram({...options,Loader:Busy});assert.equal(busy.phase,'error');assert.match(busy.message,/USB-порт/);
});

test('rewired named motor PWM inside My blocks executes on the resolved GPIO in the native VM',()=>{
 const state=wiredProgram();state.wiring.wires.find(w=>w.b==='drv:IN1').a='esp:right-1';
 state.myBlocks=[{id:'motor',name:'Мій мотор',body:state.blocks.blocks[0].next.block}];
 state.blocks.blocks[0].next.block={type:'my_block_call',extraState:{definitionId:'motor'}};
 const result=execute(compile(state).bytes);assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PWM 23 180/);assert.doesNotMatch(result.stdout,/PWM 16 /);
});

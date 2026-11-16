import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsb,compileUsbState} from '../src/usb-compiler.js';
import {createUsbService,localRequest} from '../server/usb-workshop.js';

for(const [name,example]of Object.entries(usbExamples).filter(([name])=>!['empty','remote','console','toggle'].includes(name)))test(`USB ${name} emits a standalone Arduino program`,()=>{
 const code=compileUsbState(example.workspace);assert.match(code,/LED_PIN = 2/);assert.match(code,/MCAR_USB_BLOCKS BOOT/);assert.match(code,/while \(true\)/);assert.match(code,/setLed\(true\)/);assert.match(code,/setLed\(false\)/);assert.doesNotMatch(code,/WiFi|MOTOR_PINS/);
 if(name==='pulses')assert.match(code,/repeatCount\(3.000000f\)/);
});
test('USB compiler rejects missing inputs and robot blocks and never emits variable names as C++',()=>{
 const w=new Blockly.Workspace();try{
  Blockly.serialization.workspaces.load(usbExamples.blink.workspace,w);
  const wait=w.getAllBlocks().find(b=>b.type==='robot_wait');wait.getInputTargetBlock('TIME').dispose();assert.throws(()=>compileUsb(w),/порожнє/);
 }finally{w.dispose();}
 assert.throws(()=>compileUsbState(usbExamples.empty.workspace),/Додай/);
 assert.throws(()=>compileUsbState({blocks:{blocks:[{type:'robot_move'}]}}),/непідтримуваний/);
 assert.throws(()=>compileUsbState({customSerializer:{},blocks:{}}),/формат/);
 const state={variables:[{id:'x',name:'x; system("bad");',type:''}],blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:{type:'variables_set',fields:{VAR:{id:'x'}},inputs:{VALUE:{block:{type:'math_number',fields:{NUM:7}}}}}}}]}};
 const source=compileUsbState(state);assert.match(source,/v\[0\] = checked\(7.000000f\)/);assert.doesNotMatch(source,/system|bad/);
});
test('localhost boundary rejects remote addresses, foreign origins and DNS-rebinding hosts',()=>{
 const request=(address,host,origin)=>({socket:{remoteAddress:address},headers:{host,origin}});
 assert.ok(localRequest(request('127.0.0.1','localhost:5173','http://localhost:5173')));
 assert.ok(!localRequest(request('192.168.1.10','localhost:5173')));
 assert.ok(!localRequest(request('127.0.0.1','evil.example:5173')));
 assert.ok(!localRequest(request('127.0.0.1','localhost:5173','https://evil.example')));
});
test('import never silently remaps an invalid or input-only GPIO to the default pin',()=>{
 for(const [type,pin]of [['usb_pin_write','34'],['usb_pin_pwm','6'],['usb_pin_button','35'],['usb_pin_analog','23'],['usb_pin_read','1']]){
  const state={blocks:{blocks:[{type:'usb_start',next:{block:{type,fields:{PIN:pin}}}}]}};
  assert.throws(()=>compileUsbState(state),/пін не підтримує/);
 }
});
async function setup(t,options={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'mcar-usb-test-'));const calls=[];
 const service=createUsbService({baseDirectory:directory,listPorts:async()=>[{path:'/dev/cu.usbserial-test',label:'test'}],run:async(command,args,context)=>{calls.push({command,args});if(args.includes('compile')){const source=await readFile(path.join(args.at(-1),'sketch.ino'),'utf8');assert.match(source,/setLed\(true\)/);}if(command==='python3')context.onOutput('MCAR_USB_BLOCKS BOOT\nLED2=ON ms=1500\n');},...options});
 const server=http.createServer((req,res)=>service.middleware(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;const status=()=>fetch(base+'/api/usb/status').then(r=>r.json());const {token}=await status();
 const flash=(data={},headers={})=>fetch(base+'/api/usb/flash',{method:'POST',headers:{'Content-Type':'application/json','X-Mcar-USB-Token':token,...headers},body:JSON.stringify({port:'/dev/cu.usbserial-test',workspace:usbExamples.blink.workspace,...data})});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
 const finish=async()=>{for(let i=0;i<100;i++){if(service.job?.finished)return service.job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('job did not finish');};
 return {flash,calls,finish,status,service};
}
test('flash service compiles validated blocks, uploads selected USB port and verifies boot',async t=>{
 const {flash,calls,finish}=await setup(t);assert.equal((await flash()).status,202);const job=await finish();assert.equal(job.phase,'done');assert.equal(calls.length,3);assert.ok(calls[1].args.includes('/dev/cu.usbserial-test'));
});
test('flash service rejects CSRF, arbitrary port paths and raw source before executing anything',async t=>{
 const {flash,calls}=await setup(t);assert.equal((await flash({}, {'X-Mcar-USB-Token':'bad'})).status,403);assert.equal((await flash({}, {Origin:'https://evil.example'})).status,403);
 assert.equal((await flash({port:'/tmp/anything'})).status,400);assert.equal((await flash({workspace:{blocks:{blocks:[{type:'robot_move'}]}},source:'#include "bad"'})).status,400);assert.equal(calls.length,0);
});
test('failed compile never uploads; concurrent requests cannot start a second job',async t=>{
 let unblock;const wait=new Promise(resolve=>unblock=resolve);let count=0;
 const {flash,finish}=await setup(t,{run:async()=>{count++;await wait;throw Error('compile failed');}});
 assert.equal((await flash()).status,202);assert.equal((await flash()).status,409);unblock();const job=await finish();assert.equal(job.phase,'error');assert.equal(count,1);
});
test('uploaded firmware runtime errors are not reported as success',async t=>{
 const {flash,finish}=await setup(t,{run:async(command,args,{onOutput})=>{if(command==='python3')onOutput('MCAR_USB_BLOCKS BOOT\nPROGRAM_ERROR: division by zero\n');}});
 await flash();assert.equal((await finish()).phase,'runtime-error');
});

test('upload progress follows split esptool output and resets for each image',async t=>{
 let releaseUpload,arrived;const ready=new Promise(r=>arrived=r),hold=new Promise(r=>releaseUpload=r);
 const {flash,finish,service}=await setup(t,{run:async(command,args,{onOutput})=>{
  if(args.includes('upload')){
   onOutput('Compressed 25168 bytes to 16063...\nWriting at 0x00001000 [ ] 100.0% 16063/16063 bytes...\r');
   onOutput('Compressed 299488 bytes to 161100...\nWriting at 0x00010000 [ ] 4');
   onOutput('2.5% 68000/161100 bytes...\r');arrived();await hold;
  }
  if(command==='python3')onOutput('MCAR_USB_BLOCKS BOOT\n');
 }});
 await flash();await ready;
 assert.equal(service.job.uploadImage,2);assert.equal(service.job.uploadPercent,42.5);assert.ok(service.job.startedAt>0);
 releaseUpload();const job=await finish();assert.ok(job.finishedAt>=job.startedAt);assert.equal(job.phase,'done');
});

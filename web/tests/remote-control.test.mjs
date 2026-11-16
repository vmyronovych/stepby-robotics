import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode,crc32} from '../src/usb-bytecode.js';
import {compileUsbState} from '../src/usb-compiler.js';
import {remoteCommands} from '../src/remote-commands.js';
const root=path.resolve(import.meta.dirname,'../..');
const led=state=>({type:'usb_led',fields:{STATE:state}});
const handler=(command,event='PRESS',body=led('ON'))=>({type:'usb_remote',fields:{COMMAND:String(command),EVENT:event},next:{block:body}});
const state=(...blocks)=>({blocks:{languageVersion:0,blocks}});
function compile(project){const workspace=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(project,workspace);return compileUsbBytecode(workspace);}finally{workspace.dispose();}}
test('phone hats compile independently, round-trip, reject duplicates, boot actions and ADC2',()=>{
 const project=state({type:'usb_start'},handler(1),handler(1,'RELEASE',led('OFF')),handler(5));
 const program=compile(project);assert.deepEqual(program.code.filter(instruction=>instruction.op==='T').map(instruction=>instruction.value),[1,9,5]);assert.equal(program.code[0].op,'H');
 assert.throws(()=>compileUsbState(project),/браузерного USB/);
 assert.throws(()=>compile(state(handler(1),handler(1))),/вже є обробник/);
 assert.throws(()=>compile(state(handler(1),{type:'usb_start',next:{block:led('ON')}})),/При ввімкненні/);
 const analog={type:'robot_wait',inputs:{TIME:{block:{type:'usb_pin_analog',fields:{PIN:'4'}}}}};
 assert.throws(()=>compile(state(handler(1,'PRESS',analog))),/ADC1/);
 const firmware=readFileSync(path.join(root,'firmware/browser/remote_wifi.h'),'utf8');for(const label of remoteCommands)assert.ok(firmware.includes('"'+label+'"'));
});
test('the Blockly phone toggle remembers state between events and resets on reload, reboot and safety stop',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'mcar-toggle-'));
 try{
  const executable=path.join(directory,'vm'),file=path.join(directory,'toggle.bin');
  const built=spawnSync('c++',['-std=c++17','-Wall','-Wextra',path.join(root,'firmware/tests/usb_vm_runner.cpp'),'-o',executable],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  const project=structuredClone(usbExamples.toggle.workspace);
  function run(events){writeFileSync(file,compile(project).bytes);const result=spawnSync(executable,[file,...events],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.match(/WRITE 19 [01]/g)||[];}
  assert.deepEqual(run(['7','7','7','7']),['WRITE 19 1','WRITE 19 0','WRITE 19 1','WRITE 19 0']);
  for(const reset of ['reload','reboot','reset'])assert.deepEqual(run(['7',reset,'7','7']),['WRITE 19 1','WRITE 19 1','WRITE 19 0'],reset);
  const shared=structuredClone(project.blocks.blocks[0]);shared.fields.COMMAND='8';project.blocks.blocks.push(shared);
  assert.deepEqual(run(['7','8','7','8']),['WRITE 19 1','WRITE 19 0','WRITE 19 1','WRITE 19 0']);
  shared.fields.COMMAND='7';shared.fields.EVENT='RELEASE';
  assert.deepEqual(run(['7','15','7']),['WRITE 19 1','WRITE 19 0','WRITE 19 1']);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('real C++ VM waits at boot, dispatches handlers and independently rejects unsafe events',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'mcar-remote-'));
 try{
  for(const [source,binary] of [['usb_vm_runner.cpp','vm'],['remote_control_test.cpp','safety']]){
   const built=spawnSync('c++',['-std=c++17','-Wall','-Wextra',path.join(root,'firmware/tests',source),'-o',path.join(directory,binary)],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  }
  const safe=spawnSync(path.join(directory,'safety'),[],{encoding:'utf8'});assert.equal(safe.status,0,safe.stderr);
  const program=compile(state(handler(1),handler(1,'RELEASE',led('OFF'))));
  function run(bytes,event){const file=path.join(directory,'program.bin');writeFileSync(file,bytes);return spawnSync(path.join(directory,'vm'),[file,...event?[String(event)]:[]],{encoding:'utf8'});}
  assert.equal(run(program.bytes).stdout,'DONE\n');assert.equal(run(program.bytes,1).stdout,'0 ON\nDONE\n');assert.equal(run(program.bytes,9).stdout,'0 OFF\nDONE\n');assert.equal(run(program.bytes,2).status,2);
  function mutate(index,op,value){const bytes=program.bytes.slice(),view=new DataView(bytes.buffer);bytes[16+index*8]=op.charCodeAt(0);view.setFloat32(20+index*8,value,true);view.setUint32(12,crc32(bytes.subarray(16)),true);return bytes;}
  assert.equal(run(mutate(1,'T',17)).status,2);
  assert.equal(run(mutate(4,'T',1)).status,2);
  assert.equal(run(mutate(2,'J',5)).status,2);
  assert.equal(run(mutate(2,'o',2)).status,2);
  assert.equal(run(mutate(0,'L',1)).status,2);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode,crc32} from '../src/usb-bytecode.js';
import {compileUsbState} from '../src/usb-compiler.js';
import {consoleBytes,decodeConsoleLine} from '../src/console-text.js';
function compile(state){const workspace=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,workspace);return compileUsbBytecode(workspace);}finally{workspace.dispose();}}
const project=text=>({blocks:{blocks:[{type:'usb_start',next:{block:{type:'usb_print',fields:{TEXT:text}}}}]}});
test('console text preserves Unicode safely and limits framing and memory',()=>{
 for(const text of ['','Привіт із ESP32!','<script>alert(1)</script>','"; digitalWrite(2,1); //','🙂']){
  const bytes=consoleBytes({getFieldValue:()=>text});
  assert.equal(decodeConsoleLine('MCAR_LOG '+Buffer.from(bytes).toString('hex')),text);
  assert.ok(compile(project(text)).bytes.length);
  const source=compileUsbState(project(text));assert.match(source,/Serial.println\("MCAR_LOG [0-9a-f]*"\)/);
 }
 for(const value of ['REMOTE_WIFI: password=secret','MCAR_LOG ff','MCAR_LOG a','MCAR_LOG gg','MCAR_LOG '+ 'aa'.repeat(121)])assert.equal(decodeConsoleLine(value),null);
 assert.throws(()=>consoleBytes({getFieldValue:()=> 'a\nMCAR2 READY fake'}),/одним рядком/);
 assert.throws(()=>compile(project('Ї'.repeat(61))),/120 байтів/);
});
test('real VM executes phone console handlers, survives persistence format and rejects data jumps',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'mcar-console-'));
 try{
  const binary=path.join(directory,'vm');const result=spawnSync('c++',['-std=c++17',path.resolve(import.meta.dirname,'../../firmware/tests/usb_vm_runner.cpp'),'-o',binary],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const program=compile(usbExamples.console.workspace),file=path.join(directory,'program.bin');writeFileSync(file,program.bytes);
  assert.equal(spawnSync(binary,[file],{encoding:'utf8'}).stdout,'DONE\n');
  const output=spawnSync(binary,[file,'7'],{encoding:'utf8'});assert.equal(output.status,0,output.stderr);assert.equal(output.stdout,'LOG Кнопку отримано!\nLOG Готово\nDONE\n');
  for(const [index,op,value] of [[2,'M',121],[3,'b',10],[2,'J',3],[3,'L',1]]){
   const bytes=program.bytes.slice(),view=new DataView(bytes.buffer);bytes[16+index*8]=op.charCodeAt(0);view.setFloat32(20+index*8,value,true);view.setUint32(12,crc32(bytes.subarray(16)),true);writeFileSync(file,bytes);assert.equal(spawnSync(binary,[file,'7']).status,2);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});

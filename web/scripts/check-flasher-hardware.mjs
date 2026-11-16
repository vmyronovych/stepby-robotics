// Tests production esptool-js + firmware against real hardware, with a test-only
// Python serial adapter instead of the browser permission/driver layer.
import {ESPLoader} from 'esptool-js';
class DiagnosticLoader extends ESPLoader {debug(message){if(/Sync err|bootMode/.test(message))console.log(message);}}
import {TestSerialPort} from './serial-test-port.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Blockly,usbExamples} from '../src/usb-blocks.js';
import {compileUsbBytecode} from '../src/usb-bytecode.js';
import {flashBrowserProgram,loadFirmware} from '../src/browser-flasher.js';
if(!process.argv.includes('--flash-connected-esp32'))throw Error('Explicit --flash-connected-esp32 required.');
const root=path.resolve(import.meta.dirname,'../..');

const workspace=new Blockly.Workspace();Blockly.serialization.workspaces.load(usbExamples.blink.workspace,workspace);const program=compileUsbBytecode(workspace);workspace.dispose();
let lastPhase='';const job=await flashBrowserProgram({port:new TestSerialPort(),program,Loader:DiagnosticLoader,load:()=>loadFirmware(async url=>new Response(await fs.readFile(path.join(root,'web/public',url)))),onJob:j=>{if(j.phase!==lastPhase){lastPhase=j.phase;console.log(j.phase);}if(j.finished)console.log(j.message);}});
await fs.writeFile(path.join(root,'validation/esptool-js-hardware.json'),JSON.stringify({...job,transport:'Production esptool-js with test-only Python Web Streams adapter; NOT browser permission or Windows validation'},null,2));
console.log(job.log.split('\n').filter(line=>/Hash of data|MCAR_BROWSER|LED2=|PROGRAM_ERROR/.test(line)).join('\n'));
if(job.phase!=='done')process.exitCode=1;

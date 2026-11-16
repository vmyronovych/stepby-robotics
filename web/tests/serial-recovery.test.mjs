import test from 'node:test';
import assert from 'node:assert/strict';
import {withSerialConnection} from '../src/serial-session.js';
import {usbDiagnostic} from '../src/usb-diagnostics.js';
test('a stuck USB open reports its stage instead of waiting forever or opening twice',async()=>{
 let opens=0,lateOpen;
 const port={open(){opens++;return new Promise(resolve=>lateOpen=resolve);},async close(){},async setSignals(){}};
 const attempt=withSerialConnection(port,()=>assert.fail('must not send anything'),()=>{},{timeoutMs:20}).catch(error=>error);
 let timer;const result=await Promise.race([attempt,new Promise(resolve=>timer=setTimeout(()=>resolve('HUNG'),150))]);clearTimeout(timer);
 assert.notEqual(result,'HUNG');assert.equal(result.code,'USB_TIMEOUT');assert.equal(result.stage,'open');
 await assert.rejects(withSerialConnection(port,()=>{}),error=>error.code==='USB_TIMEOUT');assert.equal(opens,1);
 lateOpen();
});
for(const stage of ['write','cancel-read','close'])test(`stuck USB ${stage} is bounded and prevents reuse`,async()=>{
 const never=()=>new Promise(()=>{});let opens=0;
 const port={async open(){opens++;this.readable=new ReadableStream({cancel:stage==='cancel-read'?never:()=>{}});this.writable=new WritableStream({write:stage==='write'?never:()=>{}});},async setSignals(){},close:stage==='close'?never:async()=>{}};
 await assert.rejects(withSerialConnection(port,stream=>stream.send('HELLO'),()=>{},{timeoutMs:20}),error=>error.code==='USB_TIMEOUT'&&error.stage===stage);
 await assert.rejects(withSerialConnection(port,()=>assert.fail('must not reuse')) ,error=>error.code==='USB_TIMEOUT');
 assert.equal(opens,1);
});
test('USB diagnostics retain the failure and hide board credentials',()=>{
 const result=usbDiagnostic({stage:'open',message:'NetworkError: busy',log:'REMOTE_WIFI: Mandrivnyk-123 password=secret http://192.168.4.1\nTeacher PIN: 1234\nLED2=ON',port:{getInfo:()=>({usbVendorId:0x10c4,usbProductId:0xea60})},now:new Date('2026-11-16T08:00:00Z')});
 assert.match(result,/NetworkError: busy/);assert.match(result,/10c4.*ea60/);assert.match(result,/LED2=ON/);assert.doesNotMatch(result,/secret|1234/);
});

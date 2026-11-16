// Test-only adapter; never shipped to the browser.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
export class TestSerialPort{
 constructor(signalMode='atomic'){this.signalMode=signalMode;}
 getInfo(){return {usbVendorId:0x10c4,usbProductId:0xea60};}
 async open({baudRate}){
  this.pending=new Map();const pending=this.pending;this.seq=0;this.child=spawn('python3',[path.join(root,'tools/serial_test_bridge.py'),'/dev/cu.usbserial-0001',String(baudRate),this.signalMode]);
  this.readable=new ReadableStream({start:c=>this.controller=c,cancel:()=>{this.cancelled=true;}});this.cancelled=false;
  this.writable=new WritableStream({write:bytes=>this.request({op:'write',data:Buffer.from(bytes).toString('base64')})});
  this.child.stderr.on('data',data=>process.stderr.write(data));
  const opened=new Promise((resolve,reject)=>this.pending.set(0,{resolve,reject}));
  createInterface({input:this.child.stdout}).on('line',line=>{const value=JSON.parse(line);if(value.data){if(!this.cancelled)this.controller.enqueue(new Uint8Array(Buffer.from(value.data,'base64')));}else{const p=this.pending.get(value.id);this.pending.delete(value.id);if(value.error)p?.reject(Error(value.error));else p?.resolve();}});
  this.child.on('exit',code=>{for(const p of pending.values())p.reject(Error('Serial bridge exited '+code));pending.clear();});
  await opened;
 }
 request(data){return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject});this.child.stdin.write(JSON.stringify({id,...data})+'\n');});}
 setSignals(signals){return this.request({op:'signals',signals});}
 async close(){if(!this.child)return;await this.request({op:'close'});this.child=null;if(!this.cancelled)this.controller.close();this.readable=this.writable=null;}
}

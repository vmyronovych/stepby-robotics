const encode=new TextEncoder();
export class ReplyTimeout extends Error {}
class SerialLines {
 constructor(port,log,state){
  this.port=port;this.log=log;this.state=state;this.queue=[];this.pending=null;this.failure=null;this.reader=port.readable.getReader();
  this.pump=this.read();
 }
 async read(){
  const decoder=new TextDecoder();let text='';
  try{while(true){const {value,done}=await this.reader.read();if(done)throw Error('USB-з’єднання закрито.');text+=decoder.decode(value,{stream:true});let end;while((end=text.indexOf('\n'))>=0){const line=text.slice(0,end).replace(/\r$/,'');text=text.slice(end+1);this.log(line+'\n');if(this.pending){const {resolve}=this.pending;this.pending=null;resolve(line);}else{this.queue.push(line);if(this.queue.length>256)this.queue.shift();}}if(text.length>4096)text=text.slice(-4096);}}
  catch(error){this.failure=error;this.pending?.reject(error);this.pending=null;}
 }
 next(timeout){
  if(this.queue.length)return Promise.resolve(this.queue.shift());
  if(this.failure)return Promise.reject(this.failure);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending=null;reject(new ReplyTimeout('Плата не відповіла вчасно.'));},timeout);this.pending={resolve:line=>{clearTimeout(timer);resolve(line);},reject:error=>{clearTimeout(timer);reject(error);}};});
 }
 async send(text){
  const writer=this.port.writable.getWriter();
  try{await serialStep(this.state,'write',()=>writer.write(encode.encode(text+'\n')));}
  finally{writer.releaseLock();}
 }
 async close(){try{try{await serialStep(this.state,'cancel-read',()=>this.reader.cancel());}catch(error){if(error.code==='USB_TIMEOUT'||!this.failure)throw error;}await serialStep(this.state,'finish-read',()=>this.pump);}finally{try{this.reader.releaseLock();}catch{}}}
}

const connections=new WeakMap();
function stateFor(port){
 let state=connections.get(port);
 if(!state){state={tail:Promise.resolve(),stream:null,listeners:new Set(),timeoutMs:5000,blocked:null};connections.set(port,state);}
 return state;
}
function enqueue(state,operation){
 const result=state.tail.then(operation);
 state.tail=result.catch(()=>{});
 return result;
}
async function open(port,state){
 if(state.blocked)throw state.blocked;
 if(state.stream?.failure)await close(port,state);
 if(state.stream)return state.stream;
 const opening=port.open({baudRate:115200});
 void opening.then(()=>{if(state.blocked)void port.close().catch(()=>{});},()=>{});
 await serialStep(state,'open',()=>opening);
 try{
  await serialStep(state,'signals',()=>port.setSignals({dataTerminalReady:false,requestToSend:false}));
  const stream=new SerialLines(port,line=>{for(const listener of state.listeners)listener.line(line);},state);state.stream=stream;
  stream.pump.then(()=>{if(state.stream===stream)for(const listener of state.listeners)listener.error?.(stream.failure);});
  return state.stream;
 }catch(error){try{await serialStep(state,'close',()=>port.close());}catch{}throw error;}
}
async function close(port,state){
 const stream=state.stream;if(!stream)return;
 state.stream=null;
 try{await stream.close();}finally{try{await serialStep(state,'close',()=>port.close());}catch(error){if(error.code==='USB_TIMEOUT'||port.readable||port.writable)throw error;}}
}
function serialStep(state,stage,operation){
 let timer;
 return Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>{
  const error=Error('USB-з’єднання зависло на етапі «'+stage+'». Від’єднай USB, онови сторінку й підключи плату знову. Запис повторно не запускався.');
  error.code='USB_TIMEOUT';error.stage=stage;state.blocked||=error;reject(error);
 },state.timeoutMs);})]).finally(()=>clearTimeout(timer));
}
export function withSerialConnection(port,operation,log=()=>{},{timeoutMs=5000}={}){
 const state=stateFor(port);
 return enqueue(state,async()=>{
  state.timeoutMs=timeoutMs;
  const listener={line:log};
  state.listeners.add(listener);
  try{return await operation(await open(port,state));}
  finally{state.listeners.delete(listener);if(!state.listeners.size)await close(port,state);}
 });
}
export function watchSerialConnection(port,onLine,onError){
 const state=stateFor(port);
 return enqueue(state,async()=>{
  const listener={line:onLine,error:onError};state.listeners.add(listener);
  try{await open(port,state);}catch(error){state.listeners.delete(listener);throw error;}
  let stopped=false;
  return ()=>enqueue(state,async()=>{if(stopped)return;stopped=true;state.listeners.delete(listener);if(!state.listeners.size)await close(port,state);});
 });
}

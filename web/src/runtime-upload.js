// MCAR2 is a small, acknowledged protocol over the already-running runtime.
// It never asserts reset or enters the ESP ROM bootloader.
export const RUNTIME_ID='gpio2-v5';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
import {ReplyTimeout,withSerialConnection} from './serial-session.js';

export async function uploadAlgorithm({port,program,onProgress=()=>{},log=()=>{},probeTimeout=3500,ackTimeout=4000,settleMs=750,probeOnly=false}){
 return withSerialConnection(port,async stream=>{
 let recognized=false,saved=false;
 const nonce=hex(crypto.getRandomValues(new Uint8Array(8)));
 const prefix=`MCAR2 `,command=(name,args='')=>stream.send(`${prefix}${name} ${nonce}${args?' '+args:''}`);
 async function waitFor(verb,value,timeout=ackTimeout){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const line=await stream.next(Math.max(1,deadline-Date.now()));
   if(line.startsWith(`${prefix}ERROR ${nonce} `))throw Error('Плата відхилила програму: '+line.split(' ').slice(3).join(' ')+'. Перевір блоки й повтори передавання.');
   if(line.startsWith(`${prefix}${verb} ${nonce} `)){const reply=line.split(' ').slice(3).join(' ');if(value===undefined||reply===value)return reply;}
  }
  throw new ReplyTimeout('Плата не відповіла вчасно.');
 }
 try{
  stream.queue.length=0;
  const deadline=Date.now()+probeTimeout;let ready;
  while(Date.now()<deadline){
   await command('HELLO');
   try{ready=await waitFor('READY',undefined,Math.min(400,Math.max(1,deadline-Date.now())));break;}
   catch(error){if(!(error instanceof ReplyTimeout))throw error;}
  }
  if(!ready)return null;
  const [runtime,max]=ready.split(' ');
  if(!/^gpio2-v\d+$/.test(runtime)||!Number.isSafeInteger(Number(max))||Number(max)<=0)return null;
  const compatible=runtime===RUNTIME_ID&&Number(max)>=(probeOnly?16400:program.bytes.length);
  if(probeOnly)return {runtime,maxBytes:Number(max),compatible};
  if(!compatible)return {phase:'setup-required',mode:'install',reason:'runtime-version',message:`Плата відповіла: ${runtime}. Для цих блоків потрібна ${RUNTIME_ID}. Оновлення базової прошивки — окрема дія.`};
  recognized=true;onProgress({phase:'uploading',mode:'algorithm',uploadPercent:0,overallProgress:true});
  await command('BEGIN',`${program.bytes.length} ${program.checksum}`);await waitFor('ACCEPT','0');
  for(let offset=0;offset<program.bytes.length;offset+=256){const chunk=program.bytes.subarray(offset,offset+256),end=offset+chunk.length;
   await command('DATA',`${offset} ${hex(chunk)}`);await waitFor('ACK',String(end));
   onProgress({phase:'uploading',mode:'algorithm',uploadPercent:Math.floor(end/program.bytes.length*100),overallProgress:true});
  }
  onProgress({phase:'verifying',mode:'algorithm',uploadPercent:100});
  await command('COMMIT');await waitFor('SAVED',program.checksum);saved=true;await waitFor('RUNNING',program.checksum);
  // A valid algorithm can still fail at runtime, e.g. division by zero. Observe
  // its initial execution; success is not a proof about an arbitrary future loop.
  const settle=Date.now()+settleMs;
  while(Date.now()<settle){try{const line=await stream.next(Math.max(1,settle-Date.now()));if(line.includes('PROGRAM_ERROR:'))return {phase:'runtime-error',message:'Алгоритм збережено, але він зупинився з помилкою. Перевір блоки.'};}catch(error){if(error instanceof ReplyTimeout)break;throw error;}}
  return {phase:'done',message:'Готово! Новий алгоритм збережено й запущено — без BOOT.'};
 }catch(error){
  if(recognized&&error instanceof ReplyTimeout)throw Error(saved?'Алгоритм збережено, але запуск не підтверджено. Перевір плату й повтори передавання.':'Не вдалося підтвердити запис алгоритму. Перепідключи USB й повтори передавання.');
  throw error; // Never fall through to a ROM flash after a recognized receiver fails.
 }
 },log);
}

// Readiness check only: HELLO never changes the stored or running algorithm.
export const probeRuntime=options=>uploadAlgorithm({...options,probeOnly:true});

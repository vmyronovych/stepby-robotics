import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readdir,mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileUsbState} from '../src/usb-compiler.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=path.join(root,'tools/arduino-bin/arduino-cli');
const config=path.join(root,'.cache/arduino-cli.yaml');
export async function usbPorts(){
 if(process.platform!=='darwin')return [];
 return (await readdir('/dev')).filter(name=>/^cu\.(usbserial|usbmodem|wchusbserial|SLAB_USBtoUART)[\w.-]*$/.test(name)).sort().map(name=>({path:'/dev/'+name,label:name.replace(/^cu\./,'')}));
}
export function localRequest(req){
 const address=req.socket.remoteAddress;
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return false;
 try{const expected=new URL('http://'+req.headers.host);if(!['127.0.0.1','localhost','[::1]'].includes(expected.hostname))return false;return !req.headers.origin||req.headers.origin===expected.origin;}catch{return false;}
}
function execute(command,args,{onOutput,timeout=180000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,shell:false,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let expired=false,forceTimer;
  const kill=signal=>{try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch{}};
  const timer=setTimeout(()=>{expired=true;kill('SIGTERM');forceTimer=setTimeout(()=>kill('SIGKILL'),2000);},timeout);
  const output=data=>onOutput?.(data.toString());child.stdout.on('data',output);child.stderr.on('data',output);
  child.on('error',error=>{clearTimeout(timer);clearTimeout(forceTimer);reject(error)});
  child.on('close',code=>{clearTimeout(timer);clearTimeout(forceTimer);if(expired)reject(Error('Час виконання вичерпано. Перевір USB і повтори.'));else if(code!==0)reject(Error(`Команда завершилася з помилкою (${code}). Перевір журнал нижче.`));else resolve();});
 });
}
export function createUsbService({listPorts=usbPorts,run=execute,baseDirectory=path.join(root,'.cache/usb-workshop')}={}){
 let current=null;const token=randomBytes(32).toString('hex');
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 function authorized(req){const value=req.headers['x-mcar-usb-token'];return typeof value==='string'&&value.length===token.length&&timingSafeEqual(Buffer.from(value),Buffer.from(token));}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>120000)throw Error('Файл завеликий.');}return JSON.parse(text);}
 async function perform(job,source){
  let outputBuffer='';
  const log=text=>{
   const clean=stripVTControlCharacters(text).replaceAll('\r','\n');
   job.log=(job.log+clean).slice(-24000);
   if(job.phase!=='uploading')return;
   outputBuffer+=clean;
   const lines=outputBuffer.split('\n');outputBuffer=lines.pop().slice(-4000);
   for(const line of lines){
    if(/Compressed \d+ bytes to \d+/.test(line)){job.uploadImage=(job.uploadImage||0)+1;job.uploadPercent=null;}
    const match=line.match(/Writing at 0x[0-9a-f]+.*?([\d.]+)%/i);
    if(match)job.uploadPercent=Math.max(0,Math.min(100,Number(match[1])));
   }
  };
  try{
   const dir=path.join(baseDirectory,job.id),sketch=path.join(dir,'sketch'),build=path.join(dir,'output');await mkdir(sketch,{recursive:true});await mkdir(build,{recursive:true});await writeFile(path.join(sketch,'sketch.ino'),source);
   job.phase='compiling';job.message='Компілюємо твої блоки…';
   await run(cli,['compile','--config-file',config,'--fqbn','esp32:esp32:esp32','--build-path',path.join(baseDirectory,'cache'),'--output-dir',build,sketch],{onOutput:log,timeout:240000});
   if(!(await listPorts()).some(p=>p.path===job.port))throw Error('ESP32 від’єднано. Підключи USB та повтори.');
   job.phase='uploading';job.message='Записуємо на ESP32. Залиш USB підключеним.';
   await run(cli,['upload','--config-file',config,'--fqbn','esp32:esp32:esp32:UploadSpeed=115200','--port',job.port,'--input-dir',build,sketch],{onOutput:log,timeout:120000});
   job.phase='verifying';job.message='Перевіряємо запуск програми…';let serial='';
   try{
    await run('python3',[path.join(root,'tools/monitor_usb_blocks.py'),job.port],{onOutput:text=>{serial+=text;log(text)},timeout:15000});
    if(serial.includes('PROGRAM_ERROR:')){job.phase='runtime-error';job.message='Записано, але програма зупинилася з помилкою. Перевір числа у блоках.';}
    else if(serial.includes('MCAR_USB_BLOCKS BOOT')){job.phase='done';job.message='Прошито! Твоя програма запустилася на ESP32.';}
    else{job.phase='uploaded';job.message='Прошито. Запуск через Serial не підтверджено — перевір світлодіод.';}
   }catch{job.phase='uploaded';job.message='Прошито. Serial недоступний — перевір світлодіод на платі.';}
  }catch(error){job.failedPhase=job.phase;job.phase='error';job.message=error.message;log('\n'+error.message+'\n');}
  finally{job.finished=true;job.finishedAt=Date.now();}
 }
 async function middleware(req,res,next){
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/usb/'))return next();
  if(!localRequest(req))return json(res,403,{error:'USB-майстерня доступна лише локально з цього комп’ютера.'});
  try{
   if(req.method==='GET'&&url.pathname==='/api/usb/status'){
    let ready=true;try{await access(cli);await access(config)}catch{ready=false;}
    return json(res,200,{token,ready,platform:process.platform,ports:await listPorts(),job:current});
   }
   if(req.method==='POST'&&url.pathname==='/api/usb/flash'){
    if(!authorized(req))return json(res,403,{error:'Онови сторінку перед прошиванням.'});
    if(current&&!current.finished)return json(res,409,{error:'Прошивання вже триває. Дочекайся завершення.'});
    // Reserve before awaiting the body so parallel requests cannot both start jobs.
    const job={id:randomUUID(),startedAt:Date.now(),phase:'validating',message:'Перевіряємо блоки…',log:'',finished:false};current=job;
    try{
     const data=await body(req);const ports=await listPorts();if(!ports.some(p=>p.path===data.port))throw Error('Обери підключену USB-плату ESP32.');
     const source=compileUsbState(data.workspace);job.port=data.port;
     // No user source, commands, paths, CLI flags or board definitions are accepted.
     void perform(job,source);return json(res,202,{id:job.id});
    }catch(error){job.phase='error';job.message=error.message;job.finished=true;job.finishedAt=Date.now();return json(res,400,{error:error.message});}
   }
   return json(res,404,{error:'Невідомий запит USB-майстерні.'});
  }catch(error){return json(res,400,{error:error.message});}
 }
 return {middleware,get job(){return current}};
}
export function usbWorkshopPlugin(){return {name:'local-usb-workshop',configureServer(server){server.middlewares.use(createUsbService().middleware);}};}

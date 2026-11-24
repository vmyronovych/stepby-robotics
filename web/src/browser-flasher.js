import {ESPLoader,Transport} from 'esptool-js';
import {md5} from '@noble/hashes/legacy.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {PROGRAM_ADDRESS,crc32} from './usb-bytecode.js';
import {uploadAlgorithm} from './runtime-upload.js';
import {usbConnectionIssue} from './usb-connection-issue.js';
const base=import.meta.env?.BASE_URL||'/';
const manifestPath=base+'firmware/esp32-gpio-v2/manifest.json';
export async function loadFirmware(fetcher=fetch){
 const response=await fetcher(manifestPath,{cache:'no-cache',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Не вдалося завантажити прошивку. Перевір інтернет і повтори.');
 const manifest=await response.json();
 const expected=[['bootloader.bin',0x1000,0x7000],['partitions.bin',0x8000,0x1000],['runtime.bin',0x10000,0x300000]];
 if(manifest.format!==1||manifest.version!=='esp32-gpio-v2'||manifest.chip!=='ESP32'||manifest.flashBytes!==4194304||manifest.programAddress!==PROGRAM_ADDRESS||manifest.programSize!==0x10000||manifest.files?.length!==3)throw Error('Несумісний пакет прошивки. Онови сторінку.');
 const files=await Promise.all(manifest.files.map(async(file,i)=>{
  const [name,address,maxSize]=expected[i];if(file.file!==name||file.address!==address||!Number.isInteger(file.size)||file.size<=0||file.size>maxSize||!/^[0-9a-f]{64}$/.test(file.sha256))throw Error('Некоректний пакет прошивки.');
  const response=await fetcher(base+'firmware/esp32-gpio-v2/'+name,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Не вдалося завантажити '+name);
  const data=new Uint8Array(await response.arrayBuffer());const digest=bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
  if(data.length!==file.size||digest!==file.sha256)throw Error('Файл прошивки пошкоджено. Онови сторінку та повтори.');
  return {data,address};
 }));
 return {manifest,files};
}
export function serialError(error){
 if(error.name==='NotFoundError')return 'Вибір плати скасовано. Натисни «Прошити», коли будеш готовий.';
 if(error.name==='SecurityError')return 'Браузер заборонив USB. Відкрий сайт у Chrome або Edge через HTTPS; у шкільному класі звернися до вчителя.';
 if(error.name==='NetworkError'||error.name==='InvalidStateError')return 'Не вдалося відкрити USB-порт. Закрий Arduino IDE, монітор порту та інші вкладки з цією платою. Перепідключи USB й повтори.';
 if(/Failed to connect|Wrong boot mode/i.test(error.message))return 'Не вдалося з’єднатися з ESP32. Повтори запис і утримуй BOOT, поки з’явиться етап «Запис». Перевір також USB-кабель.';
 return error.message||'Зв’язок із платою перервано. Перепідключи USB й повтори.';
}
export async function flashBrowserProgram({port,program,onJob=()=>{},load=loadFirmware,Loader=ESPLoader,SerialTransport=Transport,verify=verifyBoot,runtimeUpload=uploadAlgorithm,install=false}){
 const job={id:crypto.randomUUID(),startedAt:Date.now(),phase:'compiling',finished:false,log:'',message:'Готуємо програму у браузері…'};
 let transport,loader,timer,aborted=false;
 const active=()=>{if(aborted)throw Error('Операцію зупинено через таймаут.');};
 const emit=()=>onJob({...job});const log=text=>{job.log=(job.log+String(text)).slice(-24000);};
 emit();
 try{
  if(!(program.bytes instanceof Uint8Array)||program.bytes.length<24||program.bytes.length>16400||crc32(program.bytes.subarray(16)).toString(16).padStart(8,'0')!==program.checksum)throw Error('Програму пошкоджено. Склади блоки ще раз.');
  if(!install){
   job.phase='connecting';job.mode='detecting';emit();
   const result=await runtimeUpload({port,program,log,onProgress:progress=>{Object.assign(job,progress);emit();}});
   if(result){Object.assign(job,result);return job;}
   job.mode='detecting';job.phase='connection-error';job.connectionIssue=usbConnectionIssue();job.message=job.connectionIssue.message;
   return job;
  }
  job.mode='install';job.phase='compiling';log('Встановлення базової прошивки: один раз для цієї версії майстерні.\n');emit();
  // Fetch and verify the complete package BEFORE opening or writing the board.
  const {files}=await load();
  // A fresh installation must invalidate BOTH old algorithm slots, otherwise an
  // older committed slot could win over the newly supplied legacy-format image.
  const initial=new Uint8Array(0x10000).fill(255);initial.set(program.bytes);files.push({data:initial,address:PROGRAM_ADDRESS});
  job.phase='connecting';emit();
  transport=new SerialTransport(port,false);loader=new Loader({transport,baudrate:115200,romBaudrate:115200,terminal:{clean(){},write:log,writeLine:text=>log(text+'\n')}});
  // Timeout closes the transport, which also interrupts a pending serial read.
  const work=async()=>{
   await loader.main();active();
   if(loader.chip?.CHIP_NAME!=='ESP32')throw Error('Ця майстерня підтримує ESP32 / ESP-WROOM-32. Для ESP32-C3/S3 потрібна інша прошивка; запис не розпочато.');
   const flashSize=await loader.detectFlashSize();active();if(!flashSize||loader.flashSizeBytes(flashSize)<4194304)throw Error('Потрібна ESP32 із щонайменше 4 МБ flash. Запис не розпочато.');
   job.phase='uploading';emit();
   const total=files.reduce((sum,f)=>sum+f.data.length,0);let previous=0;
   await loader.writeFlash({fileArray:files,flashMode:'keep',flashFreq:'keep',flashSize:'keep',eraseAll:false,compress:true,
    calculateMD5Hash:data=>bytesToHex(md5(data)),
    reportProgress:(index,written,size)=>{const before=files.slice(0,index).reduce((sum,f)=>sum+f.data.length,0);const percent=Math.min(100,Math.floor((before+files[index].data.length*(size?written/size:0))*100/total));previous=Math.max(previous,percent);job.uploadPercent=previous;job.overallProgress=true;emit();}});
   active();job.phase='verifying';job.uploadPercent=100;emit();
   // Explicitly assert reset: esptool-js 0.7.1 HardReset only releases RTS.
   await transport.setDTR(false);await transport.setRTS(true);
   await loader.after('hard_reset');await transport.disconnect();transport=null;
   const result=await verify(port,program.checksum,log);
   active();job.phase=result.phase;job.message=result.message;
  };
  await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{aborted=true;reject(Error('Час запису вичерпано. Перепідключи USB та повтори.'));},180000);})]);
 }catch(error){job.failedPhase=job.phase;job.phase='error';job.message=serialError(error);
  if(job.mode==='detecting'&&job.failedPhase==='connecting'){
   job.phase='connection-error';job.connectionIssue=usbConnectionIssue(error);job.message=job.connectionIssue.message;
  }
  if(job.mode==='install'&&job.failedPhase==='connecting'&&/Failed to connect|Wrong boot mode/i.test(error.message)){
   job.phase='connection-error';job.message='Не вдалося встановити зв’язок із завантажувачем ESP32. Запис не розпочався. Відпусти BOOT, перепідключи USB і спочатку перевір звичайне підключення. Причина є в діагностиці; повторне встановлення — лише окремою дією.';
  }
  log('\n'+error.name+(error.stage?' ['+error.stage+']':'')+': '+error.message+'\n');}
 finally{clearTimeout(timer);try{await transport?.disconnect();}catch{}job.finished=true;job.finishedAt=Date.now();emit();}
 return job;
}
export async function verifyBoot(port,checksum,log){
 let reader,timer,serial='';
 try{
  await port.open({baudRate:115200});await port.setSignals({dataTerminalReady:false,requestToSend:false});
  reader=port.readable.getReader();
  timer=setTimeout(()=>{void reader.cancel().catch(()=>{});},7000);
  const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;const text=decoder.decode(value,{stream:true});serial=(serial+text).slice(-16000);log(text);}
  if(serial.includes('PROGRAM_ERROR:'))return {phase:'runtime-error',message:'Записано, але програма зупинилася з помилкою. Перевір числа у блоках.'};
  if(serial.includes('MCAR_BROWSER_V1 BOOT '+checksum))return {phase:'done',message:'Готово! Твоя програма запустилася на ESP32.'};
  return {phase:'uploaded',message:'Програму записано й перевірено у flash. Запуск не підтверджено — натисни EN і перевір світлодіод.'};
 }catch{return {phase:'uploaded',message:'Програму записано й перевірено у flash. Не вдалося прочитати запуск — перевір світлодіод.'};}
 finally{clearTimeout(timer);reader?.releaseLock();try{await port.close();}catch{}}
}

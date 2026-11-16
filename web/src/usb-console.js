import {watchSerialConnection} from './serial-session.js';
import {decodeConsoleLine} from './console-text.js';
export function initUsbConsole(root,{onConnectionError=()=>{}}={}){
 const output=root.querySelector('[data-console-output]'),status=root.querySelector('[data-console-status]');
 let wanted=null,current=null,stop=null,work=Promise.resolve(),failed=null;
 function append(message){
  const row=document.createElement('div');
  row.textContent=new Date().toLocaleTimeString('uk-UA')+'  '+message;
  output.append(row);while(output.children.length>200)output.firstChild.remove();output.scrollTop=output.scrollHeight;
 }
 function line(text){
  for(const raw of text.split('\n')){
   const value=raw.replace(/\r$/,'');const message=decodeConsoleLine(value);
   if(message!==null)append(message);
   else if(value.startsWith('PROGRAM_ERROR:'))append('Помилка ESP32: '+value.slice(14));
   else if(/^MCAR_LOG_DROPPED \d+$/.test(value))append('Пропущено повідомлень: '+value.split(' ')[1]+'. Додай паузу в цикл.');
  }
 }
 async function reconcile(){
  while(current!==wanted){
   if(stop){await stop();stop=null;}current=null;
   const port=wanted;
   if(!port){status.textContent='USB не підключено · підключи ESP32';return;}
   status.textContent='Підключаємо консоль…';
   try{
    const release=await watchSerialConnection(port,text=>{if(wanted===port)line(text);},error=>{if(error&&current===port&&wanted===port){failed=port;status.textContent='Зв’язок втрачено · перепідключи USB';onConnectionError(port,error);}});
    if(wanted!==port){await release();continue;}
    stop=release;current=port;status.textContent='Наживо з ESP32 · USB';
   }catch{failed=port;wanted=null;status.textContent='USB зайнятий або недоступний · закрий інші монітори порту';return;}
  }
 }
 function setPort(port){
  if(!port)failed=null;
  if((port&&port===failed)||port===wanted)return work;
  wanted=port;work=work.then(reconcile).catch(()=>{current=null;status.textContent='Не вдалося закрити USB. Перепідключи плату.';});return work;
 }
 root.querySelector('[data-console-clear]').onclick=()=>output.replaceChildren();
 root.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));
 return {setPort,pause:()=>setPort(null),line};
}

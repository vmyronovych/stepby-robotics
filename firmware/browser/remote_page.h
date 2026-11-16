#pragma once
static const char REMOTE_PAGE[] PROGMEM=R"HTML(<!doctype html>
<html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Мандрівник · Пульт</title>
<style>body{font:20px system-ui;max-width:560px;margin:auto;padding:20px;background:#f3f6f1;color:#233d32}button{font:inherit;min-height:76px;border:0;border-radius:16px;padding:16px;background:#236950;color:white;touch-action:none;user-select:none}button:disabled{opacity:.4}button:active{background:#163e30}#buttons{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}#stop{background:#b52626;width:100%;font-weight:bold}#connect{width:100%}small{display:block;margin:14px 0}#status{min-height:3em}</style>
<h1 id="name">Мандрівник</h1><p id="status" role="status">Завантаження…</p>
<button id="connect">Підключити пульт</button><small>Кнопки з ↕ утримуй для руху. Відпускання зупиняє виходи перед виконанням твоїх блоків.</small>
<div id="buttons"></div><button id="stop">СТОП</button>
<script>
let token='',sequence=0,held=0,pending=false,epoch=0,queue=Promise.resolve();
const status=document.querySelector('#status'),connect=document.querySelector('#connect'),buttons=document.querySelector('#buttons');
function locked(message){token='';held=0;epoch++;status.textContent=message;connect.disabled=false;buttons.querySelectorAll('button').forEach(button=>button.disabled=true);}
async function post(path,body){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(650)});if(!response.ok)throw Error(await response.text());return response.text();}
function send(path,extra={}){const generation=epoch;queue=queue.then(async()=>{if(!token||generation!==epoch)return;try{await post(path,{token,seq:String(++sequence),...extra});}catch(error){if(generation===epoch)emergency('Зупинено: '+error.message);}});return queue;}
function emergency(message='Зупинено. Підключи пульт знову.'){if(token)fetch('/remote/stop',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token,seq:String(++sequence)}),keepalive:true}).catch(()=>{});locked(message);}
connect.onclick=async()=>{connect.disabled=true;const generation=++epoch;try{const next=await post('/remote/claim',{});if(generation!==epoch)return;token=next;sequence=0;held=0;status.textContent='Пульт підключено';buttons.querySelectorAll('button').forEach(button=>button.disabled=false);}catch(error){if(generation===epoch)locked(error.message);}};
document.querySelector('#stop').onclick=()=>emergency();
document.addEventListener('visibilitychange',()=>{if(document.hidden)emergency();});
window.addEventListener('pagehide',()=>emergency());window.addEventListener('blur',()=>emergency());
setInterval(async()=>{if(!token||pending)return;pending=true;try{await send('/remote/heartbeat',{held:String(held)});}finally{pending=false;}},200);
fetch('/remote/info').then(response=>response.json()).then(info=>{
 document.querySelector('#name').textContent=info.name;
 for(const command of info.commands){
  const button=document.createElement('button');button.textContent=command.name+(command.hold?' ↕':'');button.disabled=true;buttons.append(button);
  if(command.hold){
   button.onpointerdown=event=>{if(held||!token)return;event.preventDefault();button.setPointerCapture(event.pointerId);held=command.id;send('/remote/event',{event:String(command.id)});};
   button.onpointerup=event=>{if(held!==command.id)return;event.preventDefault();held=0;send('/remote/event',{event:String(command.id+8)});};
   button.onpointercancel=()=>emergency();button.onlostpointercapture=()=>{if(held===command.id)emergency();};
  }else button.onclick=()=>send('/remote/event',{event:String(command.id)});
 }
 locked(info.commands.length?'Натисни «Підключити пульт».':'Немає команд. Завантаж блоки «коли на телефоні» через USB.');
}).catch(()=>locked('Не вдалося прочитати програму. Перезавантаж сторінку.'));
</script></html>)HTML";

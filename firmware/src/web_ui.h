#pragma once
#include <Arduino.h>
const char WEB_UI[] PROGMEM = R"ROBOT(<!doctype html>
<html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Мандрівник</title><style>
*{box-sizing:border-box}body{font:18px system-ui,sans-serif;background:#f3f6f9;color:#14263d;margin:0 auto;padding:20px;max-width:950px}
h1{font-size:32px}h2{font-size:24px}section{background:white;padding:20px;border-radius:18px;margin:18px 0}button,input,select{font:inherit;padding:12px;border-radius:10px;border:1px solid #adc0d3;margin:4px}button{background:#e3edf9;color:#14263d;cursor:pointer;touch-action:none}button:focus-visible{outline:3px solid #df6900}.stop{background:#b82032;color:white;font-weight:bold;font-size:25px}.pad{display:grid;grid-template-columns:repeat(3,1fr);max-width:470px}.pad button{user-select:none;min-height:65px}.pad .up{grid-column:2}.pad .back{grid-column:2}.hint{font-size:16px;color:#435872}#status{padding:12px;background:#dfeaf3;border-radius:10px;min-height:50px}#program{list-style:none;padding:0}.block{border-radius:8px;background:#1765bb;color:white;margin:8px 0;padding:10px;box-shadow:0 3px #0a4587;display:flex;align-items:center;flex-wrap:wrap;gap:5px}.block input{width:100px;background:white;color:#14263d}.block button{padding:5px 12px;font-size:18px}.sensors{display:flex;gap:8px;flex-wrap:wrap}.sensor{padding:14px;background:#e5eafa;border-radius:10px}input[type=range]{max-width:90%;width:400px}.tools{display:flex;flex-wrap:wrap}.tools button{background:#d7e9ff}label{display:block}details{margin:20px 0}a{color:#1765bb}
</style><h1>Мандрівник</h1><p>Моя програма. Мій робот.</p><p id="status" role="status" aria-live="polite">З'єднання…</p>
<button class="stop" id="stop">СТОП</button>
<section><h2>Кермо</h2><p class="hint">Тримай кнопку для руху. Відпусти, щоб зупинити.</p>
<div class="pad"><button class="up" data-dir="F">Вперед ↑</button><button data-dir="L">← Ліворуч</button><button data-dir="B">Назад ↓</button><button data-dir="R">Праворуч →</button></div>
<label>Швидкість <output id="speedLabel">80</output><input aria-label="Швидкість" id="speed" type="range" min="0" max="180" value="80"></label>
<label>Сила повороту Kp <input id="kp" type="number" min="0" max="100" step="1" value="25"></label><button id="settings">Застосувати</button>
<button id="line">Їхати по лінії</button><p class="hint">Режим лінії та програма працюють і без телефона. Максимум 120 секунд за запуск.</p></section>
<section><h2>Мої блоки</h2><p class="hint">Додай блоки. Зміни порядок стрілками. Час указано в секундах.</p>
<div class="tools" id="palette"></div><ol id="program"></ol>
<button id="save">Зберегти в роботі</button><button id="run">Запустити</button><button id="load">Відкрити з робота</button><button id="clear">Очистити блоки</button>
<p class="hint">Після зміни блоків збережи програму. Довге натискання кнопки робота запускає збережені блоки.</p></section>
<section><h2>Очі робота</h2><p>Зліва направо:</p><div id="sensors" class="sensors"></div><p id="calState"></p>
<details><summary>Разом із учителем: калібрування</summary><p>Робот нерухомий. Усі 5 сенсорів над білим аркушем, зазор 5 мм.</p><button id="white">Запам'ятати біле</button><p>Потім усі 5 сенсорів над широкою чорною поверхнею. Після кожної кнопки зачекайте секунду.</p><button id="black">Запам'ятати чорне</button><p>Знову потрібне калібрування після зміни висоти або покриття.</p></details>
<details><summary>Разом із учителем: перевірка коліс</summary><p>Колеса підняті. Кожна кнопка дає короткий імпульс.</p><button data-test="0">Ліве переднє</button><button data-test="1">Праве переднє</button><button data-test="2">Ліве заднє</button><button data-test="3">Праве заднє</button></details></section>
<script>
const $=id=>document.getElementById(id);
let steps=[],held='',timer=null,inflight=false,dragIndex=null,dirty=false,holdVersion=0,manualEpoch=0;
const spec={S:['Швидкість',80],F:['Вперед',2],B:['Назад',1],L:['Ліворуч',0.7],R:['Праворуч',0.7],W:['Чекати',1],K:['Сила Kp',25],A:['За лінією',5],X:['Стоп',0]};
async function post(path,body=''){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'text/plain'},body});const text=await r.text();if(!r.ok)throw Error(text);return text}
function tell(t){$('status').textContent=t}
async function action(path){try{tell(await post(path))}catch(e){tell(e.message)}}
function clearHold(){held='';holdVersion++;clearInterval(timer);timer=null}
function endHold(){clearHold();action('/stop')}
async function beginHold(dir){clearHold();held=dir;const version=holdVersion;
 try{const r=await fetch('/arm',{cache:'no-store'});const epoch=Number(await r.text());if(version!==holdVersion||!held)return;
 if(!r.ok||!Number.isInteger(epoch)||epoch<1)throw Error('Не вдалося підготувати рух');
 manualEpoch=epoch;heartbeat();timer=setInterval(heartbeat,100);
 }catch(e){if(version===holdVersion){clearHold();tell(e.message)}}}
async function heartbeat(){if(!held||inflight)return;inflight=true;const version=holdVersion;
 try{await post('/drive?dir='+held+'&epoch='+manualEpoch)}
 catch(e){if(version===holdVersion){clearHold();tell(e.message)}}finally{inflight=false}}
document.querySelectorAll('[data-dir]').forEach(b=>{
 b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);beginHold(b.dataset.dir)};
 b.onpointerup=endHold;b.onpointercancel=endHold;b.onlostpointercapture=()=>{if(held)endHold()};
 b.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();beginHold(b.dataset.dir)}};
 b.onkeyup=e=>{if(e.key===' '||e.key==='Enter')endHold()};b.onblur=()=>{if(held)endHold()};
});
$('stop').onclick=endHold;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&held)endHold()});window.addEventListener('pagehide',()=>{if(held)navigator.sendBeacon('/stop','')});
$('speed').oninput=()=>$('speedLabel').textContent=$('speed').value;
$('settings').onclick=()=>action('/settings?speed='+encodeURIComponent($('speed').value)+'&kp='+encodeURIComponent($('kp').value));
$('line').onclick=()=>{clearHold();action('/line')};
$('white').onclick=()=>action('/cal?surface=white');$('black').onclick=()=>action('/cal?surface=black');
document.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>action('/test?m='+b.dataset.test));
for(const [op,[name,value]] of Object.entries(spec)){let b=document.createElement('button');b.textContent=name;b.onclick=()=>{if(steps.length>=32)return tell('До 32 блоків');steps.push({op,value});dirty=true;render()};$('palette').append(b)}
function swap(i,j){if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];dirty=true;render()}
function render(){let list=$('program');list.replaceChildren();steps.forEach((s,i)=>{
 let li=document.createElement('li');li.className='block';li.draggable=true;li.ondragstart=()=>dragIndex=i;li.ondragover=e=>e.preventDefault();li.ondrop=e=>{e.preventDefault();if(dragIndex!==null)swap(dragIndex,i);dragIndex=null};
 let text=document.createElement('span');text.textContent=(i+1)+'. '+spec[s.op][0];li.append(text);
 if(s.op!=='X'){let input=document.createElement('input');input.type='number';input.value=s.value;input.min=['S','K'].includes(s.op)?0:0.02;input.max=s.op==='S'?180:(s.op==='K'?100:10);input.step=s.op==='K'?0.1:(s.op==='S'?1:0.1);input.setAttribute('aria-label',spec[s.op][0]);input.oninput=()=>{s.value=Number(input.value);dirty=true};li.append(input);let unit=document.createElement('span');unit.textContent=['S','K'].includes(s.op)?'':'с';li.append(unit)}
 for(const [label,fn] of [['↑',()=>swap(i,i-1)],['↓',()=>swap(i,i+1)],['×',()=>{steps.splice(i,1);dirty=true;render()}]]){let b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',label==='×'?'Видалити блок':(label==='↑'?'Блок вище':'Блок нижче'));b.onclick=fn;li.append(b)}list.append(li)
})}
function encode(){return steps.map(s=>s.op+','+Math.round(s.value*(s.op==='K'?10:('FBLRWA'.includes(s.op)?1000:1)))).join('\n')+'\n'}
$('save').onclick=async()=>{try{tell(await post('/program',encode()));dirty=false}catch(e){tell(e.message)}};
$('run').onclick=()=>{clearHold();if(dirty)return tell('Спершу збережи змінені блоки');action('/run')};
$('load').onclick=async()=>{try{const r=await fetch('/program');const text=await r.text();steps=text.trim()?text.trim().split('\n').map(line=>{const[op,n]=line.split(',');return{op,value:Number(n)/(op==='K'?10:('FBLRWA'.includes(op)?1000:1))}}):[];dirty=false;render()}catch(e){tell(e.message)}};
$('clear').onclick=()=>{steps=[];dirty=true;render()};
let statusBusy=false,initial=true;
async function status(){if(statusBusy)return;statusBusy=true;try{const r=await fetch('/status');const s=await r.json();tell(s.reason+' · '+s.voltage.toFixed(2)+' В');$('calState').textContent=s.calibrated?'Калібрування готове':'Потрібне калібрування';$('sensors').replaceChildren(...s.raw.map(v=>{let d=document.createElement('span');d.className='sensor';d.textContent=v;return d}));if(initial){$('speed').value=s.speed;$('speedLabel').textContent=s.speed;$('kp').value=s.kp;initial=false}}catch(e){tell('Зв’язок відсутній. Ручний рух зупиниться.')}finally{statusBusy=false}}
setInterval(status,1000);status();
</script></html>)ROBOT";

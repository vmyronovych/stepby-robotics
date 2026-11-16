import './guide.css';
import data from './presentation-data.js';
import {AssemblyViewer} from './viewer.js';
import {initModelFullscreen} from './fullscreen.js';
import './fullscreen.css';
import {COMPONENTS,componentKey} from './components.js';
import {initComponentDetails} from './component-details.js';
import './component-details.css';

export function initAssemblyGuide({onClose=()=>{}}={}){
 const dialog=document.createElement('dialog');dialog.id='assemblyGuide';dialog.className='assembly-guide';dialog.setAttribute('aria-labelledby','guideHeading');
 dialog.innerHTML=`<header class="guide-header"><button id="guideClose" class="guide-back">← <span>До блоків</span></button><div class="guide-brand"><span class="guide-cube">◇</span><div><strong id="guideHeading">Збери Мандрівника</strong><small>ТВІЙ ІНТЕРАКТИВНИЙ 3D-ГАЙД</small></div></div></header>
 <div class="guide-accuracy"><strong>Корпус за твоїми фото: 255 × 150 мм, 72 отвори.</strong> Дві пластини по 3 мм, між ними 30 мм. Відсік AA — знизу на скотчі. Корпус і модулі відтворено за фото; посадки моторів, опор і плат приблизні. <a href="./chassis-review.html">Звірити з картою корпусу →</a></div>
 <div class="guide-layout"><nav class="guide-step-nav" aria-label="Кроки складання"><div class="guide-nav-heading">НАША ПОДОРОЖ <span>23 кроки</span></div><ol id="guideStepList"></ol></nav>
 <section id="guidePresentation" class="guide-visual" aria-label="Інтерактивна модель"><div class="guide-viewer"><div class="guide-view-heading"><span id="guideStageBadge">Знайомство</span><span class="guide-live">● 3D</span></div><div id="guideCanvas"></div><div id="guideFallback" role="status" hidden></div><div id="guideSelection" class="guide-selection" aria-live="polite">Натисни на компонент, щоб побачити деталі та контакти</div><div class="guide-legend"><span><i></i> Нові деталі — кольорові</span><span><i></i> Уже встановлені — світлі</span></div></div>
 <div class="guide-component-picker"><label for="guideComponentSelect">Деталі компонента</label><select id="guideComponentSelect"><option value="">Обери на моделі або зі списку</option></select></div>
 <div class="guide-view-tools" aria-label="Керування 3D-моделлю"><div><button id="guideIso" title="Початковий ракурс" aria-label="Початковий ракурс">↺ Ракурс</button><button id="guideTop">Зверху</button><button id="guideBottom">Знизу</button></div><div><button id="guideRotateLeft" aria-label="Обертати ліворуч">↶</button><button id="guideRotateRight" aria-label="Обертати праворуч">↷</button><button id="guideZoomOut" aria-label="Віддалити модель">−</button><button id="guideZoomIn" aria-label="Наблизити модель">+</button></div></div>
 <p class="guide-gestures">Перетягуй — обертай · Два пальці або коліщатко — наближай</p>
 <div class="guide-model-actions"><button id="guideAnimate">▶ Як установити</button><button id="guideLift" aria-pressed="false">↥ Зазирнути під верх</button><button id="guideFullscreen" class="model-fullscreen-toggle">⛶ На весь екран</button></div></section>
 <section class="guide-instruction" aria-label="Що робити на цьому кроці"><div class="guide-mobile-select"><label for="guideStepSelect">Обрати крок</label><select id="guideStepSelect"></select></div><span id="guideStepNumber" class="guide-step-number"></span><h1 id="guideTitle" tabindex="-1"></h1><p id="guideAction"></p><section class="guide-parts"><h2>Підготуй деталі</h2><ul id="guideParts"></ul></section><section class="guide-check"><h2>✓ Перевір з напарником</h2><p id="guideCheck"></p></section><p id="guideWiringNote" class="guide-wiring-note" hidden>Лінії показують маршрут джгутів. Попередню схему потрібно перевірити для HW-627 / 38P. <a href="./wiring.svg" target="_blank" rel="noopener">Попередня схема 30P / Pololu ↗</a></p><p class="guide-power-note">Складаємо без живлення: S1 вимкнений, USB комп’ютера від’єднаний. AA вставляємо лише на відповідному кроці.</p></section></div>
 <footer class="guide-footer"><button id="guidePrev" class="guide-prev">← Назад</button><div class="guide-progress"><span id="guideProgressText" aria-live="polite"></span><progress id="guideProgress" max="23" value="1" aria-label="Поточний крок"></progress></div><button id="guideNext" class="guide-next">Почнімо →</button></footer>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id),STORE='mandrivnyk-assembly-v2';let index=0,viewer=null,openTop=false;
 const details=initComponentDetails(dialog.querySelector('.guide-viewer'),{onClose:()=>{viewer?.select(null);$('guideComponentSelect').value='';},onNavigate:openComponent});
 initModelFullscreen($('guidePresentation'),$('guideFullscreen'));
 function openComponent(key){if(!COMPONENTS[key])return;if(!viewer?.selectComponent(key))details.open(key);}
 $('guideComponentSelect').onchange=e=>{if(e.target.value)openComponent(e.target.value);else{details.close();viewer?.select(null)}};
 try{const saved=JSON.parse(localStorage.getItem(STORE));if(Number.isInteger(saved?.step)&&saved.step>=0&&saved.step<data.steps.length)index=saved.step}catch{}
 for(const [i,step]of data.steps.entries()){
  const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><span></span>`;b.lastElementChild.textContent=step.title;b.onclick=()=>show(i);li.append(b);$('guideStepList').append(li);
  const option=document.createElement('option');option.value=i;option.textContent=String(i+1).padStart(2,'0')+' · '+step.title;$('guideStepSelect').append(option);
 }
 function fail(message){$('guideFallback').hidden=!message;$('guideFallback').textContent=message;}
 function select(part){$('guideSelection').textContent=part?part.name:'Натисни на компонент, щоб побачити деталі та контакти';$('guideSelection').classList.toggle('selected',!!part);if(part?.component){$('guideComponentSelect').value=part.component;details.open(part.component)}else{details.close();$('guideComponentSelect').value='';}}
 function show(next){
  index=Math.max(0,Math.min(data.steps.length-1,next));openTop=false;const step=data.steps[index];
  const available=new Set(data.parts.filter(p=>p.stage<=step.stage).map(componentKey).filter(Boolean));
  $('guideComponentSelect').replaceChildren(new Option('Обери на моделі або зі списку',''),...Object.values(COMPONENTS).filter(c=>available.has(c.id)).map(c=>new Option(c.title,c.id)));
  $('guideTitle').textContent=step.title;$('guideAction').textContent=step.action+(step.stage===8?' Натисни «Знизу», щоб побачити п’ять віконець.':'');$('guideCheck').textContent=step.check;
  $('guideStepNumber').textContent=index===0?'ПЕРЕД ПОЧАТКОМ':`КРОК ${String(index+1).padStart(2,'0')}`;
  $('guideStageBadge').textContent=index===0?'Знайомство з машинкою':`${String(index+1).padStart(2,'0')} / ${data.steps.length} · ${step.stage<=9?'Корпус і колеса':step.stage<=13?'Електроніка':'Складаємо разом'}`;
  $('guideParts').replaceChildren(...step.need.split('•').map(s=>{const li=document.createElement('li');li.textContent=s.trim();return li}));
  $('guidePrev').disabled=index===0;$('guideNext').textContent=index===0?'Почнімо →':index===data.steps.length-1?'До програмування →':'Далі →';
  $('guideProgressText').textContent=`${index+1} з ${data.steps.length}`;$('guideProgress').value=index+1;$('guideProgress').max=data.steps.length;
  $('guideStepSelect').value=index;$('guideWiringNote').hidden=step.stage<14||index===0;
  $('guideLift').disabled=step.stage<9||!!step.lift||!viewer;$('guideLift').setAttribute('aria-pressed',String(!!step.lift));$('guideLift').textContent=step.lift?'Верх піднято':'↥ Зазирнути під верх';
  $('guideAnimate').disabled=!step.arrows?.length||!viewer;$('guideFullscreen').disabled=!viewer;
  [...$('guideStepList').querySelectorAll('button')].forEach((b,i)=>{b.classList.toggle('current',i===index);if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  $('guideStepList').querySelector('.current')?.scrollIntoView({block:'nearest'});
  viewer?.setStep(step);select(null);try{localStorage.setItem(STORE,JSON.stringify({step:index}))}catch{}
 }
 function open(){
  if(dialog.open)return;dialog.showModal();document.body.classList.add('assembly-open');
  if(!viewer){try{viewer=new AssemblyViewer($('guideCanvas'),select,fail)}catch{fail('Цей браузер не зміг увімкнути 3D. Усі кроки й переліки деталей доступні. Спробуй браузер із підтримкою WebGL 2.');for(const b of dialog.querySelectorAll('.guide-view-tools button'))b.disabled=true;}}
  viewer?.resume();show(index);$('guideClose').focus();
 }
 function close(){dialog.close()}
 dialog.addEventListener('close',()=>{details.close();document.body.classList.remove('assembly-open');viewer?.pause();if(location.hash==='#assembly')history.replaceState(null,'',location.pathname+location.search);onClose();document.getElementById('assemblyButton')?.focus()});
 $('guideClose').onclick=close;$('guidePrev').onclick=()=>show(index-1);$('guideNext').onclick=()=>index===data.steps.length-1?close():show(index+1);$('guideStepSelect').onchange=e=>show(+e.target.value);
 $('guideIso').onclick=()=>viewer?.view('iso');$('guideTop').onclick=()=>viewer?.view('top');$('guideBottom').onclick=()=>viewer?.view('bottom');
 $('guideRotateLeft').onclick=()=>viewer?.rotate(-1);$('guideRotateRight').onclick=()=>viewer?.rotate(1);$('guideZoomIn').onclick=()=>viewer?.zoom(1.2);$('guideZoomOut').onclick=()=>viewer?.zoom(1/1.2);
 $('guideAnimate').onclick=()=>viewer?.animate();$('guideLift').onclick=()=>{openTop=!openTop;viewer?.setStep(data.steps[index],openTop);$('guideLift').setAttribute('aria-pressed',String(openTop));$('guideLift').textContent=openTop?'↧ Опустити верх':'↥ Зазирнути під верх'};
 if(import.meta.env.DEV)window.__assembly={show,componentPoint:key=>viewer?.componentPoint(key),get index(){return index},get snapshot(){return viewer?.snapshot()},steps:data.steps};
 return {open,close};
}

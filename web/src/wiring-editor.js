import {moveComponentGroup} from './wiring-group-move.js';
import {expansionPinDocs} from './expansion-pin-docs.js';
import {unavailableConnections} from './wiring-diagnostics.js';
import {routingScene,insideObstacle,fallbackRouting} from './wiring-routing-scene.js';
import {roundedWirePath,moveRouteSegment,snapRoute} from './wiring-path.js';
import {mountLinks,mountPins} from './breadboard-mount-data.js';
import {syncMounts,findMount,seatComponent,detachChildren} from './breadboard-mount.js';
import {PART_LAYOUTS,RESISTANCES,LED_COLORS,resistance,ledColor,formatResistance,resistorBands} from './teaching-parts.js';
import {jumperArt} from './wiring-jumper-art.js';
import {jumperVoltage,EXPANSION_JUMPER} from './assembly/expansion-jumper.js';
import {Blockly} from './blocks.js';
import {CATALOG,ports,endpoint,terminalMap,validateWiring,analyzeWiring,wiringImpact,mountLegacyExpansions} from './wiring-model.js';
import {getWiring,changeWiring,cloneWiring,registerWiredToolbox,wiredBlockState,registerWiringOpener,openWiringFor} from './wiring-state.js';
import {physicalLayout,mounted,EXPANSION} from './wiring-physical.js';
import {componentArt} from './wiring-art.js';
import {getMyBlocks} from './my-blocks.js';
import {openMyBlockDefinition} from './my-blocks-editor.js';
import './wiring-editor.css';

const uid=()=>crypto.randomUUID(),el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const title=(state,key)=>{const t=terminalMap(state).get(key);return t?`${t.component.name} · ${t.label}`:'Видалений контакт';};
const height=c=>physicalLayout(c).height;
const point=(state,key,lane=0)=>{
 const t=terminalMap(state).get(key);if(!t)return null;
 const c=t.component,layout=physicalLayout(c),p=layout.points.get(t.id);
 const x=c.x+p.x,y=c.y+p.y,side=p.side;
 const exit={x:side==='left'?c.x-24-lane:side==='right'?c.x+layout.width+24+lane:x,y:side==='top'?c.y+layout.header-24-lane:side==='bottom'?c.y+layout.height+24+lane:y};
 return {x,y,side,exit};
};
const path=(a,b)=>`M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}`;
const colorFor=role=>({ground:'#63747c',source:'#cf694d',rail:'#cf8c3a',supply:'#cf8c3a',output:'#9b6aaa',motor:'#9b6aaa','led-anode':'#c75542','led-cathode':'#586970',resistor:'#b09050',breadboard:'#87998e',reserved:'#9b9b9b',input:'#5d86bf',unknown:'#c19741'}[role]||'#358f82');

const WIRE_COLORS=[
 {value:'#d64545',name:'Червоний',use:'Живлення'},
 {value:'#252a30',name:'Чорний',use:'Земля · GND'},
 {value:'#e6b932',name:'Жовтий',use:'Сигнал'},
 {value:'#328f83',name:'Зелений',use:'Сигнал'},
 {value:'#3978cb',name:'Синій',use:'Сигнал'},
 {value:'#9270b3',name:'Фіолетовий',use:'Сигнал'},
 {value:'#e58a35',name:'Оранжевий',use:'Сигнал'},
 {value:'#f5f5f0',name:'Білий',use:'Сигнал'},
];
const autoWireColor=roles=>WIRE_COLORS[roles.includes('ground')?1:roles.some(r=>['source','supply','rail'].includes(r))?0:roles.includes('output')?5:3].value;

export function initWiringEditor({workspace,notice}){
 const dialog=el('dialog',undefined,'wiring-dialog');dialog.id='wiringDialog';dialog.setAttribute('aria-labelledby','wiringTitle');
 dialog.innerHTML=`<header class="wiring-header"><h2 id="wiringTitle">Підключення</h2><button data-palette-toggle aria-label="Згорнути палітру компонентів" aria-controls="wiringPalette" aria-expanded="true" title="Згорнути палітру компонентів">☰ <span>Компоненти</span></button><button data-apply class="wiring-primary" aria-label="Застосувати підключення"></button><button data-close aria-label="Скасувати й закрити підключення">✕</button></header>

 <div class="wiring-tools"><button data-undo aria-label="Скасувати зміну схеми">↶</button><button data-redo aria-label="Повторити зміну схеми">↷</button><button data-out aria-label="Зменшити схему">−</button><span data-zoom></span><button data-in aria-label="Збільшити схему">＋</button><button data-wire-fit>Уся схема</button><span class="wiring-rotation" hidden><button data-rotate-left></button><button data-rotate-right></button></span><div class="wiring-feedback"><details class="wiring-impact-menu" hidden><summary aria-label="Переглянути зміни команд" title="Переглянути зміни команд"><span data-impact-icon></span><span data-impact-count></span></summary><div class="wiring-impact" aria-live="polite"></div></details></div><button data-checks aria-controls="wiringInspector" aria-expanded="false">Перевірка</button><button data-audit>Звір із реальною збіркою</button></div>
 <p class="wiring-hint" role="status">Перетягни модуль зліва. Клік — довідка; перетягування між контактами — провід. Тягни фон, щоб рухати полотно.</p>
 <div class="wiring-layout"><aside id="wiringPalette" class="wiring-palette" aria-label="Додати компонент"></aside><div class="wiring-viewport"><div class="wiring-scroll" tabindex="0" aria-label="Полотно підключень"><div class="wiring-sizer"><div class="wiring-board"><svg class="wiring-lines" aria-label="Проводи"></svg></div></div></div><div class="wiring-canvas-controls"></div></div><aside id="wiringInspector" class="wiring-side" aria-label="Перевірка та властивості"></aside></div>
`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),board=$('.wiring-board'),svg=$('.wiring-lines'),side=$('.wiring-side'),scroll=$('.wiring-scroll');
 const routeControls=document.createElementNS(svg.namespaceURI,'svg');routeControls.setAttribute('class','wiring-route-controls');board.append(routeControls);
 let draft,before,analysis,selection=null,pending=null,rewire=null,undo=[],redo=[],scale=.8,drag=null,audit=-1,targetWorkspace=workspace,previousFocus=null,viewer=null,viewerDialog=null,suppressPinClick=false,spaceHeld=false,ghost=null,paletteCollapsed=false,showChecks=false,multiSelect=false;
 $('.wiring-header').insertBefore($('.wiring-tools'),$('[data-apply]'));
 $('.wiring-feedback').prepend($('.wiring-hint'));
 $('.wiring-hint').tabIndex=0;
 const icons={
  palette:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M3 9h6M3 15h6"/>',
  undo:'<path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12"/>',
  redo:'<path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12"/>',
  route:'<path d="M3 5h6v7h6v7h6M3 19h5v-7m7-7h6"/><circle cx="3" cy="5" r="1"/><circle cx="21" cy="19" r="1"/>',
  rotateLeft:'<path d="M4 10a8 8 0 1 1 2 9M4 4v6h6"/>',
  rotateRight:'<path d="M20 10a8 8 0 1 0-2 9M20 4v6h-6"/>',
  checks:'<path d="m4 6 2 2 3-4m3 2h8M4 13l2 2 3-4m3 2h8M4 20h5m3 0h8"/>',
  audit:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v4H9zM8 14l3 3 5-6"/>',
  apply:'<path d="m4 12 5 5L20 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
  impact:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
 };
 const icon=name=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
 for(const [selector,name,label]of [['[data-rotate-left]','rotateLeft','Повернути на 90° ліворуч'],['[data-rotate-right]','rotateRight','Повернути на 90° праворуч'],['[data-palette-toggle]','palette','Згорнути палітру компонентів'],['[data-undo]','undo','Скасувати зміну схеми'],['[data-redo]','redo','Повторити зміну схеми'],['[data-checks]','checks','Перевірити з’єднання'],['[data-audit]','audit','Звір із реальною збіркою'],['[data-apply]','apply','Застосувати підключення'],['.wiring-header [data-close]','close','Скасувати й закрити підключення']]){
  const b=$(selector);b.innerHTML=icon(name);b.classList.add('wiring-icon');b.setAttribute('aria-label',label);b.title=label;
 }
 for(const [selector,key]of [['[data-rotate-left]','Shift+R'],['[data-rotate-right]','R']]){const b=$(selector);b.title+=` · ${key}`;b.setAttribute('aria-keyshortcuts',key);}
 const selectMany=el('button');selectMany.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 2"/></svg><span>Вибрати кілька</span>';selectMany.setAttribute('aria-label','Вибрати кілька');selectMany.dataset.multiSelect='';selectMany.setAttribute('aria-pressed','false');selectMany.title='Вибрати кілька компонентів · Shift + клік';$('.wiring-tools').insertBefore(selectMany,$('.wiring-feedback'));
 selectMany.onclick=()=>{multiSelect=!multiSelect;selectMany.setAttribute('aria-pressed',String(multiSelect));hint(multiSelect?'Натискай компоненти, щоб додати або прибрати з вибору. Вимкни «Вибрати кілька», щоб перетягнути групу.':'Shift + клік — додати компонент. Тягни вибраний компонент, щоб перемістити всю групу.');};
 function selectedIds(){return selection?.kind==='components'?selection.ids:selection?.kind==='component'?[selection.id]:[];}
 function selectComponents(ids){selection=ids.length>1?{kind:'components',ids}:ids.length?{kind:'component',id:ids[0]}:null;}
 const arrange=el('button',undefined,'wiring-icon');arrange.dataset.arrangeWires='';arrange.innerHTML=icon('route');arrange.title='Вирівняти всі проводи автоматично';arrange.setAttribute('aria-label',arrange.title);$('.wiring-tools').insertBefore(arrange,$('.wiring-feedback'));
 arrange.onclick=()=>{if(draft.wires.some(w=>w.vertices?.length))mutate(s=>{for(const w of s.wires)delete w.vertices;},{physical:false});else drawLines();hint('Проводи прокладено автоматично. Обери провід, щоб підправити його вручну.');};
 $('[data-checks]').append(el('span',undefined,'wiring-check-count'));$('[data-impact-icon]').innerHTML=icon('impact');
 let autoRouter=null,routerLoading=null,routing={routes:new Map(),warnings:new Set(),engine:'fallback'};
 function ensureRouter(){if(routerLoading)return;const load=import('./wiring-auto-router.js').then(m=>m.loadWireRouter(()=>{if(dialog.open)drawLines();})).then(router=>{if(routerLoading!==load||!dialog.open){router.dispose();return;}autoRouter=router;drawLines();}).catch(()=>{if(routerLoading!==load)return;routerLoading=null;hint('Автоматичне трасування недоступне. Працює спрощене прокладання; відкрий схему знову, щоб повторити завантаження.');});routerLoading=load;}
 const hint=text=>{$('.wiring-hint').textContent=text;$('.wiring-hint').title=text;};
 const button=(text,action,parent=side)=>{const b=el('button',text);b.type='button';b.onclick=action;parent.append(b);return b;};
 function commit(next,{physical=true,record=true}={}){
  syncMounts(next);next.checked=(next.checked||[]).filter(id=>next.wires.some(w=>w.id===id));validateWiring(next);if(record){undo.push(cloneWiring(draft));if(undo.length>60)undo.shift();redo=[];}
  draft=next;if(physical){draft.checked=[];audit=-1;}render();
 }
 function mutate(change,options){const next=cloneWiring(draft);change(next);commit(next,options);}
 function zoom(value,anchor){
  const old=scale,r=scroll.getBoundingClientRect(),ax=anchor?anchor.x-r.left:scroll.clientWidth/2,ay=anchor?anchor.y-r.top:scroll.clientHeight/2,wx=(scroll.scrollLeft+ax)/old,wy=(scroll.scrollTop+ay)/old;scale=Math.max(.15,Math.min(2.5,value));board.style.transform=`scale(${scale})`;const w=Math.max(2000,...draft.components.map(c=>c.x+physicalLayout(c).width+80)),h=Math.max(1500,...draft.components.map(c=>c.y+height(c)+60));board.style.width=svg.style.width=w+'px';board.style.height=svg.style.height=h+'px';$('.wiring-sizer').style.width=w*scale+'px';$('.wiring-sizer').style.height=h*scale+'px';$('[data-zoom]').textContent=Math.round(scale*100)+'%';if(anchor){scroll.scrollLeft=wx*scale-ax;scroll.scrollTop=wy*scale-ay;}}
 function fit(){const maxX=Math.max(700,...draft.components.map(c=>c.x+physicalLayout(c).width+35)),maxY=Math.max(500,...draft.components.map(c=>c.y+height(c)+35));zoom(Math.min(scroll.clientWidth/maxX,scroll.clientHeight/maxY));scroll.scrollTo(0,0);}
 function focusKeys(keys){
  const t=analysis.terminals.get(keys[0]);if(t){selection={kind:'pin',id:t.key};scroll.scrollTo({left:Math.max(0,(t.component.x-35)*scale),top:Math.max(0,(t.component.y-25)*scale)});}
  drawLines();drawSelection();renderSide();
 }
 function drawLines(rubber){
  const focused=routeControls.contains(document.activeElement)?{...document.activeElement.dataset}:null;
  svg.replaceChildren();routeControls.replaceChildren();const bad=new Set(analysis?.issues.filter(i=>i.severity==='error').flatMap(i=>i.wireIds));
  try{routing=autoRouter?autoRouter(draft):fallbackRouting(draft);}catch{autoRouter=null;routing=fallbackRouting(draft);hint('Працює спрощене прокладання. Відкрий схему знову, щоб повторити автоматичне трасування.');routerLoading=null;}
  svg.dataset.router=routing.engine;arrange.disabled=!draft.wires.length;
  for(const wire of draft.wires){
   if(drag?.kind==='wire-end'&&drag.moved&&drag.id===wire.id)continue;
   const points=routing.routes.get(wire.id);if(!points?.length)continue;
   const d=roundedWirePath(points);
   for(const hit of [false,true]){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.dataset.wire=wire.id;p.dataset.points=JSON.stringify(points);p.setAttribute('stroke',wire.color);p.setAttribute('class',hit?'wire-hit':[selection?.kind==='wire'&&selection.id===wire.id?'wire-active':'',bad.has(wire.id)?'wire-error':'',audit>=0&&draft.wires[audit]?.id===wire.id?'wire-audit':''].join(' '));p.onclick=()=>{selection={kind:'wire',id:wire.id};pending=null;rewire=null;drawLines();drawSelection();renderSide();};p.ondblclick=e=>{e.preventDefault();e.stopPropagation();const b=board.getBoundingClientRect(),vertex={x:snapRoute((e.clientX-b.left)/scale,e.altKey),y:snapRoute((e.clientY-b.top)/scale,e.altKey)};let nearest=0,distance=Infinity;for(let i=0;i<points.length-1;i++){const a=points[i],z=points[i+1],dx=z.x-a.x,dy=z.y-a.y,t=Math.max(0,Math.min(1,((vertex.x-a.x)*dx+(vertex.y-a.y)*dy)/(dx*dx+dy*dy)));const d=Math.hypot(vertex.x-a.x-dx*t,vertex.y-a.y-dy*t);if(d<distance){distance=d;nearest=i;}}const vertices=points.slice(1,-1);vertices.splice(nearest,0,vertex);setWireVertices(wire.id,vertices);};svg.append(p);}
   if(selection?.kind==='wire'&&selection.id===wire.id)drawRouteHandles(wire,points);
  }
  if(focused){const handle=[...routeControls.querySelectorAll('.wire-handle')].find(n=>n.dataset.wire===focused.wire&&n.dataset.routeHandle===focused.routeHandle&&n.dataset.index===focused.index);handle?.focus({preventScroll:true});}
  drawMountPreview();
  drawWireEndPreview();
  if(rubber&&pending){const a=point(draft,pending);if(a){const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path(a,rubber));p.setAttribute('stroke',autoWireColor([analysis.terminals.get(pending)?.role]));p.style.pointerEvents='none';p.style.strokeDasharray='5 5';svg.append(p);}}
 }
 function validVertices(vertices){return vertices.length<=32&&vertices.every(p=>[p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=6000)&&!routingScene(draft).obstacles.some(r=>insideObstacle(p,r,4)));}
 function setWireVertices(id,vertices){
  if(!validVertices(vertices)){hint('Перемісти згин за межі компонента. Максимум — 32 точки.');return false;}
  mutate(s=>{s.wires.find(w=>w.id===id).vertices=vertices;},{physical:false});return true;
 }
 function drawRouteHandles(wire,points){
  const add=(kind,index,p,horizontal)=>{
   const h=document.createElementNS(svg.namespaceURI,kind==='vertex'?'circle':'rect'),size=11/scale;
   if(kind==='vertex'){h.setAttribute('cx',p.x);h.setAttribute('cy',p.y);h.setAttribute('r',size/2);}else{h.setAttribute('x',p.x-size/2);h.setAttribute('y',p.y-size/2);h.setAttribute('width',size);h.setAttribute('height',size);h.setAttribute('rx',2/scale);}
   h.setAttribute('class','wire-handle');h.dataset.routeHandle=kind;h.dataset.index=index;h.dataset.wire=wire.id;h.setAttribute('tabindex','0');h.setAttribute('role','button');h.setAttribute('aria-label',kind==='vertex'?'Перемістити згин проводу':`Зсунути ${horizontal?'горизонтальний':'вертикальний'} відрізок проводу`);h.style.cursor=kind==='vertex'?'move':horizontal?'ns-resize':'ew-resize';
   h.onclick=e=>e.stopPropagation();
   h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag={kind:'route',id:wire.id,type:kind,index,points,horizontal,x:e.clientX,y:e.clientY,start:cloneWiring(draft),moved:false};scroll.setPointerCapture(e.pointerId);};
   h.onkeydown=e=>{if(kind==='vertex'&&['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();setWireVertices(wire.id,wire.vertices.filter((_,i)=>i!==index));scroll.focus({preventScroll:true});return;}if(!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopPropagation();const dx=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0,dy=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;
    const vertices=kind==='vertex'?wire.vertices.map((v,i)=>i===index?{x:snapRoute(v.x+dx),y:snapRoute(v.y+dy)}:v):moveRouteSegment(points,index,horizontal?dy:dx);
    setWireVertices(wire.id,vertices);const next=[...routeControls.querySelectorAll('.wire-handle')].find(n=>n.dataset.wire===wire.id&&n.dataset.routeHandle===kind&&Number(n.dataset.index)===index);(next||scroll).focus({preventScroll:true});
   };routeControls.append(h);
  };
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(Math.hypot(a.x-b.x,a.y-b.y)*scale<28||routingScene(draft).obstacles.some(r=>insideObstacle(mid,r,4)))continue;add('segment',i,mid,Math.abs(a.y-b.y)<.01);}
  for(const [i,p]of (wire.vertices||[]).entries())add('vertex',i,p);
  for(const end of ['a','b']){
   const p=point(draft,wire[end]);if(!p)continue;
   const h=document.createElementNS(svg.namespaceURI,'circle');h.setAttribute('class','wire-handle wire-endpoint');h.dataset.routeHandle='endpoint';h.dataset.index=end;h.dataset.wire=wire.id;
   h.setAttribute('cx',p.x);h.setAttribute('cy',p.y);h.setAttribute('r',7/scale);h.setAttribute('tabindex','0');h.setAttribute('role','button');h.setAttribute('aria-label',`Перенести кінець: ${title(draft,wire[end])}`);h.style.setProperty('--wire-color',wire.color);
   h.onclick=e=>e.stopPropagation();
   h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();suppressPinClick=false;pending=null;rewire=null;drag=e.shiftKey?{kind:'wire',from:wire[end],x:e.clientX,y:e.clientY,pointerId:e.pointerId,moved:false}:{kind:'wire-end',id:wire.id,end,x:e.clientX,y:e.clientY,pointerId:e.pointerId,moved:false};scroll.setPointerCapture(e.pointerId);};
   h.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();pending=wire[end==='a'?'b':'a'];rewire=wire.id;drawSelection();hint('Обери новий контакт. Esc — скасувати перенесення.');}};
   routeControls.append(h);
  }
 }
 function pinAtPointer(e){return document.elementsFromPoint(e.clientX,e.clientY).map(n=>n.closest('.wire-pin')).find(Boolean)?.dataset.endpoint;}
 function wireEndProblem(wire,end,key){
  if(!key)return 'Відпусти кінець на контакті. Провід залишено на місці.';
  if(key===wire[end])return '';
  if(key===wire[end==='a'?'b':'a'])return 'Обидва кінці проводу не можуть бути на одному контакті.';
  if(mountLinks(draft).some(([,hole])=>hole===key))return 'Отвір зайнятий ніжкою. Обери вільний отвір тієї самої групи.';
  const other=wire[end==='a'?'b':'a'];
  if(draft.wires.some(w=>w.id!==wire.id&&(w.a===key&&w.b===other||w.b===key&&w.a===other)))return 'Між цими контактами вже є провід.';
  return '';
 }
 function drawWireEndPreview(){
  for(const p of board.querySelectorAll('[data-drop-target]'))delete p.dataset.dropTarget;
  if(drag?.kind!=='wire-end'||!drag.moved||!drag.preview)return;
  const wire=draft.wires.find(w=>w.id===drag.id),fixed=point(draft,wire[drag.end==='a'?'b':'a']),target=drag.target&&point(draft,drag.target),to=target||drag.preview;
  if(drag.target){const p=[...board.querySelectorAll('.wire-pin')].find(n=>n.dataset.endpoint===drag.target);if(p)p.dataset.dropTarget=wireEndProblem(wire,drag.end,drag.target)?'invalid':'valid';}
  const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path(fixed,to));line.setAttribute('stroke',wire.color);line.setAttribute('class','wire-end-preview');svg.append(line);
  const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',to.x);dot.setAttribute('cy',to.y);dot.setAttribute('r',7/scale);dot.setAttribute('class','wire-end-preview-dot');dot.setAttribute('stroke',wire.color);routeControls.append(dot);
 }
 function cancelWireEnd(){
  const pointerId=drag?.pointerId;drag=null;pending=null;rewire=null;suppressPinClick=true;
  if(pointerId!==undefined&&scroll.hasPointerCapture(pointerId))scroll.releasePointerCapture(pointerId);
  drawLines();drawSelection();renderSide();hint('Перенесення скасовано. Провід залишено на місці.');
 }
 function finishWireEnd(e){
  const d=drag,wire=draft.wires.find(w=>w.id===d.id),key=pinAtPointer(e),problem=d.moved?wireEndProblem(wire,d.end,key):'';
  drag=null;pending=null;rewire=null;suppressPinClick=true;selection={kind:'wire',id:wire.id};
  if(d.moved&&!problem&&key!==wire[d.end]){
   try{mutate(s=>{s.wires.find(w=>w.id===wire.id)[d.end]=key;});hint(`Провід перенесено: ${title(draft,key)}. Undo — повернути.`);}
   catch(error){drawLines();drawSelection();renderSide();hint(error.message);}
  }else{drawLines();drawSelection();renderSide();if(problem)hint(problem);}
 }
 function drawMountPreview(){
  svg.querySelectorAll('.mount-preview').forEach(n=>n.remove());
  const candidate=drag?.kind==='component'?drag.candidate:null;if(!candidate)return;
  for(const p of candidate.points){const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',8);circle.setAttribute('class','mount-preview');svg.append(circle);}
 }
 function drawSelection(){
  board.dataset.wiring=String(!!pending||drag?.kind==='wire-end');
  const selectedTerminal=selection?.kind==='pin'?analysis.terminals.get(selection.id):null;
  const breadboardGroup=selectedTerminal?.role==='breadboard'?selectedTerminal:null;
  const issueKeys=new Set(analysis.issues.filter(i=>i.severity==='error').flatMap(i=>i.keys));
  for(const c of board.querySelectorAll('.wiring-component'))c.dataset.selected=String(selectedIds().includes(c.dataset.component));
  for(const b of board.querySelectorAll('.wiring-jumper'))b.setAttribute('aria-pressed',String(selection?.kind==='jumper'&&selection.id===b.dataset.jumper));
  for(const p of board.querySelectorAll('.wire-pin')){p.setAttribute('aria-pressed',String(p.dataset.endpoint===pending||selection?.kind==='pin'&&p.dataset.endpoint===selection.id));p.dataset.bus=String(!!breadboardGroup&&analysis.terminals.get(p.dataset.endpoint)?.component.id===breadboardGroup.component.id&&analysis.terminals.get(p.dataset.endpoint)?.group===breadboardGroup.group);p.dataset.error=String(issueKeys.has(p.dataset.endpoint));p.dataset.connected=String(draft.wires.some(w=>w.a===p.dataset.endpoint||w.b===p.dataset.endpoint)||mountLinks(draft).some(pair=>pair.includes(p.dataset.endpoint)));}
 }
 function render(){
  syncMounts(draft);analysis=analyzeWiring(draft);zoom(scale);
  for(const c of board.querySelectorAll('.wiring-component'))c.remove();
  for(const c of [...draft.components].sort((a,b)=>(a.kind==='breadboard'?-1:0)-(b.kind==='breadboard'?-1:0))){
   const card=el('article',undefined,'wiring-component');card.dataset.component=c.id;card.dataset.kind=c.kind;card.style.left=c.x+'px';card.style.top=c.y+'px';const layout=physicalLayout(c);card.style.width=layout.width+'px';card.style.height=layout.height+'px';card.dataset.mounted=String(mounted(c));card.dataset.rotation=c.rotation??0;card.dataset.inserted=String(!!c.breadboardMount);
   card.tabIndex=0;card.setAttribute('aria-label',`Перемістити ${c.name}`);
   card.onfocus=e=>{if(e.target!==card)return;if(!selectedIds().includes(c.id))selectComponents([c.id]);pending=null;rewire=null;renderSide();drawSelection();};
   card.onkeydown=e=>{if(e.target!==card)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(selectedIds().length>1){commit(moveComponentGroup(draft,selectedIds(),e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0,e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0,routing.routes),{physical:false});return;}mutate(s=>{const node=s.components.find(n=>n.id===c.id);delete node.breadboardMount;node.x=Math.max(0,Math.min(1700,node.x+(e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0)));node.y=Math.max(0,Math.min(1500-height(c),node.y+(e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0)));seatComponent(s,node);});}};
   const moveComponent=e=>{if(e.button!==0||e.target.closest('.wire-pin,.wiring-jumper')||spaceHeld)return;e.preventDefault();e.stopPropagation();pending=null;rewire=null;
    if(e.shiftKey||multiSelect){const ids=selectedIds();selectComponents(ids.includes(c.id)?ids.filter(id=>id!==c.id):[...ids,c.id]);scroll.focus({preventScroll:true});renderSide();drawSelection();return;}
    if(!selectedIds().includes(c.id))selectComponents([c.id]);
    renderSide();drawSelection();scroll.focus({preventScroll:true});drag={kind:selectedIds().length>1?'group':'component',ids:[...selectedIds()],routes:new Map(routing.routes),id:c.id,x:e.clientX,y:e.clientY,start:cloneWiring(draft),moved:false};scroll.setPointerCapture(e.pointerId);};
   card.onpointerdown=moveComponent;
   const img=el('img');img.alt=mounted(c)?'ESP32 встановлена у плату розширення':`${CATALOG[c.kind].name} · контакти на платі`;img.draggable=false;img.style.width=layout.imageWidth+'px';img.style.height=layout.imageOriginalHeight+'px';img.style.transformOrigin='0 0';img.style.transform=layout.imageTransform;img.style.top=layout.header+'px';componentArt(c).then(src=>{img.src=src;});card.append(img);
   if(c.breadboardMount){
    // Only the visible body grabs the part; transparent image pixels must not
    // intercept breadboard holes or wires underneath it.
    const part=PART_LAYOUTS[c.kind]||{width:layout.imageWidth,height:layout.imageOriginalHeight,grip:{x:0,y:0,width:layout.imageWidth,height:layout.imageOriginalHeight}},grip=document.createElementNS(svg.namespaceURI,'svg'),body=document.createElementNS(svg.namespaceURI,'rect');
    grip.setAttribute('class','wiring-part-grip');grip.setAttribute('viewBox',`0 0 ${part.width} ${part.height}`);grip.setAttribute('aria-hidden','true');
    Object.assign(grip.style,{width:layout.imageWidth+'px',height:layout.imageOriginalHeight+'px',top:layout.header+'px',transform:layout.imageTransform});
    for(const [key,value]of Object.entries(part.grip))body.setAttribute(key,value);body.setAttribute('rx','4');grip.append(body);card.append(grip);
   }
   for(const p of ports(c)){
    const b=el('button',undefined,`wire-pin ${p.side}`);b.type='button';b.dataset.endpoint=endpoint(c,p.id);const location=layout.points.get(p.id);b.style.left=location.x+'px';b.style.top=location.y+'px';b.style.width=b.style.height=location.size+'px';b.title=p.label;b.style.setProperty('--pin-color',colorFor(p.role));b.setAttribute('aria-label',`${c.name}: ${p.label}`);b.append(el('span',p.label));b.onpointerenter=()=>hint(`${c.name} · ${p.label}${p.gpio!==null&&p.gpio!==undefined?` · GPIO${p.gpio}`:''}`);
    b.onclick=()=>{if(suppressPinClick||drag?.moved){suppressPinClick=false;return;}choosePin(b.dataset.endpoint);};
    b.onpointerdown=e=>{if(e.button===0){e.stopPropagation();suppressPinClick=false;
     drag={kind:'wire',from:b.dataset.endpoint,x:e.clientX,y:e.clientY,pointerId:e.pointerId,moved:false};
    }};card.append(b);
   }
   if(mounted(c)||c.kind==='expansion'){
    card.insertAdjacentHTML('beforeend',jumperArt(c));
    const art=card.querySelector('.wiring-jumper-art');Object.assign(art.style,{width:layout.imageWidth+'px',height:layout.imageOriginalHeight+'px',top:layout.header+'px',transform:layout.imageTransform});
    const b=el('button',undefined,'wiring-jumper'),p=layout.project(EXPANSION_JUMPER.x,EXPANSION_JUMPER.top-EXPANSION_JUMPER.pitch);
    b.type='button';b.dataset.jumper=c.id;b.dataset.voltage=jumperVoltage(c);b.title='JUMP · обрати 3,3 В / 5 В';b.setAttribute('aria-label',`${c.name}: перемичка JUMP`);
    Object.assign(b.style,{left:p.x+'px',top:p.y+'px',width:(c.rotation%180?58:34)+'px',height:(c.rotation%180?34:58)+'px'});
    b.onpointerdown=e=>e.stopPropagation();b.onclick=()=>selectJumper(c.id);card.append(b);
   }
   board.append(card);
  }
  drawLines();drawSelection();renderSide();$('[data-undo]').disabled=!undo.length;$('[data-redo]').disabled=!redo.length;
  const effects=wiringImpact(before,draft,Blockly.serialization.workspaces.save(workspace));
  $('.wiring-impact-menu').hidden=!effects.length;if(!effects.length)$('.wiring-impact-menu').open=false;$('[data-impact-count]').textContent=effects.length;$('.wiring-impact-menu summary').title=`Переглянути зміни: ${effects.length} команд`;
  $('.wiring-impact').textContent=effects.length?effects.map(e=>`${e.owner}: ${e.label} — ${e.from===null?'немає GPIO':`GPIO${e.from}`} → ${e.to===null?'немає GPIO':`GPIO${e.to}`}`).join(' · '):'Схема та блоки зберігатимуться разом у проєкті.';
  const applyLabel=effects.length?`Застосувати підключення · зміниться ${effects.length} команд`:'Застосувати підключення';$('[data-apply]').title=applyLabel;$('[data-apply]').setAttribute('aria-label',applyLabel);
 }
 function startWire(key){
  if(mountLinks(draft).some(([,hole])=>hole===key)){hint('Отвір зайнятий ніжкою. Обери вільний отвір тієї самої групи.');return;}
  selection={kind:'pin',id:key};pending=key;rewire=null;drawLines();drawSelection();renderSide();
  hint(`${title(draft,key)} → обери кінцевий контакт. Esc — скасувати.`);
 }
 function choosePin(key){
  if(!pending){
   selection={kind:'pin',id:key};rewire=null;drawLines();drawSelection();renderSide();
   hint(`${title(draft,key)} · довідка. Для проводу перетягни контакт або натисни «Під’єднати провід».`);return;
  }
  const occupied=mountLinks(draft).find(([,hole])=>hole===key);
  if(occupied){hint('У цьому отворі вже є ніжка. Для проводу обери вільний отвір тієї самої групи з п’яти.');return;}
  if(pending===key){cancelPendingWire();return;}
  try{
   const a=pending,id=rewire,roles=[analysis.terminals.get(a)?.role,analysis.terminals.get(key)?.role],color=autoWireColor(roles);
   const next=cloneWiring(draft);
   if(id){const wire=next.wires.find(w=>w.id===id);wire[wire.a===a?'b':'a']=key;}else next.wires.push({id:uid(),a,b:key,color});
   validateWiring(next);pending=null;rewire=null;selection={kind:'pin',id:key};commit(next);
   hint(id?'Провід перенесено.':'Провід додано. Перевір підказки праворуч.');
  }catch(e){hint(e.message);}
 }
 function field(label,value,onchange,type='text'){
  const l=el('label',label),input=el('input');input.type=type;input.value=value;if(type==='text')input.maxLength=40;input.onchange=()=>{try{onchange(input.value);}catch(e){hint(e.message);input.value=value;}};l.append(input);side.append(l);return input;
 }
 function apply(){changeWiring(workspace,draft);notice('Підключення збережено. Іменовані команди використовують GPIO з цієї схеми.');}
 function addBlock(ref,action){
  apply();const ws=targetWorkspace;
  Blockly.Events.setGroup(true);
  try{
   let start=ws.getTopBlocks(true).find(b=>b.type==='my_block_body'||b.type==='usb_start');
   if(!start)start=Blockly.serialization.blocks.append({type:'usb_start',x:35,y:35},ws,{recordUndo:true});
   let connection=start.type==='my_block_body'?start.getInput('DO').connection:start.nextConnection;
   while(connection?.targetBlock()){
    const tail=connection.targetBlock();if(tail.nextConnection)connection=tail.nextConnection;else if(tail.getInput('DO'))connection=tail.getInput('DO').connection;else{connection=null;break;}
   }
   const block=Blockly.serialization.blocks.append(wiredBlockState(ref,action),ws,{recordUndo:true});if(connection)connection.connect(block.previousConnection);else block.moveBy(60,80);
   dialog.close();block.select();ws.centerOnBlock(block.id);
  }finally{Blockly.Events.setGroup(false);}
 }
 function selectJumper(id){
  selection={kind:'jumper',id};pending=null;rewire=null;audit=-1;showChecks=false;drawLines();drawSelection();renderSide();
  hint('JUMP · обери живлення червоних рядів V у боковій панелі.');
 }
 function renderJumper(c){
  const voltage=jumperVoltage(c),value=String(voltage).replace('.',',');
  side.append(el('h3','Перемичка JUMP'),el('p','Обирає живлення модулів на всіх червоних контактах V: 3,3 В або 5 В.'));
  const diagram=el('div',undefined,'jumper-explanation');
  diagram.innerHTML=`<svg viewBox="0 0 240 140" role="img" aria-label="Місток V–${value} В: живлення червоних контактів"><rect x="73" y="12" width="30" height="116" rx="5" fill="#252e30"/><path d="M90 70H150" stroke="#c65d4a" stroke-width="4"/><rect x="150" y="48" width="80" height="44" rx="8" fill="#b74d3d"/><text x="190" y="66" text-anchor="middle" fill="white">Ряд V</text><text x="190" y="83" text-anchor="middle" fill="white">${value} В</text>${['3V3','V','5V'].map((label,i)=>`<text x="60" y="${34+i*40}" text-anchor="end">${label}</text><circle cx="88" cy="${30+i*40}" r="6" fill="#cbd1cd"/>`).join('')}<rect x="77" y="${voltage===3.3?19:59}" width="22" height="62" rx="5" fill="none" stroke="#e5c541" stroke-width="7"/></svg>`;
  side.append(diagram);
  const choices=el('div',undefined,'jumper-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Положення перемички');side.append(choices);
  for(const v of [3.3,5]){const b=button(`${String(v).replace('.',',')} В`,()=>{
   if(c.jumperVoltage===v)return;
   mutate(s=>{s.components.find(n=>n.id===c.id).jumperVoltage=v;});
   side.querySelector(`[data-jumper-value="${v}"]`).focus({preventScroll:true});hint(`На схемі: JUMP → ${String(v).replace('.',',')} В. Звір із реальною платою.`);
  },choices);b.dataset.jumperValue=v;b.setAttribute('aria-pressed',String(voltage===v));}
  side.append(el('p',c.jumperVoltage===undefined?'Початкове положення 5 В взято з твого фото.':`На схемі обрано ${value} В.`));
  const legend=el('div',undefined,'jumper-legend');for(const [row,text,color]of [['S','Сигнал GPIO · 3,3 В','#d1b644'],['V',`Живлення модуля · ${value} В`,'#b74d3d'],['G','GND · спільний мінус','#303c40']]){const line=el('div'),badge=el('b',row);badge.style.background=color;line.append(badge,el('span',text));legend.append(line);}side.append(legend);
  side.append(el('p','Для датчика з живленням 3,3 В обери 3,3 В, з’єднай його живлення з V, землю з G, а сигнал із потрібним S.'),el('p','Перемичка не змінює напругу GPIO й не підвищує напругу батарей. Якщо мотор живиться від окремих батарей через DRV8833, JUMP не змінює його живлення.'),el('p','Це налаштування схеми. На справжній платі перестав перемичку вручну лише без живлення. Напругу V звір із учителем; напруга окремих VCC цим вибором не підтверджується.'));
 }
 function selectedComponent(){
  return ['component','jumper'].includes(selection?.kind)?draft.components.find(c=>c.id===selection.id):selection?.kind==='pin'?analysis.terminals.get(selection.id)?.component:null;
 }
 function rotateComponent(delta){
  const c=selectedComponent();if(!c)return;
  pending=null;rewire=null;
  mutate(s=>{const node=s.components.find(n=>n.id===c.id),wasInserted=!!node.breadboardMount,anchor=mountPins(node)[0],old=physicalLayout(node).points.get(anchor);
   delete node.breadboardMount;node.rotation=((node.rotation??0)+delta+360)%360;
   if(wasInserted){const p=physicalLayout(node).points.get(anchor);node.x=Math.max(0,node.x+old.x-p.x);node.y=Math.max(0,node.y+old.y-p.y);seatComponent(s,node);}
  },{physical:!!c.breadboardMount});
  zoom(scale);hint(`${c.name} · поворот ${draft.components.find(n=>n.id===c.id).rotation}°`);
 }
 $('[data-rotate-left]').onclick=()=>rotateComponent(-90);
 $('[data-rotate-right]').onclick=()=>rotateComponent(90);
 function renderExpansionPinDocumentation(t,doc,status){
  const card=el('section',undefined,'wiring-pin-docs');card.setAttribute('aria-label','Документація контакту');
  card.append(el('span',doc.kind,'wiring-pin-kind'),el('h3',doc.title),el('p',doc.path,'wiring-pin-path'),el('p',doc.description));
  if(doc.modes.length){const modes=el('ul',undefined,'wiring-pin-modes');modes.setAttribute('aria-label','Доступні режими');for(const mode of doc.modes)modes.append(el('li',mode));card.append(modes);}
  if(doc.signalVoltage)card.append(el('p',doc.signalVoltage));
  if(doc.warning)card.append(el('p',doc.warning,'wiring-pin-problem'));
  if(doc.jumper)button('Показати перемичку JUMP',()=>selectJumper(t.component.id),card);
  if(doc.hostPin&&t.hostPin)button('Показати контакт на ESP32',()=>{pending=null;rewire=null;focusKeys([endpoint(t.component,doc.hostPin)]);},card);
  side.insertBefore(card,status);
 }
 function renderIssue(issue,parent=side){
  const b=button(issue.message,()=>{
   pending=null;rewire=null;
   const c=analysis.terminals.get(issue.keys[0])?.component;
   if(issue.code==='expansion-power'&&c&&(mounted(c)||c.kind==='expansion'))selectJumper(c.id);
   else focusKeys(issue.keys);
  },parent);
  b.className='wiring-issue';b.dataset.severity=issue.severity;b.dataset.issue=issue.code;
  if(issue.steps?.length){b.replaceChildren(el('strong',issue.message));for(const step of issue.steps)b.append(el('span',step,'wiring-issue-step'));}
  if(['error','incomplete'].includes(issue.severity)&&issue.keys.length){
   const t=analysis.terminals.get(issue.keys[0]);
   if(t){const m=t.component.breadboardMount,hole=m?.holes[t.id],board=hole&&draft.components.find(c=>c.id===m.boardId);
    b.append(el('span',`Показати ${t.label}${hole?` · ${board.name} ${hole}`:''} ↗`,'wiring-issue-target'));
   }
  }
 }
 function renderUrgentChecks(){
  for(const [severity,name]of [['error','Помилки підключення'],['incomplete','Незавершені підключення']]){
   const issues=analysis.issues.filter(i=>i.severity===severity);if(!issues.length)continue;
   const list=el('section',undefined,'wiring-urgent-checks');list.setAttribute('aria-label',name);side.append(list);
   for(const issue of issues)renderIssue(issue,list);
  }

 }
 function renderSide(){
  if(selection?.kind==='components')selectComponents(selection.ids.filter(id=>draft.components.some(c=>c.id===id)));
  if(selection&&selection.kind!=='components'&&!((['component','jumper'].includes(selection.kind)&&draft.components.some(c=>c.id===selection.id&&(selection.kind!=='jumper'||mounted(c)||c.kind==='expansion')))||(selection.kind==='wire'&&draft.wires.some(w=>w.id===selection.id))||(selection.kind==='pin'&&analysis.terminals.has(selection.id))))selection=null;
  $('.wiring-rotation').hidden=!selectedComponent();
  const visible=!!selection||audit>=0||showChecks;
  side.hidden=!visible;$('.wiring-layout').dataset.inspector=String(visible);
  $('[data-checks]').setAttribute('aria-expanded',String(visible));
  side.replaceChildren();
  const close=button('✕',()=>{clearSelection();scroll.focus({preventScroll:true});});close.className='wiring-inspector-close';close.setAttribute('aria-label','Закрити властивості');
  const counts=analysis.issues.reduce((o,i)=>(o[i.severity]=(o[i.severity]||0)+1,o),{});
  const summary=$('[data-checks]');const label=counts.error?`Помилки: ${counts.error}`:counts.incomplete?`Незавершені з’єднання: ${counts.incomplete}`:'Перевірити з’єднання';summary.title=label;summary.setAttribute('aria-label',label);const badge=summary.querySelector('.wiring-check-count');badge.textContent=counts.error||counts.incomplete||'';badge.hidden=!badge.textContent;summary.dataset.state=counts.error?'error':counts.incomplete?'incomplete':'ready';
  if(selection?.kind==='components'){side.append(el('h3',`Вибрано компонентів: ${selection.ids.length}`),el('p','Тягни будь-який вибраний компонент. Shift + клік змінює вибір. Компоненти, вставлені в мініборд, рухаються разом із ним.'));button('Зняти вибір',clearSelection);return;}
  if(selection?.kind==='jumper'){renderJumper(selectedComponent());return;}
  const status=el('div',counts.error?`Помилки: ${counts.error}`:counts.incomplete?`Незавершені підключення: ${counts.incomplete}`:'Відомих помилок з’єднань не знайдено','wiring-status');status.dataset.state=counts.error?'error':counts.incomplete?'incomplete':'ready';side.append(status);
  if(audit<0)renderUrgentChecks();
  if(counts.unknown)side.append(el('p',`Звірити вручну: ${counts.unknown}. Це ще не підтвердження готовності до живлення.`));
  if(audit>=0){
   const wire=draft.wires[audit];side.append(el('h3',`Звіряння · ${Math.min(audit+1,draft.wires.length)} / ${draft.wires.length}`));
   if(wire){side.append(el('p',`${title(draft,wire.a)} → ${title(draft,wire.b)}`));button('Цей провід збігається ✓',()=>{mutate(s=>{s.checked=[...new Set([...(s.checked||[]),wire.id])];},{physical:false});audit++;drawLines();renderSide();});button('Попередній',()=>{audit=Math.max(0,audit-1);drawLines();renderSide();});}
   else side.append(el('p','Усі позначені проводи звірено тобою. Редактор не вимірює реальну схему.'));
   button('Завершити звіряння',()=>{audit=-1;drawLines();renderSide();});return;
  }
  if(selection?.kind==='component'){
   const c=draft.components.find(c=>c.id===selection.id);if(c){
    side.append(el('h3',c.name));field('Назва компонента',c.name,value=>mutate(s=>{s.components.find(n=>n.id===c.id).name=value.trim();},{physical:false}));
    if(c.breadboardMount){
     const m=c.breadboardMount,b=draft.components.find(n=>n.id===m.boardId);
     side.append(el('p',`Вставлено в ${b.name}: ${Object.entries(m.holes).map(([pin,hole])=>`${pin} → ${hole}`).join(', ')}. Проводи для ніжок не потрібні.`,'wiring-mount-status'));
     button('Витягнути з breadboard',()=>mutate(s=>{const n=s.components.find(n=>n.id===c.id);delete n.breadboardMount;n.x=Math.min(2800,b.x+physicalLayout(b).width+30);n.y=b.y;}));
    }else if(c.kind==='driver')side.append(el('p','Поверни плату поперек канавки (R / Shift+R) і перетягни на breadboard. Відпусти, коли підсвітяться всі 12 отворів. Між рядами — 7 кроків сітки.'));
    else if(['resistor','led'].includes(c.kind))side.append(el('p','Перетягни на breadboard: коли обидва отвори підсвітяться, відпусти. R / Shift+R повертає компонент.'));
    if(c.kind==='breadboard')side.append(el('p','Обери отвір: підсвітяться 5 з’єднаних контактів. A–E одного номера з’єднані між собою, F–J того самого номера — окрема група. Через центральну канавку та між сусідніми номерами з’єднання немає. Шин +/− тут немає.'));
    if(c.kind==='led'){
     const label=el('label','Колір світлодіода'),select=el('select');select.dataset.ledColor='';select.append(...Object.entries(LED_COLORS).map(([value,meta])=>new Option(meta.name,value)));select.value=ledColor(c);select.onchange=()=>mutate(s=>{s.components.find(n=>n.id===c.id).ledColor=select.value;},{physical:false});label.append(select);side.append(label);
     side.append(el('p','A — анод, довша ніжка. K — катод, коротша ніжка біля плаского краю. Підключи GPIO → резистор → A, K → GND.'));
     const binding=analysis.bindings.find(b=>b.ref===`${c.id}:A`);if(binding?.available){side.append(el('p',`${c.name} → GPIO${binding.gpio}`));button('＋ Команда увімкнути / вимкнути',()=>addBlock(binding.ref,'write'));button('＋ Команда ШІМ',()=>addBlock(binding.ref,'pwm'));}
    }
    if(c.kind==='resistor'){
     const label=el('label','Опір резистора'),select=el('select');select.dataset.resistance='';select.append(...RESISTANCES.map(value=>new Option(formatResistance(value),String(value))));select.value=String(resistance(c));select.onchange=()=>mutate(s=>{s.components.find(n=>n.id===c.id).resistance=Number(select.value);});label.append(select);side.append(label);
     const bands=resistorBands(resistance(c)),legend=el('div',undefined,'resistor-band-legend');legend.setAttribute('aria-label','Кольорове маркування резистора');
     for(const [i,[name,color]]of bands.entries()){const item=el('span'),swatch=el('i');swatch.style.background=color;item.append(swatch,el('span',`${i+1}. ${name}`));legend.append(item);}side.append(legend,el('p','Дві перші смуги — цифри, третя — множник, золота — допуск ±5%. Резистор можна підключати будь-яким кінцем.'));
    }
    const pinLabel=el('label','Контакт'),pinSelect=el('select');pinSelect.append(...ports(c).map(p=>new Option(p.label,endpoint(c,p.id))));pinLabel.append(pinSelect);side.append(pinLabel);button('Під’єднати провід',()=>startWire(pinSelect.value));
    if(mounted(c)||c.kind==='expansion')button('Перемичка JUMP · 3,3 В / 5 В',()=>selectJumper(c.id));
    if(CATALOG[c.kind].model)button('Роздивитися в 3D',()=>inspect3D(c));
    if(c.kind==='esp32'){
     const label=el('label','Плата розширення'),select=el('select');select.dataset.expansion='';select.append(new Option('Без плати розширення','none'),new Option('ESP32S 38P · S / V / G',EXPANSION));select.value=c.expansion||'none';
     select.onchange=()=>{
      if(select.value==='none'&&draft.wires.some(w=>[w.a,w.b].some(k=>k.startsWith(c.id+':exp-')))){hint('Спочатку прибери проводи з контактів плати розширення. Їхні підключення збережено.');select.value=c.expansion;return;}
      pending=null;rewire=null;mutate(s=>{const node=s.components.find(n=>n.id===c.id);const oldWidth=physicalLayout(node).width;node.expansion=select.value;const growth=physicalLayout(node).width-oldWidth;if(growth>0)for(const other of s.components)if(other.id!==node.id&&other.x>node.x+100)other.x=Math.min(3000,other.x+growth);});requestAnimationFrame(fit);
     };label.append(select);side.append(label);
    }
    if(c.kind==='expansion'){
     const label=el('label','Встановлена плата'),select=el('select');select.append(new Option('Не вибрано',''),...draft.components.filter(n=>n.kind==='esp32').map(n=>new Option(n.name,n.id)));select.value=c.host||'';select.onchange=()=>mutate(s=>{const n=s.components.find(n=>n.id===c.id);n.host=select.value;});label.append(select);side.append(label);
    }
    button('Видалити компонент',()=>{mutate(s=>{detachChildren(s,c.id);s.components=s.components.filter(n=>n.id!==c.id);s.wires=s.wires.filter(w=>!w.a.startsWith(c.id+':')&&!w.b.startsWith(c.id+':'));for(const n of s.components)if(n.host===c.id){n.host='';}});selection=null;renderSide();});
   }
  }else if(selection?.kind==='wire'){
   const w=draft.wires.find(w=>w.id===selection.id);if(w){
    side.append(el('h3','Провід'),el('p',`${title(draft,w.a)} → ${title(draft,w.b)}`));
    const palette=el('fieldset',undefined,'wire-colors');palette.append(el('legend','Колір проводу'));
    for(const {value,name,use}of WIRE_COLORS){
     const choice=button('',()=>{
      if(w.color.toLowerCase()!==value)mutate(s=>{s.wires.find(x=>x.id===w.id).color=value;},{physical:false});
      side.querySelector(`[data-wire-color="${value}"]`)?.focus({preventScroll:true});
     },palette);
     choice.dataset.wireColor=value;choice.setAttribute('aria-label',`${name} · ${use}`);choice.setAttribute('aria-pressed',String(w.color.toLowerCase()===value));
     const swatch=el('span',undefined,'wire-color-swatch');swatch.style.backgroundColor=value;swatch.setAttribute('aria-hidden','true');
     const label=el('span',name);label.append(el('small',use));choice.append(swatch,label);
    }
    side.append(palette,el('p','Колір допомагає розрізняти проводи й не змінює їхніх з’єднань.','wire-color-help'));
    side.append(el('p','Перетягни круглу ручку вибраного проводу на інший пін. Перетягування з самого піна додає новий провід. Тягни квадратну ручку, щоб зсунути відрізок. Подвійний клік додає згин; круглу ручку можна пересувати. Сітка вирівнює рух, Alt — вільно. Delete на круглій ручці прибирає згин.'));
    if(routing.warnings.has(w.id))side.append(el('p','Компонент перекрив ручний згин. Тимчасово прокладаємо провід в обхід; перенеси згин або поверни автоматичний маршрут.'));
    const automatic=button('Автоматичний маршрут',()=>mutate(s=>{delete s.wires.find(n=>n.id===w.id).vertices;},{physical:false}));automatic.dataset.autoRoute='';automatic.disabled=!w.vertices?.length;
    for(const [end,other]of [['a','b'],['b','a']])button(`Замінити: ${title(draft,w[end])}`,()=>{pending=w[other];rewire=w.id;hint('Обери новий контакт. Попередній провід зміниться після вибору.');drawSelection();});
    button('Видалити провід',()=>{mutate(s=>{s.wires=s.wires.filter(x=>x.id!==w.id);});selection=null;renderSide();});
   }
  }else if(selection?.kind==='pin'){
   const t=analysis.terminals.get(selection.id);if(t){
    const documentation=expansionPinDocs(t);
    if(documentation)renderExpansionPinDocumentation(t,documentation,status);
    else side.append(el('h3',title(draft,t.key)),el('p',({rail:t.voltage===5?'5V — контакт живлення, не GPIO. Перед зовнішнім живленням звір напругу та розводку. Не поєднуй його з USB-живленням без підтвердженої розв’язки.':'Контакт живлення 3,3 В, не GPIO.',gpio:'Вихід або вхід ESP32. Сигнали — 3,3 В.',input:'Лише вхід: цей пін читає сигнал.',ground:'Спільна земля електроніки.',breadboard:`Отвір ${t.id}. Усередині з’єднаний лише з ${t.group?.startsWith('AE')?'A–E':'F–J'} номера ${t.id.slice(1)}. Ці п’ять отворів підсвічені на платі.`, 'led-anode':'A — анод, довга ніжка. У цій вправі — до GPIO через резистор.','led-cathode':'K — катод, коротка ніжка біля плаского краю. У цій вправі — до GND.',resistor:'Вивід резистора. Полярності немає: A та B взаємозамінні.',control:'Вхід керування драйвера.',output:'Вихід драйвера до мотора.',motor:'Провід мотора до виходу драйвера.',usb:'USB-кабель до комп’ютера.',unknown:'Внутрішній шлях і напруга не підтверджені.'})[t.role]||'Звір маркування та призначення контакту.'));
    button(pending?'Скасувати підключення':'Під’єднати провід',()=>pending?cancelPendingWire():startWire(t.key));
    const bindings=analysis.bindings.filter(b=>b.ref===t.key||b.keys?.includes(t.key)||analysis.net(t.key).some(p=>p.key===b.ref));
    for(const b of bindings){const problem=unavailableConnections(draft,analysis).find(p=>p.ref===b.ref),shown=b.gpio??problem?.connectedGpio;side.append(el('p',`${b.label} → ${shown==null?'потрібен GPIO':`GPIO${shown}`}`));if(problem){for(const message of problem.messages)side.append(el('p',message,'wiring-pin-problem'));}if(b.available&&b.role!=='fault'){button('＋ Команда увімкнути / вимкнути',()=>addBlock(b.ref,'write'));button('＋ Команда ШІМ',()=>addBlock(b.ref,'pwm'));}}
    button('Знайти команди в програмі',()=>{
     const matches=(ref,type,pin)=>ref===t.key||bindings.some(x=>x.ref===ref)||type?.startsWith('usb_pin_')&&(Number(pin)===t.gpio||bindings.some(x=>x.gpio!==null&&x.gpio===Number(pin)));
     const found=targetWorkspace.getAllBlocks().filter(b=>matches(b.wiringRef,b.type,b.getFieldValue('PIN')));
     if(found.length){apply();dialog.close();targetWorkspace.centerOnBlock(found[0].id);targetWorkspace.highlightBlock(found[0].id);found[0].select();notice(`Знайдено команд: ${found.length}. Показано першу.`);}
     else{
      function contains(node){return !!node&&typeof node==='object'&&(matches(node.extraState?.ref,node.type,node.fields?.PIN)||Object.values(node).some(contains));}
      const definition=getMyBlocks(targetWorkspace).find(d=>contains(d.body));
      if(definition){apply();dialog.close();openMyBlockDefinition(targetWorkspace,definition.id);notice(`Підключення використане у «${definition.name}».`);}
      else hint('У програмі ще немає такої команди. Її можна додати з підключеного IN.');
     }
    });
   }
  }
  side.append(el('h4','Що перевірити'));
  if(!draft.components.length)side.append(el('p','Перетягни ESP32, драйвер і мотор із палітри ліворуч.'));
  for(const issue of analysis.issues.filter(i=>!['error','incomplete'].includes(i.severity)))renderIssue(issue);
  side.append(el('p','Перевіряємо намальовані з’єднання. Фізичні проводи, напругу та струм через USB визначити не можемо.'));
  if(draft.wires.length){side.append(el('h4',`Проводи · ${draft.wires.length}`));const list=el('div',undefined,'wiring-wire-list');side.append(list);for(const w of draft.wires)button(`${draft.checked?.includes(w.id)?'✓ ':''}${title(draft,w.a)} → ${title(draft,w.b)}`,()=>{selection={kind:'wire',id:w.id};drawLines();renderSide();},list);}
 }
 async function inspect3D(c){
  viewerDialog=el('dialog',undefined,'wiring-viewer-dialog');const close=button('Повернутися до схеми',()=>viewerDialog.close(),viewerDialog),front=button('Спереду',()=>viewer?.view('front'),viewerDialog),back=button('Зворотний бік',()=>viewer?.view('back'),viewerDialog),host=el('div');viewerDialog.append(host);document.body.append(viewerDialog);viewerDialog.showModal();
  const localDialog=viewerDialog;localDialog.addEventListener('close',()=>{viewer?.dispose();viewer=null;localDialog.remove();});
  const {createModuleViewer}=await import('./assembly/module-viewer.js');if(!localDialog.open)return;
  const layout=physicalLayout(c),pins=ports(c).filter(p=>p.role!=='usb').map(p=>({name:p.id,label:p.label,role:p.role,color:colorFor(p.role),...layout.points.get(p.id).world}));
  viewer=createModuleViewer(host,{model:mounted(c)?'esp32-mounted':CATALOG[c.kind].model,jumperVoltage:jumperVoltage(c),pins:c.kind==='expansion'?[]:pins},pin=>{
   const match=c.kind==='esp32'&&/^([LR])(\d+)$/.exec(pin);
   if(match)pin=`${match[1]==='L'?'left':'right'}-${Number(match[2])-1}`;
   else if(mounted(c)&&!pin.startsWith('exp-'))pin='exp-'+pin;
   if(!pins.some(p=>p.name===pin))return;
   localDialog.close();choosePin(endpoint(c,pin));
  });viewer.view('front');
 }
 function open(ref=null,target=workspace){
  targetWorkspace=target;before=cloneWiring(getWiring(workspace));draft=mountLegacyExpansions(before);undo=[];redo=[];pending=null;rewire=null;audit=-1;showChecks=false;$('.wiring-impact-menu').open=false;selection=ref?{kind:draft.components.some(c=>c.id===ref)?'component':'pin',id:ref}:null;previousFocus=document.activeElement;
  multiSelect=false;selectMany.setAttribute('aria-pressed','false');dialog.showModal();render();hint('Shift + клік або «Вибрати кілька» — вибір групи. Тягни вибраний компонент, щоб рухати групу.');ensureRouter();requestAnimationFrame(()=>{fit();if(ref&&selection?.kind==='pin')focusKeys([ref]);});
 }
 function addComponent(kind,position){
  const meta=CATALOG[kind];
  if(kind==='esp32'&&draft.components.some(c=>c.kind===kind)){hint('У цьому проєкті вже є ESP32.');return;}
  const id=uid(),n=draft.components.filter(c=>c.kind===kind).length+1,positions={esp32:[60,50],driver:[460,60],motor:[900,100],breadboard:[430,400],resistor:[450,150],led:[850,130],battery:[700,490],usb:[60,700],expansion:[1150,500]},[x,y]=position?[position.x,position.y]:positions[kind];
  mutate(s=>{s.components.push({id,kind,name:meta.name+(n>1?' '+n:''),x:Math.min(1680,x+(n-1)*70),y:Math.min(850,y+(n-1)*90),...(kind==='resistor'?{resistance:330}:kind==='led'?{ledColor:'red'}:{})});if(position)seatComponent(s,s.components.at(-1));});selection={kind:'component',id};renderSide();drawSelection();if(!position)requestAnimationFrame(fit);
 }
 for(const [group,kinds]of [['Плата',['esp32']],['Світло',['led','resistor']],['Монтаж',['breadboard']],['Мотори',['driver','motor']],['Живлення',['battery','usb']]]){
  $('.wiring-palette').append(el('h3',group));
  for(const kind of kinds){const meta=CATALOG[kind],b=button(`＋ ${meta.name}`,()=>{if(suppressPinClick){suppressPinClick=false;return;}addComponent(kind);},$('.wiring-palette'));b.dataset.catalog=kind;const image=el('img');image.draggable=false;image.alt='';componentArt(kind).then(src=>image.src=src);b.prepend(image);
   b.onpointerdown=e=>{if(e.button!==0)return;suppressPinClick=false;drag={kind:'catalog',component:kind,x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);};
  }
 }
 // Familiar Blockly controls: category rail, canvas pan, zoom, keyboard undo and delete.
 for(const selector of ['[data-wire-fit]','[data-in]','[data-out]','[data-zoom]'])$('.wiring-canvas-controls').append($(selector));
 $('[data-wire-fit]').textContent='⊙';$('[data-wire-fit]').setAttribute('aria-label','Уся схема');
 const trash=button('',()=>deleteSelection(),$('.wiring-canvas-controls'));trash.setAttribute('aria-label','Видалити вибране');trash.dataset.trash='';trash.innerHTML='<svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true"><path d="M4 7h16l-1 18H5zM2 3h20v2H2zM8 0h8v2H8z" fill="currentColor"/></svg>';
 function clearSelection(){selection=null;pending=null;rewire=null;audit=-1;showChecks=false;drawLines();drawSelection();renderSide();hint('Shift + клік або «Вибрати кілька» — вибір групи. Тягни фон, щоб рухати полотно.');}
 $('[data-palette-toggle]').onclick=()=>{
  paletteCollapsed=!paletteCollapsed;$('.wiring-palette').hidden=paletteCollapsed;$('.wiring-layout').dataset.paletteCollapsed=String(paletteCollapsed);
  $('[data-palette-toggle]').setAttribute('aria-expanded',String(!paletteCollapsed));$('[data-palette-toggle]').title=paletteCollapsed?'Розгорнути палітру компонентів':'Згорнути палітру компонентів';$('[data-palette-toggle]').setAttribute('aria-label',$('[data-palette-toggle]').title);
 };
 $('[data-checks]').onclick=()=>{if(!side.hidden){clearSelection();return;}showChecks=true;renderSide();side.scrollTop=0;};
 $('[data-apply]').onclick=()=>{apply();dialog.close();};for(const b of dialog.querySelectorAll('[data-close]'))b.onclick=()=>dialog.close();
 $('[data-undo]').onclick=()=>{if(!undo.length)return;redo.push(cloneWiring(draft));draft=undo.pop();pending=null;rewire=null;render();};
 $('[data-redo]').onclick=()=>{if(!redo.length)return;undo.push(cloneWiring(draft));draft=redo.pop();pending=null;rewire=null;render();};
 const center=()=>{const r=scroll.getBoundingClientRect();return {x:r.left+scroll.clientWidth/2,y:r.top+scroll.clientHeight/2};};$('[data-in]').onclick=()=>zoom(scale*1.2,center());$('[data-out]').onclick=()=>zoom(scale/1.2,center());$('[data-wire-fit]').onclick=fit;
 $('[data-audit]').onclick=()=>{if(!draft.wires.length){hint('Спочатку намалюй проводи.');return;}pending=null;rewire=null;audit=0;drawSelection();drawLines();renderSide();};
 board.addEventListener('click',e=>{if(e.target===board||e.target===svg){clearSelection();}});
 function cancelPendingWire(){if(drag?.kind==='wire'){const id=drag.pointerId;drag=null;suppressPinClick=true;if(scroll.hasPointerCapture(id))scroll.releasePointerCapture(id);}pending=null;rewire=null;drawLines();drawSelection();renderSide();hint('Прокладання проводу скасовано.');}
 dialog.addEventListener('cancel',e=>{if($('.wiring-impact-menu').open){e.preventDefault();$('.wiring-impact-menu').open=false;$('.wiring-impact-menu summary').focus();return;}if(drag?.kind==='wire-end'){e.preventDefault();cancelWireEnd();return;}if(drag?.kind==='route'){e.preventDefault();draft=drag.start;drag=null;render();return;}if(pending){e.preventDefault();cancelPendingWire();}});
 dialog.addEventListener('close',()=>{autoRouter?.dispose?.();autoRouter=null;routerLoading=null;viewerDialog?.close();pending=null;drag=null;spaceHeld=false;ghost?.remove();ghost=null;previousFocus?.focus?.();});
 function deleteSelection(){
  if(!selection)return;
  if(['pin','jumper'].includes(selection.kind)){pending=null;rewire=null;drawSelection();return;}
  const selected=selection;const ids=selectedIds();selection=null;pending=null;rewire=null;
  mutate(s=>{if(selected.kind==='wire')s.wires=s.wires.filter(w=>w.id!==selected.id);else{for(const id of ids)detachChildren(s,id);s.components=s.components.filter(c=>!ids.includes(c.id));s.wires=s.wires.filter(w=>![w.a,w.b].some(k=>ids.includes(k.split(':')[0])));for(const c of s.components)if(ids.includes(c.host)){c.host='';}}});
 }
 scroll.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1)return;
  if(!spaceHeld&&e.target.closest('.wiring-component,.wire-hit,.wire-handle'))return;
  e.preventDefault();drag={kind:'pan',x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop,moved:false};scroll.setPointerCapture(e.pointerId);
 });
 scroll.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(scale*Math.exp(-e.deltaY*.005),{x:e.clientX,y:e.clientY});}},{passive:false});
 dialog.addEventListener('keydown',e=>{
  if(e.isComposing||e.target.matches('input,select,textarea')||e.target.isContentEditable)return;
  if(e.key==='Escape'&&drag?.kind==='group'){e.preventDefault();draft=drag.start;drag=null;render();return;}
  if(e.key==='Escape'&&selection?.kind==='components'){e.preventDefault();clearSelection();return;}
  if(e.key==='Escape'&&drag?.kind==='wire-end'){e.preventDefault();cancelWireEnd();return;}
  if(e.key==='Escape'&&drag?.kind==='route'){e.preventDefault();draft=drag.start;drag=null;render();return;}
  if(e.key==='Escape'&&pending&&!$('.wiring-impact-menu').open){e.preventDefault();cancelPendingWire();return;}
  if(e.key==='Escape'&&selection?.kind==='pin'&&!$('.wiring-impact-menu').open){e.preventDefault();clearSelection();return;}
  if(e.code==='KeyR'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&selectedComponent()){
   e.preventDefault();if(e.repeat||drag)return;rotateComponent(e.shiftKey?-90:90);scroll.focus({preventScroll:true});return;
  }
  if(e.code==='Space'&&e.target.closest('button'))return;
  if(e.code==='Space'){e.preventDefault();spaceHeld=true;scroll.classList.add('is-panning');}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();$(e.shiftKey?'[data-redo]':'[data-undo]').click();}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();$('[data-redo]').click();}
  if(['Delete','Backspace'].includes(e.key)){e.preventDefault();deleteSelection();}
  if(e.key==='+'||e.key==='=')zoom(scale*1.15,{x:scroll.getBoundingClientRect().left+scroll.clientWidth/2,y:scroll.getBoundingClientRect().top+scroll.clientHeight/2});
  if(e.key==='-')zoom(scale/1.15,{x:scroll.getBoundingClientRect().left+scroll.clientWidth/2,y:scroll.getBoundingClientRect().top+scroll.clientHeight/2});
 });
 dialog.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;scroll.classList.remove('is-panning');}});
 dialog.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;
  if(drag.kind==='wire-end'){
   const r=board.getBoundingClientRect();drag.target=pinAtPointer(e);drag.preview={x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};drawSelection();drawLines();
   const wire=draft.wires.find(w=>w.id===drag.id),problem=wireEndProblem(wire,drag.end,drag.target);
   hint(drag.target?(problem||`Відпусти на ${title(draft,drag.target)}`):'Перенеси кінець на інший контакт. Esc — скасувати.');return;
  }
  if(drag.kind==='route'){const original=drag.start.wires.find(w=>w.id===drag.id),b=board.getBoundingClientRect(),vertices=drag.type==='vertex'?original.vertices.map((p,i)=>i===drag.index?{x:snapRoute((e.clientX-b.left)/scale,e.altKey),y:snapRoute((e.clientY-b.top)/scale,e.altKey)}:p):moveRouteSegment(drag.points,drag.index,(drag.horizontal?dy:dx)/scale,e.altKey);if(validVertices(vertices)){draft.wires.find(w=>w.id===drag.id).vertices=vertices;drawLines();hint('Ручний маршрут · Alt вимикає прив’язку до сітки.');}else hint('Згин не може бути всередині компонента.');return;}
  if(drag.kind==='group'){
   draft=moveComponentGroup(drag.start,drag.ids,dx/scale,dy/scale,drag.routes);
   for(const card of board.querySelectorAll('.wiring-component')){const c=draft.components.find(c=>c.id===card.dataset.component);card.style.left=c.x+'px';card.style.top=c.y+'px';card.dataset.inserted=String(!!c.breadboardMount);}
   drawLines();return;
  }
  if(drag.kind==='pan'){scroll.scrollLeft=drag.left-dx;scroll.scrollTop=drag.top-dy;return;}
  if(drag.kind==='catalog'){if(!ghost){ghost=el('img',undefined,'wiring-drag-preview');ghost.src=$(`[data-catalog="${drag.component}"] img`).src;dialog.append(ghost);}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';hint('Перетягни компонент на полотно й відпусти.');return;}
  if(drag.kind==='wire'){
   pending=drag.from;rewire=null;scroll.setPointerCapture(drag.pointerId);drawSelection();const r=board.getBoundingClientRect(),key=pinAtPointer(e);
   drawLines({x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale});
   const problem=key?wireEndProblem({id:null,a:drag.from,b:null},'b',key):'';
   if(key){const target=[...board.querySelectorAll('.wire-pin')].find(p=>p.dataset.endpoint===key);if(target)target.dataset.dropTarget=problem?'invalid':'valid';}
   hint(key?(problem||`Відпусти на ${title(draft,key)}`):'Перетягни на кінцевий контакт. Esc — скасувати.');
  }
  else{const c=draft.components.find(c=>c.id===drag.id),old=drag.start.components.find(c=>c.id===drag.id);delete c.breadboardMount;c.x=Math.round(Math.max(0,Math.min(1700,old.x+dx/scale)));c.y=Math.round(Math.max(0,Math.min(1500-height(c),old.y+dy/scale)));syncMounts(draft);drag.candidate=findMount(draft,c);
   if(drag.candidate)hint(`Вставити: ${Object.values(drag.candidate.holes).join(' та ')} · відпусти компонент`);
   else if(['resistor','led'].includes(c.kind))hint('Наведи обидві ніжки на вільні отвори breadboard.');
   for(const card of board.querySelectorAll('.wiring-component')){const n=draft.components.find(n=>n.id===card.dataset.component);card.style.left=n.x+'px';card.style.top=n.y+'px';card.dataset.inserted=String(!!n.breadboardMount);}
   drawLines();}
 });
 dialog.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;if(d.kind==='group'){drag=null;if(d.moved&&JSON.stringify(draft)!==JSON.stringify(d.start)){undo.push(d.start);redo=[];}render();scroll.focus({preventScroll:true});return;}if(d.kind==='wire-end'){finishWireEnd(e);return;}if(d.kind==='route'){drag=null;if(d.moved&&JSON.stringify(draft)!==JSON.stringify(d.start)){undo.push(d.start);redo=[];}render();scroll.focus({preventScroll:true});return;}ghost?.remove();ghost=null;if(d.kind==='pan'){drag=null;if(!d.moved&&!spaceHeld)clearSelection();return;}if(d.kind==='catalog'){if(d.moved){suppressPinClick=true;const r=scroll.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const b=board.getBoundingClientRect();addComponent(d.component,{x:Math.max(30,(e.clientX-b.left)/scale-70),y:Math.max(30,(e.clientY-b.top)/scale-40)});}}drag=null;return;}if(d.moved&&d.kind==='wire'){
   suppressPinClick=true;const key=pinAtPointer(e),problem=wireEndProblem({id:null,a:d.from,b:null},'b',key);drag=null;
   if(scroll.hasPointerCapture(d.pointerId))scroll.releasePointerCapture(d.pointerId);
   if(key&&!problem)choosePin(key);
   else hint(problem||'Провід не додано.');
   pending=null;rewire=null;drawLines();drawSelection();renderSide();
  }else if(d.moved){const r=trash.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){draft=d.start;selection={kind:'component',id:d.id};deleteSelection();}else{const c=draft.components.find(c=>c.id===d.id);const seated=seatComponent(draft,c,d.candidate);if(seated||d.start.components.find(n=>n.id===d.id)?.breadboardMount){draft.checked=[];audit=-1;}
   undo.push(d.start);redo=[];drag=null;render();if(seated)hint(`Вставлено: ${Object.values(c.breadboardMount.holes).join(' та ')}. Ніжки з’єднані без проводів.`);}}drag=null;});
 dialog.addEventListener('pointercancel',()=>{if(['component','group','route'].includes(drag?.kind))draft=drag.start;drag=null;pending=null;rewire=null;suppressPinClick=true;ghost?.remove();ghost=null;render();});
 const entry=el('button','⌁ Підключення','icon-button');entry.id='openWiring';entry.type='button';entry.onclick=()=>open();document.querySelector('.file-actions').append(entry);
 registerWiringOpener(workspace,open);registerWiredToolbox(workspace,ref=>open(ref));
 return {open};
}

Blockly.ContextMenuRegistry.registry.register({id:'mcar_show_wiring',scopeType:Blockly.ContextMenuRegistry.ScopeType.BLOCK,weight:3,
 displayText:'Показати підключення на схемі',
 preconditionFn:({block})=>block.type.startsWith('wired_pin_')||block.type.startsWith('usb_pin_')?'enabled':'hidden',
 callback:({block})=>{let ref=block.wiringRef;if(!ref){const pin=Number(block.getFieldValue('PIN')),state=getWiring(block.workspace),esp=state.components.find(c=>c.kind==='esp32');if(esp){const p=ports(esp).find(p=>p.gpio===pin);if(p)ref=endpoint(esp,p.id);}}openWiringFor(block.workspace,ref);},
});

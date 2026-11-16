import {Blockly} from './usb-blocks.js';
import {boardPins,supportsPin,pinActions} from './usb-pins.js';
import './usb-pin-editor.css';

const colors={signal:'#208b87',input:'#477fc4',power:'#cb7b31',ground:'#65716d',reserved:'#a3a7a2'};
const kinds={signal:'Вхід / вихід',input:'Лише вхід',power:'Живлення',ground:'Земля',reserved:'Службовий'};
const actions=[
 {id:'write',icon:'⏻',title:'Увімкнути / вимкнути',detail:'Надіслати 1 або 0',type:'usb_pin_write'},
 {id:'pwm',icon:'◐',title:'Змінити яскравість',detail:'PWM · від 0 до 255',type:'usb_pin_pwm'},
 {id:'read',icon:'↙',title:'Прочитати сигнал',detail:'Якщо на піні 1 — виконати…',type:'usb_pin_read'},
 {id:'pullup',icon:'⊙',title:'Перевірити кнопку',detail:'Якщо натиснуто — виконати…',type:'usb_pin_button'},
 {id:'analog',icon:'∿',title:'Прочитати датчик',detail:'Запам’ятати число 0…4095',type:'usb_pin_analog'},
];

export function initPinEditor({workspace,notice}){
 const dialog=document.createElement('dialog');dialog.id='pinDialog';dialog.className='pin-dialog';
 dialog.setAttribute('aria-labelledby','pinDialogTitle');
 dialog.innerHTML=`<header class="pin-header"><div><span class="pin-eyebrow">ДОСЛІДЖУЙ І ПРОГРАМУЙ</span><h2 id="pinDialogTitle">Твоя ESP32 зблизька</h2><p>Обери контакт → додай дію → проший програму.</p></div><button class="pin-close" aria-label="Закрити розпіновку">×</button></header>
 <div class="pin-layout"><section class="pin-visual" aria-label="Повна розпіновка ESP32, 38 контактів"><div class="pin-view-tools"><span>38 контактів · вид з боку деталей</span><button id="pinFront">↺ Спереду</button><button id="pinBack">Зворотний бік</button></div><div id="pinStage" class="usb-pin-view"></div><div class="pin-legend"><span style="--dot:#208b87">Вхід / вихід</span><span style="--dot:#477fc4">Лише вхід</span><span style="--dot:#cb7b31">Живлення</span><span style="--dot:#a3a7a2">Службові</span></div><p class="pin-gesture">Обертай плату мишею. Натискай на контакт або його назву.</p></section>
 <section class="pin-inspector" aria-labelledby="pinName"><div class="pin-identity"><span id="pinSymbol">↗</span><div><span id="pinKind" class="pin-eyebrow"></span><h3 id="pinName"></h3></div></div><p id="pinDescription"></p><p id="pinWarning" class="pin-warning"></p><div id="pinActions" class="pin-actions" role="group" aria-label="Дія для контакту"></div><div id="pinSettings" class="pin-settings"></div><div id="pinPreview" class="pin-block-preview"></div><button id="addPinBlock" class="pin-add">＋ Додати до програми</button><p id="pinPlacement" class="pin-placement"></p><p class="pin-voltage">Сигнали GPIO: 0–3,3 В. Двигун підключай через драйвер.</p></section></div>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id),card=document.getElementById('openPinEditor');
 let selected=boardPins.find(p=>p.gpio===2),action='write',viewer=null,opening=false,anchorId=null;
 function selectPin(id){selected=boardPins.find(p=>p.id===id)||selected;const available=actions.filter(a=>supportsPin(selected.gpio,a.id));if(!available.some(a=>a.id===action))action=available[0]?.id;viewer?.select(selected.id);render();}
 function render(){
  $('pinKind').textContent=kinds[selected.kind]+(['SP','SN'].includes(selected.label)?` · на платі ${selected.label}`:'');$('pinName').textContent=selected.gpio===null?selected.label:`GPIO${selected.gpio}`;
  $('pinSymbol').textContent=selected.kind==='input'?'↙':selected.kind==='power'?'+':selected.kind==='ground'?'⏚':'↗';
  $('pinDescription').textContent=selected.description;$('pinWarning').textContent=selected.warning;$('pinWarning').hidden=!selected.warning;
  $('pinActions').replaceChildren();
  for(const a of actions.filter(a=>supportsPin(selected.gpio,a.id))){const b=document.createElement('button');b.type='button';b.className='pin-action';b.dataset.action=a.id;b.setAttribute('aria-pressed',String(a.id===action));b.innerHTML=`<span aria-hidden="true">${a.icon}</span><span><strong>${a.title}</strong><small>${a.detail}</small></span><span class="pin-radio" aria-hidden="true"></span>`;b.onclick=()=>{action=a.id;render();};$('pinActions').append(b);}
  $('pinSettings').replaceChildren();
  if(action==='write')$('pinSettings').innerHTML='<label>Стан піна <select id="pinState"><option value="ON">Увімкнути · 1</option><option value="OFF">Вимкнути · 0</option></select></label>';
  if(action==='pwm')$('pinSettings').innerHTML='<label for="pinDuty">Яскравість <output id="pinDutyValue">128 / 255</output></label><input id="pinDuty" type="range" min="0" max="255" step="1" value="128">';
  if(action==='pullup')$('pinSettings').innerHTML=`<div class="pin-wire"><b>GPIO${selected.gpio}</b><span>──</span><span>⊙<small>кнопка</small></span><span>──</span><b>GND</b></div>`;
  if(action==='analog')$('pinSettings').innerHTML='<p>Число з датчика збережемо у змінну. Його можна порівнювати або використовувати в обчисленнях.</p>';
  $('addPinBlock').hidden=!action;$('pinPreview').hidden=!action;$('pinPlacement').hidden=!action;
  $('pinPlacement').textContent='Додамо після вибраного блока або в кінець програми. Запуститься після «Прошити».';
  $('pinSettings').oninput=preview;preview();
 }
 function preview(){
  const pin=`GPIO${selected.gpio}`,duty=$('pinDuty')?.value||128;
  if($('pinDutyValue'))$('pinDutyValue').textContent=duty+' / 255';
  $('pinPreview').textContent=action==='write'?`пін ${pin} · ${$('pinState')?.value==='OFF'?'вимкнути':'увімкнути'}`:action==='pwm'?`пін ${pin} · яскравість ${duty}`:action==='analog'?`датчик ${pin} ← показ датчика`:`якщо ${action==='pullup'?`кнопку на ${pin} натиснуто`:`сигнал на ${pin} = 1`} → світлодіод увімкнути`;
 }
 function insertion(){
  let block=workspace.getBlockById(anchorId);
  while(block&&!block.previousConnection&&!block.nextConnection)block=block.getParent();
  if(!block)block=workspace.getTopBlocks(true).find(b=>b.type==='usb_start');
  if(!block){block=Blockly.serialization.blocks.append({type:'usb_start',x:40,y:35},workspace,{recordUndo:true});}
  // A forever block has no next connection: put the command in its body.
  if(block.nextConnection&&anchorId===block.id)return block.nextConnection;
  while(block.getNextBlock())block=block.getNextBlock();
  while(!block.nextConnection&&block.getInput('DO')){const input=block.getInput('DO');if(!input.connection.targetBlock())return input.connection;block=input.connection.targetBlock();while(block.getNextBlock())block=block.getNextBlock();}
  return block.nextConnection;
 }
 $('addPinBlock').onclick=()=>{
  if(!supportsPin(selected.gpio,action))return;
  Blockly.Events.setGroup(true);
  try{
   const connection=insertion();if(!connection){notice('Обери блок, після якого можна додати дію.');return;}
   const a=actions.find(a=>a.id===action),pinBlock={type:a.type,fields:{PIN:String(selected.gpio)}};let state=pinBlock;
   if(action==='write')pinBlock.fields.STATE=$('pinState').value;
   if(action==='pwm')pinBlock.inputs={DUTY:{shadow:{type:'math_number',fields:{NUM:Number($('pinDuty').value)}}}};
   if(['read','pullup'].includes(action))state={type:'controls_if',inputs:{IF0:{block:pinBlock},DO0:{block:{type:'usb_led',fields:{STATE:'ON'}}}}};
   if(action==='analog'){const name=`датчик GPIO${selected.gpio}`,variable=workspace.getVariableMap().getVariable(name)||workspace.getVariableMap().createVariable(name);state={type:'variables_set',fields:{VAR:{id:variable.getId()}},inputs:{VALUE:{block:pinBlock}}};}
   const next=connection.targetConnection;if(next)connection.disconnect();
   const created=Blockly.serialization.blocks.append(state,workspace,{recordUndo:true});connection.connect(created.previousConnection);if(next)created.nextConnection.connect(next);
   dialog.close();created.select();workspace.centerOnBlock(created.id);selectPin(selected.id);
   document.getElementById('boardPinSelection').textContent=`GPIO${selected.gpio} · ${a.title}`;
   notice(`Додано: ${a.title.toLowerCase()} · GPIO${selected.gpio}. Натисни «Прошити», щоб запустити.`);
  }finally{Blockly.Events.setGroup(false);}
 };
 card.onclick=async()=>{
  if(opening)return;anchorId=Blockly.common.getSelected()?.id||null;dialog.showModal();render();
  if(!viewer){opening=true;$('pinStage').textContent='Відкриваємо модель…';try{
   const {createModuleViewer}=await import('./assembly/module-viewer.js');$('pinStage').textContent='';
   const pins=boardPins.map(p=>({...p,name:p.id,label:p.label,role:kinds[p.kind],color:colors[p.kind],x:p.side==='left'?-12.7:12.7,y:22.86-p.row*2.54,z:1.2}));
   viewer=createModuleViewer($('pinStage'),{model:'esp32',pins},id=>{selectPin(id);if(matchMedia('(max-width:740px)').matches)dialog.querySelector('.pin-inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});});viewer.view('front');viewer.select(selected.id);
  }catch{$('pinStage').textContent='Модель не завантажилась. Обери контакт:';for(const p of boardPins){const b=document.createElement('button');b.className='pin-offline';b.textContent=p.label;b.onclick=()=>selectPin(p.id);$('pinStage').append(b);}}finally{opening=false;}}
  else viewer.select(selected.id);
 };
 $('pinFront').onclick=()=>viewer?.view('front');$('pinBack').onclick=()=>viewer?.view('back');
 dialog.querySelector('.pin-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 workspace.addChangeListener(e=>{
  if(e.type!==Blockly.Events.SELECTED&&e.type!==Blockly.Events.BLOCK_CHANGE)return;
  const b=workspace.getBlockById(e.newElementId||e.blockId);if(!b)return;
  const own=b.type==='usb_led'?2:b.getFieldValue('PIN');const nested=own==null?b.getDescendants(false).find(child=>child.getFieldValue('PIN')!==null):null;
  const value=own??nested?.getFieldValue('PIN');if(value==null)return;
  const p=boardPins.find(p=>p.gpio===Number(value));if(p){action=pinActions[(nested||b).type]||'write';selectPin(p.id);document.getElementById('boardPinSelection').textContent=`GPIO${p.gpio} · показати на платі ↗`;}
 });
}

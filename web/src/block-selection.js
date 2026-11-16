import {Blockly} from './blocks.js';
import {getParameterScope} from './my-block-parameters.js';
import {getMyBlocks} from './my-blocks.js';
import {copySelection,deleteSelection,selectionBlocks,groupEdit} from './block-selection-model.js';
import './block-selection.css';

let clipboard=null;
const controllers=new Set(),byWorkspace=new WeakMap();
const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],.blocklyWidgetDiv,.blocklyDropDownDiv');
const icons={select:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/>',paste:'<path d="M9 5H5v16h14V5h-4"/><rect x="9" y="3" width="6" height="4" rx="1"/>',duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4m10-5v6m-3-3h6"/>',delete:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',clear:'<path d="m6 6 12 12M6 18 18 6"/>'};
const svg=key=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[key]}</svg>`;

export function initBlockSelection(workspace,container,{notice=()=>{}}={}){
 const toolbar=document.createElement('div');toolbar.className='block-selection-tools';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Вибір і дії над блоками');
 const labels={select:'Вибрати кілька блоків',copy:'Копіювати',cut:'Вирізати',paste:'Вставити',duplicate:'Дублювати вибране',delete:'Видалити вибране',clear:'Скинути вибір'};
 const keys={select:'Shift + клік або рамка',copy:'Ctrl/⌘ C',cut:'Ctrl/⌘ X',paste:'Ctrl/⌘ V',duplicate:'Ctrl/⌘ D',delete:'Delete / Backspace',clear:'Esc'};
 for(const action of Object.keys(labels)){const b=document.createElement('button');b.type='button';b.dataset.selectionAction=action;b.title=`${labels[action]} · ${keys[action]}`;b.setAttribute('aria-label',labels[action]);b.innerHTML=svg(action)+(action==='select'?'<span>Вибрати</span>':'');toolbar.append(b);}
 const status=document.createElement('span');status.className='block-selection-status';status.setAttribute('aria-live','polite');toolbar.append(status);
 container.prepend(toolbar);
 const root=workspace.getParentSvg();let ids=new Set(),mode=false,marquee=null,disposed=false;const pasteCounts=new WeakMap();
 const button=action=>toolbar.querySelector(`[data-selection-action="${action}"]`);
 const active=()=>{const modal=document.querySelector('dialog[open]');return modal?modal.contains(container):!container.closest('dialog')&&container.getBoundingClientRect().height>0&&!document.querySelector('#connectionScreen:not([hidden])');};
 function refresh(){
  ids=new Set([...ids].filter(id=>workspace.getBlockById(id)));
  const all=selectionBlocks(workspace,ids);
  for(const b of workspace.getAllBlocks(false))b.getSvgRoot()?.classList.toggle('mcar-block-selected',all.has(b.id)&&!b.isShadow());
  const count=[...all].filter(id=>!workspace.getBlockById(id)?.isShadow()).length;
  status.textContent=count?`Вибрано: ${count}`:'';
  for(const action of ['copy','cut','duplicate','delete','clear']){button(action).disabled=!count;button(action).hidden=!count;}
  toolbar.classList.toggle('has-selection',!!count);
  button('paste').hidden=!clipboard?.length;
  button('paste').disabled=!clipboard?.length;button('select').setAttribute('aria-pressed',String(mode));
  root.classList.toggle('mcar-selection-mode',mode);
 }
 function clear(){ids.clear();refresh();}
 function copy(){const data=copySelection(workspace,ids);if(!data.length)return false;clipboard=data;for(const c of controllers)c.refresh();return true;}
 function paste(data=clipboard){
  if(!data?.length)return;
  const definitions=new Set(getMyBlocks(workspace).map(d=>d.id));
  function check(node){if(!node||typeof node!=='object')return;if(node.type==='my_block_call'&&!definitions.has(node.extraState?.definitionId))throw Error('Спочатку збережи визначення власного блоку, потім вставляй його тут.');if((node.type==='my_block_parameter'&&node.extraState?.definitionId!==getParameterScope(workspace)?.id)||(String(node.fields?.PIN).startsWith('param:')&&!getParameterScope(workspace)?.parameters?.some(p=>`param:${p.id}`===node.fields.PIN)))throw Error('Параметри належать своїй команді. Вставляй ці складові в її редакторі.');if(['usb_start','usb_remote'].includes(node.type)&&container.closest('.my-block-dialog'))throw Error('До власної команди вставляй складові без блоку початку.');for(const v of Object.values(node))check(v);}
  check(data);
  const count=(pasteCounts.get(data)||0)+1,offset=40*count;
  const minX=Math.min(...data.map(b=>b.x||0)),minY=Math.min(...data.map(b=>b.y||0));
  const view=workspace.getMetricsManager().getViewMetrics(true);
  const x=Math.max(view.left+20,Math.min(minX+offset,view.left+view.width/2)),y=Math.max(view.top+20,Math.min(minY+offset,view.top+view.height/2));
  const pasted=groupEdit(()=>data.map(state=>{
   const next=structuredClone(state);next.x=(next.x||0)-minX+x;next.y=(next.y||0)-minY+y;
   return Blockly.serialization.blocks.append(next,workspace,{recordUndo:true});
  }));
  pasteCounts.set(data,count);
  ids=new Set(pasted.flatMap(b=>b.getDescendants(false).filter(b=>!b.isShadow()).map(b=>b.id)));refresh();
 }
 function action(kind){
  try{
   if(kind==='select'){mode=!mode;refresh();return;}
   if(kind==='clear'){clear();return;}
   if(kind==='copy'){copy();return;}
   if(kind==='paste'){paste();return;}
   if(kind==='duplicate'){paste(copySelection(workspace,ids));return;}
   if(kind==='cut'&&!copy())return;
   if(kind==='cut'||kind==='delete'){groupEdit(()=>deleteSelection(workspace,ids));clear();}
  }catch(e){notice(e.message);}
 }
 toolbar.addEventListener('click',e=>{const a=e.target.closest('button')?.dataset.selectionAction;if(a)action(a);});
 function blockAt(target){const el=target.closest?.('[data-id]');const b=workspace.getBlockById(el?.getAttribute('data-id'));return b&&!b.isShadow()&&b.isDeletable()?b:null;}
 function down(e){
  if(e.button!==0||editable(e.target))return;
  if(e.target.closest('.blocklyFlyout')){clear();return;}
  if(e.target.closest('.blocklyToolbox,.blocklyScrollbarHandle,.blocklyZoom,.blocklyTrash'))return;
  const b=blockAt(e.target);
  if(mode||e.shiftKey){
   e.preventDefault();e.stopImmediatePropagation();
   if(b){ids.has(b.id)?ids.delete(b.id):ids.add(b.id);refresh();return;}
   const box=document.createElement('div');box.className='block-selection-marquee';document.body.append(box);
   // The rectangle must be in the modal top layer when editing a definition.
   (container.closest('dialog')||document.body).append(box);
   marquee={x:e.clientX,y:e.clientY,box,before:new Set(ids),pointer:e.pointerId};root.setPointerCapture(e.pointerId);return;
  }
  ids=b?new Set([b.id]):new Set();refresh();
 }
 function move(e){
  if(!marquee)return;e.preventDefault();e.stopImmediatePropagation();
  const left=Math.min(e.clientX,marquee.x),top=Math.min(e.clientY,marquee.y),right=Math.max(e.clientX,marquee.x),bottom=Math.max(e.clientY,marquee.y);
  Object.assign(marquee.box.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
  ids=new Set(marquee.before);
  for(const b of workspace.getAllBlocks(false)){
   if(b.isShadow()||!b.isDeletable())continue;
   const rect=b.getSvgRoot()?.querySelector(':scope > .blocklyPath')?.getBoundingClientRect();
   if(rect&&rect.left>=left&&rect.right<=right&&rect.top>=top&&rect.bottom<=bottom)ids.add(b.id);
  }
  refresh();
 }
 function end(e){if(!marquee)return;e.preventDefault();e.stopImmediatePropagation();marquee.box.remove();if(root.hasPointerCapture(marquee.pointer))root.releasePointerCapture(marquee.pointer);marquee=null;}
 function key(e){
  if(!active()||editable(e.target))return;
  const mod=e.ctrlKey||e.metaKey;let kind;
  if(mod&&!e.altKey){
   if(e.code==='KeyZ'||e.code==='KeyY'){e.preventDefault();e.stopImmediatePropagation();workspace.undo(e.code==='KeyY'||e.shiftKey);clear();return;}
   if(e.code==='KeyC'&&Blockly.getSelected()?.workspace?.isFlyout){clipboard=null;for(const c of controllers)c.refresh();return;}
   kind={KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyD:'duplicate'}[e.code];
   if(e.code==='KeyA'){e.preventDefault();e.stopImmediatePropagation();ids=new Set(workspace.getAllBlocks(false).filter(b=>b.isDeletable()&&!b.isShadow()).map(b=>b.id));refresh();return;}
  }
  if(!mod&&(e.key==='Delete'||e.key==='Backspace'))kind='delete';
  if(e.key==='Escape'&&(ids.size>1||mode||marquee)){
   e.preventDefault();e.stopImmediatePropagation();if(marquee){ids=marquee.before;end(e);}else{ids.clear();mode=false;}refresh();return;
  }
  if(kind&&(kind==='paste'?clipboard?.length:ids.size)){e.preventDefault();e.stopImmediatePropagation();action(kind);}
 }
 function changed(e){
  if(disposed)return;
  if(e.type===Blockly.Events.SELECTED&&ids.size<=1){const b=workspace.getBlockById(e.newElementId);if(b&&!b.isShadow()&&b.isDeletable())ids=new Set([b.id]);}
  refresh();
 }
 root.addEventListener('pointerdown',down,true);root.addEventListener('pointermove',move,true);root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',end,true);
 window.addEventListener('keydown',key,true);workspace.addChangeListener(changed);
 const controller={refresh,clear,action,groupFor:block=>ids.size>1&&selectionBlocks(workspace,ids).has(block?.id),dispose(){disposed=true;marquee?.box.remove();toolbar.remove();workspace.removeChangeListener(changed);window.removeEventListener('keydown',key,true);root.removeEventListener('pointerdown',down,true);root.removeEventListener('pointermove',move,true);root.removeEventListener('pointerup',end,true);root.removeEventListener('pointercancel',end,true);controllers.delete(controller);byWorkspace.delete(workspace);}};
 controllers.add(controller);byWorkspace.set(workspace,controller);refresh();Blockly.svgResize(workspace);return controller;
}

// Blockly's single-block menus must not silently act on just one member of a
// highlighted group. Keep the core entries unchanged in every other workspace.
for(const id of ['blockDuplicate','blockDelete']){
 const item=Blockly.ContextMenuRegistry.registry.getItem(id),original=item.preconditionFn;
 item.preconditionFn=scope=>byWorkspace.get(scope.block?.workspace)?.groupFor(scope.block)?'hidden':original(scope);
}
for(const [action,label] of Object.entries({copy:'Копіювати вибране',cut:'Вирізати вибране',duplicate:'Дублювати вибране',delete:'Видалити вибране'})){
 Blockly.ContextMenuRegistry.registry.register({id:`mcar_group_${action}`,scopeType:Blockly.ContextMenuRegistry.ScopeType.BLOCK,weight:2,displayText:label,
  preconditionFn:scope=>byWorkspace.get(scope.block?.workspace)?.groupFor(scope.block)?'enabled':'hidden',
  callback:scope=>byWorkspace.get(scope.block.workspace).action(action),
 });
}

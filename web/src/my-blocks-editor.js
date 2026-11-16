import {accordionPlugins} from './accordion-toolbox.js';
import {initBlockSelection} from './block-selection.js';
import {inheritWiring,registerWiredToolbox,openWiringFor} from './wiring-state.js';
import {Blockly} from './blocks.js';
import {getMyBlocks,setMyBlocks,changeMyBlocks,validateLibrary,callState,duplicateDefinition} from './my-blocks.js';
import {parameterKinds,parameterState,validateParameters,setParameterScope} from './my-block-parameters.js';
import {INPUT_PINS,pinOptions,OUTPUT_PINS,ANALOG_PINS,PULLUP_PINS,pinActions,scopedPinOptions} from './usb-pins.js';
import './my-blocks.css';

const editors=new WeakMap();
export const openMyBlockDefinition=(workspace,id)=>editors.get(workspace)?.edit(id,workspace);
const clone=value=>JSON.parse(JSON.stringify(value));
const selected=workspace=>{const b=Blockly.getSelected();return b?.workspace===workspace?b:null;};
const extractable=b=>b?.previousConnection&&!b.isShadow()&&b.type!=='my_block_call';

export function initMyBlocks({workspace,toolbox,notice=()=>{}}){
 const dialog=document.createElement('dialog');dialog.className='my-block-dialog';dialog.id='myBlockDialog';
 dialog.setAttribute('aria-labelledby','myBlockTitle');
 dialog.innerHTML=`<header class="my-block-header"><div><p class="my-block-eyebrow">МОЇ БЛОКИ</p><h2 id="myBlockTitle">Створи свою команду</h2></div><button type="button" data-cancel aria-label="Скасувати редагування">✕</button></header>
 <div class="my-block-tools"><button type="button" data-back hidden>← Назад</button><label>Назва команди <input id="myBlockName" maxlength="40" placeholder="Наприклад, лівий мотор вперед" autocomplete="off"></label><button type="button" data-duplicate-definition title="Створити незалежну копію цієї команди">⧉ Дублювати команду</button><button type="button" data-fit>Усі складові ↗</button></div>
 <details class="my-block-parameters"><summary>Параметри <span data-parameter-count></span></summary><div class="my-block-parameter-list"></div><button type="button" data-add-parameter>＋ Додати параметр</button><p>Число чи умову перетягни з «Параметри» у складові. GPIO обери у списку піна. Початкові значення — для нових викликів; у кожному виклику їх можна змінити.</p></details>
 <p class="my-block-tip">З’єднай команди під «виконати». Подвійний клік на власному блоці відкриває його складові.</p>
 <div id="myBlockCanvas"></div><p class="my-block-error" role="alert"></p>
 <footer><button type="button" data-delete>Видалити визначення</button><span class="my-block-spacer"></span><button type="button" data-cancel>Скасувати</button><button type="button" data-save class="my-block-primary">Зберегти блок</button></footer>`;
 document.body.append(dialog);
 const $=selector=>dialog.querySelector(selector),name=$('#myBlockName'),error=$('.my-block-error');
 let draft=[],variables=[],current=null,trail=[],editWorkspace=null,extracted=null,returnFocus=null,widgetParents=[],selection=null;
 const allowedToolbox=clone(toolbox);allowedToolbox.contents=allowedToolbox.contents.filter(c=>!['Початок','Телефон'].includes(c.name));
 allowedToolbox.contents.unshift({kind:'category',name:'Параметри',colour:'#b65b86',custom:'MCAR_PARAMETERS'});
 const report=e=>{error.textContent=e.message;};
 function flyout(ws){
  if(ws===editWorkspace)ws.registerToolboxCategoryCallback('MCAR_PARAMETERS',()=>current?.parameters?.length?current.parameters.map(p=>({kind:'block',...parameterState(current.id,p)})):[{kind:'label',text:'Додай параметри над полотном'}]);
  ws.registerToolboxCategoryCallback('MCAR_MY_BLOCKS',()=>[
   {kind:'button',text:'＋ Створити блок',callbackKey:'MCAR_CREATE'},
   ...getMyBlocks(ws).filter(d=>ws!==editWorkspace||d.id!==current?.id).map(d=>({kind:'block',...callState(d.id),gap:48})),
  ]);
  ws.registerButtonCallback('MCAR_CREATE',()=>{if(ws===editWorkspace){try{capture();createDraft();}catch(e){report(e);}}else open();});
  for(const def of getMyBlocks(ws)){ws.registerButtonCallback(`MCAR_EDIT_${def.id}`,()=>openDefinition(def.id,ws));ws.registerButtonCallback(`MCAR_DUPLICATE_${def.id}`,()=>duplicate(def.id,ws));}
 }
 function sync(){setParameterScope(editWorkspace,current);setMyBlocks(editWorkspace,draft);
  // Refresh cached dropdown labels after renaming a GPIO parameter, preserving
  // the selected stable ID and without adding synthetic field undo events.
  Blockly.Events.disable();try{for(const b of editWorkspace.getAllBlocks(false)){
   const action=pinActions[b.type],field=b.getField('PIN');if(!action||!String(field.getValue()).startsWith('param:'))continue;
   const value=field.getValue();field.setOptions(scopedPinOptions({write:OUTPUT_PINS,pwm:OUTPUT_PINS,read:INPUT_PINS,pullup:PULLUP_PINS,analog:ANALOG_PINS}[action]));field.setValue(value);
  }}finally{Blockly.Events.enable();}
 flyout(editWorkspace);editWorkspace.refreshToolboxSelection();}
 function parameterInUse(p){
  const state=Blockly.serialization.workspaces.save(editWorkspace);
  function uses(node){if(!node||typeof node!=='object')return false;
   if(node.type==='my_block_parameter'&&node.extraState?.definitionId===current.id&&node.extraState?.parameterId===p.id)return true;
   if(node.fields?.PIN===`param:${p.id}`)return true;
   if(node.type==='my_block_call'&&node.extraState?.definitionId===current.id)return true;
   return Object.values(node).some(uses);
  }
  return uses(state.blocks)||uses(Blockly.serialization.workspaces.save(workspace).blocks)||draft.some(d=>d.id!==current.id&&uses(d.body));
 }
 function renderParameters(){
  const list=$('.my-block-parameter-list');list.replaceChildren();
  const params=current.parameters||[];
  $('[data-parameter-count]').textContent=params.length?`· ${params.length}`:'';
  $('[data-add-parameter]').disabled=params.length>=6;
  for(const p of params){
   const row=document.createElement('div');row.className='my-block-parameter-row';row.dataset.parameterId=p.id;
   const label=document.createElement('input');label.value=p.name;label.maxLength=24;label.setAttribute('aria-label','Назва параметра');
   label.onchange=()=>{const before=p.name;p.name=label.value.trim();try{validateParameters(current);sync();remove.setAttribute('aria-label',`Видалити параметр ${p.name}`);error.textContent='';}catch(e){p.name=before;label.value=before;report(e);}};
   const kind=document.createElement('select');kind.setAttribute('aria-label','Тип параметра');
   for(const [value,text] of Object.entries(parameterKinds))kind.add(new Option(text,value));kind.value=p.kind;
   kind.onchange=()=>{if(parameterInUse(p)){kind.value=p.kind;report(Error('Спочатку прибери використання параметра та виклики цієї команди, щоб змінити його тип.'));return;}p.kind=kind.value;p.defaultValue=p.kind==='boolean'?true:p.kind==='pin'?2:0;sync();renderParameters();};
   const value=document.createElement(p.kind==='number'?'input':'select');value.setAttribute('aria-label','Початкове значення');
   if(p.kind==='number'){value.type='number';value.min='-1000000';value.max='1000000';value.step='any';value.value=p.defaultValue??0;}
   else{for(const [text,v] of p.kind==='pin'?pinOptions(INPUT_PINS):[['Так','true'],['Ні','false']])value.add(new Option(text,v));value.value=String(p.defaultValue??(p.kind==='pin'?2:true));}
   value.onchange=()=>{const before=p.defaultValue;p.defaultValue=p.kind==='boolean'?value.value==='true':Number(value.value);try{if(!value.value)throw Error('Задай початкове значення.');validateParameters(current);sync();error.textContent='';}catch(e){p.defaultValue=before;value.value=String(before);report(e);}};
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Видалити параметр ${p.name}`);
   remove.onclick=()=>{if(parameterInUse(p)){report(Error('Параметр використовується. Спочатку прибери його зі складових і виклики цієї команди.'));return;}current.parameters=params.filter(v=>v!==p);error.textContent='';sync();renderParameters();};
   row.append(label,kind,value,remove);list.append(row);
  }
 }
 $('[data-add-parameter]').onclick=()=>{
  current.parameters||=[];if(current.parameters.length>=6)return;
  let label='Значення',i=2;while(current.parameters.some(p=>p.name===label))label=`Значення ${i++}`;
  current.parameters.push({id:crypto.randomUUID(),name:label,kind:'number',defaultValue:0});sync();renderParameters();
  $('.my-block-parameter-list').lastElementChild.querySelector('input').focus();
 };
 function createDraft(){
  if(current)trail.push(current.id);
  let label='Моя команда',n=2;while(draft.some(d=>d.name===label))label=`Моя команда ${n++}`;
  current={id:crypto.randomUUID(),name:label,body:null};draft.push(current);render();name.focus();name.select();
 }
 function capture(){
  const label=name.value.trim();if(!label||label.length>40)throw Error('Назви команду — від 1 до 40 символів.');
  if(draft.some(d=>d.id!==current.id&&d.name.toLocaleLowerCase('uk')===label.toLocaleLowerCase('uk')))throw Error('Така назва вже є. Обери іншу.');
  const tops=editWorkspace.getTopBlocks(false),hat=tops.find(b=>b.type==='my_block_body');
  if(tops.length!==1||!hat)throw Error('З’єднай усі складові під «виконати».');
  const body=hat.getInputTargetBlock('DO');if(!body)throw Error('Додай хоча б одну команду під «виконати».');
  validateParameters(current);current.name=label;current.body=Blockly.serialization.blocks.save(body,{addCoordinates:false});
  variables=Blockly.serialization.workspaces.save(editWorkspace).variables||[];
 }
 function render(){
  selection?.clear();error.textContent='';name.value=current.name;$('#myBlockTitle').textContent=trail.length?'Складові твоєї команди':'Створи свою команду';
  $('[data-back]').hidden=!trail.length;
  setParameterScope(editWorkspace,current);renderParameters();$('.my-block-parameters').open=!!current.parameters?.length;
  Blockly.Events.disable();
  try{
   editWorkspace.clear();setMyBlocks(editWorkspace,[]);
   // Drafts may still be empty, so they aren't passed through the project loader.
   Blockly.serialization.workspaces.load({variables},editWorkspace);
   setMyBlocks(editWorkspace,draft);
   const hat=Blockly.serialization.blocks.append({type:'my_block_body',x:35,y:35,inputs:current.body?{DO:{block:clone(current.body)}}:{}},editWorkspace);
   hat.setFieldValue(current.name,'NAME');
   sync();
  }finally{Blockly.Events.enable();}
  editWorkspace.clearUndo();requestAnimationFrame(()=>{Blockly.svgResize(editWorkspace);editWorkspace.scrollCenter();});
 }
 function open(id=null,source=null){
  returnFocus=document.activeElement;extracted=source;draft=clone(getMyBlocks(workspace));variables=Blockly.serialization.workspaces.save(workspace).variables||[];trail=[];current=null;
  dialog.showModal();
  editWorkspace=Blockly.inject($('#myBlockCanvas'),{toolbox:allowedToolbox,plugins:accordionPlugins,theme:workspace.getTheme(),renderer:'zelos',media:import.meta.env.BASE_URL+'media/',sounds:false,trashcan:true,scrollbars:true,grid:{spacing:24,length:2,colour:'#e3e8df'},zoom:{controls:true,wheel:true,startScale:innerWidth<760?.65:1,minScale:.4,maxScale:1.8},move:{drag:true,wheel:true,scrollbars:true}});
  selection=initBlockSelection(editWorkspace,$('#myBlockCanvas'),{notice:message=>report(Error(message))});
  inheritWiring(editWorkspace,workspace);registerWiredToolbox(editWorkspace,ref=>openWiringFor(editWorkspace,ref));
  editors.set(editWorkspace,api);flyout(editWorkspace);
  // Native dialog is in the top layer; Blockly field editors must live there too.
  Blockly.WidgetDiv.createDom();Blockly.DropDownDiv.createDom();
  widgetParents=[Blockly.WidgetDiv.getDiv(),Blockly.DropDownDiv.getContentDiv().parentElement].map(el=>[el,el.parentNode]);
  widgetParents.forEach(([el])=>dialog.append(el));
  editWorkspace.getCanvas().addEventListener('dblclick',event=>doubleClick(event,editWorkspace));
  if(id){current=draft.find(d=>d.id===id);render();}else{createDraft();if(source){current.body=Blockly.serialization.blocks.save(source,{addCoordinates:false});render();}}
  name.focus();name.select();
 }
 function openDefinition(id,ws=workspace){
  if(ws===editWorkspace){try{capture();if(id===current.id)return;trail.push(current.id);current=draft.find(d=>d.id===id);render();}catch(e){report(e);}}
  else if(getMyBlocks(workspace).some(d=>d.id===id))open(id);
 }
 function doubleClick(event,ws){
  const block=ws.getBlockById(event.target.closest('[data-id]')?.getAttribute('data-id'))||selected(ws);
  if(block?.type==='my_block_call'){event.preventDefault();openDefinition(block.definitionId,ws);}
 }
 function duplicate(id=current?.id,ws=editWorkspace){
  try{
   if(ws!==editWorkspace)open(id);else capture();
   const original=draft.find(d=>d.id===id);
   const copy=duplicateDefinition(draft,original.id);
   trail=[];current=copy;draft.push(copy);render();name.focus();name.select();
  }catch(e){report(e);}
 }
 const api={open,edit:openDefinition,duplicate,extract:block=>open(null,block)};editors.set(workspace,api);flyout(workspace);
 workspace.addChangeListener(e=>{if(!e.isUiEvent){flyout(workspace);if(e.type==='mcar_my_blocks'||e.type===Blockly.Events.FINISHED_LOADING)workspace.refreshToolboxSelection();}});
 workspace.getCanvas().addEventListener('dblclick',event=>doubleClick(event,workspace));
 name.addEventListener('input',()=>{editWorkspace?.getTopBlocks().find(b=>b.type==='my_block_body')?.setFieldValue(name.value||'Моя команда','NAME');});
 $('[data-back]').onclick=()=>{try{capture();const parentId=trail.pop();current=draft.find(d=>d.id===parentId);render();}catch(e){report(e);}};
 $('[data-duplicate-definition]').onclick=()=>duplicate();
 $('[data-fit]').onclick=()=>{editWorkspace.zoomToFit();editWorkspace.scrollCenter();};
 $('[data-save]').onclick=()=>{
  try{
   capture();validateLibrary(draft);
   Blockly.Events.setGroup(true);
   try{
    // Library and extraction are one undoable edit, including any new variables.
    for(const v of variables){const existing=workspace.getVariableMap().getVariableById(v.id);if(existing){if(existing.name!==v.name)workspace.getVariableMap().renameVariableById(v.id,v.name);}else workspace.getVariableMap().createVariable(v.name,v.type,v.id);}
    changeMyBlocks(workspace,draft);
    if(extracted){
     const connection=extracted.previousConnection.targetConnection,xy=extracted.getRelativeToSurfaceXY();
     const definition=draft.find(d=>d.id===(trail[0]||current.id));
     extracted.dispose(false);
     const call=Blockly.serialization.blocks.append(callState(definition.id),workspace,{recordUndo:true});call.moveBy(xy.x,xy.y);
     if(connection)connection.connect(call.previousConnection);call.select();
    }
   }finally{Blockly.Events.setGroup(false);}
   dialog.close();notice('Власний блок збережено. Шукай його в «Мої блоки».');
  }catch(e){report(e);}
 };
 $('[data-delete]').onclick=()=>{
  const id=current.id;
  const usedInProgram=workspace.getAllBlocks().some(b=>b.type==='my_block_call'&&b.definitionId===id);
  const usedInDefinitions=draft.some(d=>d.id!==id&&JSON.stringify(d.body).includes(JSON.stringify(id)));
  if(usedInProgram||usedInDefinitions){error.textContent='Спочатку прибери використання цієї команди з програми та інших власних блоків.';return;}
  draft=draft.filter(d=>d.id!==id);
  if(trail.length){const parentId=trail.pop();current=draft.find(d=>d.id===parentId);render();}
  else{try{changeMyBlocks(workspace,draft);dialog.close();notice('Визначення блоку видалено. Дію можна скасувати.');}catch(e){report(e);}}
 };
 for(const button of dialog.querySelectorAll('[data-cancel]'))button.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{Blockly.WidgetDiv.hide();Blockly.DropDownDiv.hideWithoutAnimation();widgetParents.forEach(([el,parent])=>parent.append(el));widgetParents=[];selection?.dispose();selection=null;editWorkspace?.dispose();editWorkspace=null;returnFocus?.focus?.();});
 new ResizeObserver(()=>{if(dialog.open&&editWorkspace)Blockly.svgResize(editWorkspace);}).observe($('#myBlockCanvas'));
 // Always visible entry point, including touch screens without a context menu.
 const button=document.createElement('button');button.type='button';button.className='icon-button my-block-entry';button.textContent='＋ Мій блок';button.id='createMyBlock';button.onclick=()=>open();
 document.querySelector('.file-actions').append(button);
 return api;
}

Blockly.ContextMenuRegistry.registry.register({id:'mcar_extract_block',scopeType:Blockly.ContextMenuRegistry.ScopeType.BLOCK,weight:5,
 displayText:'Згорнути цю й наступні команди в мій блок',
 preconditionFn:scope=>extractable(scope.block)&&editors.has(scope.block.workspace)&&!scope.block.workspace.getTopBlocks().some(b=>b.type==='my_block_body')?'enabled':'hidden',
 callback:scope=>editors.get(scope.block.workspace).extract(scope.block),
});
Blockly.ContextMenuRegistry.registry.register({id:'mcar_edit_block',scopeType:Blockly.ContextMenuRegistry.ScopeType.BLOCK,weight:4,
 displayText:'Відкрити складові мого блоку',preconditionFn:scope=>scope.block?.type==='my_block_call'&&editors.has(scope.block.workspace)?'enabled':'hidden',
 callback:scope=>editors.get(scope.block.workspace).edit(scope.block.definitionId,scope.block.workspace),
});

Blockly.ContextMenuRegistry.registry.register({id:'mcar_duplicate_definition',scopeType:Blockly.ContextMenuRegistry.ScopeType.BLOCK,weight:5,
 displayText:'Створити копію цієї команди',preconditionFn:scope=>scope.block?.type==='my_block_call'&&editors.has(scope.block.workspace)?'enabled':'hidden',
 callback:scope=>editors.get(scope.block.workspace).duplicate(scope.block.definitionId,scope.block.workspace),
});

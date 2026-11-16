import {Blockly} from './blocks.js';
import {INPUT_PINS,pinOptions,pinActions,supportsPin,validatePinState} from './usb-pins.js';
import {parameterCheck,parameterInput,parameterDefault,validateParameters} from './my-block-parameters.js';

// Definitions belong to the project, not to any one call on the canvas.
const libraries=new WeakMap();
export const MY_BLOCKS_CATEGORY={kind:'category',name:'Мої блоки',colour:'#b65b86',custom:'MCAR_MY_BLOCKS'};
export const getMyBlocks=workspace=>libraries.get(workspace?.isFlyout?workspace.targetWorkspace:workspace)||[];
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(message,id)=>{const error=new Error(message);error.blockId=id;throw error;};

export function duplicateDefinition(definitions,id){
 const source=definitions.find(d=>d.id===id);
 if(!source)throw Error('Власний блок не знайдено.');
 if(definitions.length>=32)throw Error('Дозволено до 32 власних блоків.');
 const names=new Set(definitions.map(d=>d.name.toLocaleLowerCase('uk')));
 let name,n=1;
 do{const suffix=n===1?' — копія':` — копія ${n}`;name=source.name.slice(0,40-suffix.length)+suffix;n++;}while(names.has(name.toLocaleLowerCase('uk')));
 const body=clone(source.body),copyId=Blockly.utils.idGenerator.genUid();
 function stripIds(node){if(!node||typeof node!=='object')return;if(node.type&&Blockly.Blocks[node.type])delete node.id;if(node.type==='my_block_parameter'&&node.extraState?.definitionId===id)node.extraState.definitionId=copyId;for(const v of Object.values(node))stripIds(v);}
 stripIds(body);
 return {...clone(source),id:copyId,name,body};
}

export function validateLibrary(definitions){
 if(!Array.isArray(definitions)||definitions.length>32)fail('Дозволено до 32 власних блоків.');
 const ids=new Set(),names=new Set();let count=0;
 function inspect(node,depth=0){
  if(!node||typeof node!=='object')return;
  if(depth>80)fail('Власний блок надто вкладений.');
  if(node.type){
   if(typeof node.type!=='string'||!Blockly.Blocks[node.type])fail('Власний блок містить невідому команду.');
   if(['usb_start','usb_remote','robot_start','my_block_body'].includes(node.type))fail('У власному блоці потрібні команди без блоку початку.');
   if(++count>256)fail('Максимум 256 блоків у визначеннях.');
  }
  for(const child of Object.values(node))if(child&&typeof child==='object')inspect(child,depth+1);
 }
 for(const def of definitions){
  if(!def||typeof def.id!=='string'||!def.id||def.id.length>100||ids.has(def.id))fail('Власні блоки мають мати різні ідентифікатори.');
  if(typeof def.name!=='string'||!def.name.trim()||def.name.length>40||names.has(def.name.trim().toLocaleLowerCase('uk')))fail('Дай кожному блоку окрему назву — до 40 символів.');
  if(!def.body||typeof def.body!=='object'||typeof def.body.type!=='string')fail(`Додай команди до блоку «${def.name}».`);
  validateParameters(def);
  for(const p of def.parameters||[])if(p.kind==='pin'&&!INPUT_PINS.includes(p.defaultValue??2))fail('Обери доступний GPIO для параметра.');
  function references(node){if(!node||typeof node!=='object')return;if(node.type==='my_block_parameter'&&(node.extraState?.definitionId!==def.id||!def.parameters?.some(p=>p.id===node.extraState?.parameterId&&p.kind===node.extraState?.kind)))fail(`У команді «${def.name}» є параметр іншої або видаленої команди.`);for(const v of Object.values(node))references(v);}
  references(def.body);
  ids.add(def.id);names.add(def.name.trim().toLocaleLowerCase('uk'));inspect(def.body);
 }
 validatePinState({myBlocks:definitions});
 // Check even unused definitions, including indirect recursion.
 const byId=new Map(definitions.map(d=>[d.id,d])),heights=new Map();
 function visit(id,path=[]){
  if(path.includes(id))fail('Блок не може викликати сам себе, навіть через інший блок.');
  if(path.length>=8)fail('Можна вкладати власні блоки не більш ніж на 8 рівнів.');
  const def=byId.get(id);if(!def)fail('Власний блок не знайдено. Віднови його визначення.');
  if(heights.has(id))return heights.get(id);
  let height=1;
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='my_block_call')height=Math.max(height,1+visit(node.extraState?.definitionId,[...path,id]));for(const child of Object.values(node))if(child&&typeof child==='object')walk(child);}
  walk(def.body);if(height>8)fail('Можна вкладати власні блоки не більш ніж на 8 рівнів.');heights.set(id,height);return height;
 }
 for(const def of definitions)visit(def.id);
}

export function setMyBlocks(workspace,definitions){
 libraries.set(workspace,clone(definitions));
 for(const b of workspace.getAllBlocks(false))if(['my_block_call','my_block_parameter'].includes(b.type))b.refreshName();
 workspace.refreshToolboxSelection?.();
}
class LibraryChange extends Blockly.Events.Abstract {
 constructor(workspace,before,after){super();this.type='mcar_my_blocks';this.isBlank=!workspace;this.workspaceId=workspace?.id;this.before=before;this.after=after;}
 run(forward){setMyBlocks(this.getEventWorkspace_(),forward?this.after:this.before);}
 toJson(){return {...super.toJson(),before:this.before,after:this.after};}
 static fromJson(json,workspace){const e=new LibraryChange(workspace,json.before,json.after);e.group=json.group;return e;}
}
Blockly.registry.register(Blockly.registry.Type.EVENT,'mcar_my_blocks',LibraryChange);
export function changeMyBlocks(workspace,definitions){
 validateLibrary(definitions);
 const before=clone(getMyBlocks(workspace));setMyBlocks(workspace,definitions);
 Blockly.Events.fire(new LibraryChange(workspace,before,clone(definitions)));
}
Blockly.serialization.registry.register('myBlocks',{
 priority:90,
 save:workspace=>getMyBlocks(workspace).length?clone(getMyBlocks(workspace)):null,
 load:(state,workspace)=>{validateLibrary(state);setMyBlocks(workspace,state);},
 clear:workspace=>setMyBlocks(workspace,[]),
});
Blockly.Blocks.my_block_call={
 init(){this.appendDummyInput().appendField(new Blockly.FieldLabel('Мій блок'),'NAME');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour('#b65b86');this.setTooltip('Твоя команда. Подвійний клік відкриє її складові.');},
 saveExtraState(){return {definitionId:this.definitionId,parameterIds:(getMyBlocks(this.workspace).find(d=>d.id===this.definitionId)?.parameters||[]).map(p=>p.id)};},
 loadExtraState(state){this.definitionId=state?.definitionId;this.refreshName();},
 refreshName(){
  const def=getMyBlocks(this.workspace).find(d=>d.id===this.definitionId);
  this.setFieldValue(def?.name||'Блок не знайдено','NAME');
  const params=def?.parameters||[];
  for(const input of [...this.inputList])if(input.name.startsWith('ARG_')&&!params.some(p=>parameterInput(p.id)===input.name))this.removeInput(input.name);
  for(const p of params){
   const key=parameterInput(p.id);let input=this.getInput(key);
   if(!input){input=this.appendValueInput(key).setCheck(parameterCheck(p.kind)).appendField(p.name,`LABEL_${p.id}`);input.connection.setShadowState(parameterDefault(p));}
   else this.setFieldValue(p.name,`LABEL_${p.id}`);
  }
  this.setInputsInline(params.length<=2);
 },
};
Blockly.Blocks.my_block_pin={
 init(){this.appendDummyInput().appendField(new Blockly.FieldDropdown(pinOptions(INPUT_PINS)),'PIN');this.setOutput(true,'McarPin');this.setColour('#238b89');this.setTooltip('Пін для виклику власної команди.');},
};
Blockly.Blocks.my_block_parameter={
 init(){this.appendDummyInput().appendField(new Blockly.FieldLabel('Параметр'),'NAME');this.setOutput(true);this.setColour('#b65b86');},
 saveExtraState(){return this.parameter;},
 loadExtraState(state){this.parameter={...state};this.refreshName();},
 refreshName(){const s=this.parameter;if(!s)return;const p=getMyBlocks(this.workspace).find(d=>d.id===s.definitionId)?.parameters?.find(p=>p.id===s.parameterId);this.setFieldValue(p?.name||s.name||'Параметр','NAME');this.setOutput(true,parameterCheck(p?.kind||s.kind));},
};
Blockly.Blocks.my_block_body={
 init(){this.appendDummyInput().appendField(new Blockly.FieldLabel('Мій блок'),'NAME');this.appendStatementInput('DO').appendField('виконати');this.setColour('#b65b86');this.setDeletable(false);this.setMovable(false);},
};
export const callState=id=>({type:'my_block_call',extraState:{definitionId:id}});

// Inline calls at compile time: existing firmware executes the same primitives.
// Bound expansion independently of the small, saved definition graph.
export function withExpandedMyBlocks(workspace,compile){
 const definitions=getMyBlocks(workspace);
 if(!definitions.length&&!workspace.getAllBlocks(false).some(b=>b.type==='my_block_call'))return compile(workspace);
 validateLibrary(definitions);
 const state=Blockly.serialization.workspaces.save(workspace),byId=new Map(definitions.map(d=>[d.id,d])),origins=new Map();
 delete state.myBlocks;let count=0;
 const frames=new Map();
 function variableFor(depth,index){
  const key=`${depth}:${index}`;
  if(!frames.has(key)){
   const id=Blockly.utils.idGenerator.genUid(),name=`__argument_${id}`;
   frames.set(key,{id,name,type:''});
   state.variables=[...(state.variables||[]),frames.get(key)];
  }
  return frames.get(key);
 }
 function attach(head,tail){if(!head)return tail;let last=head;while(last.next?.block)last=last.next.block;if(tail)last.next={block:tail};return head;}
 function mark(node,origin){node.id=Blockly.utils.idGenerator.genUid();if(origin)origins.set(node.id,origin);return node;}
 function expand(node,path=[],origin,bindings=new Map()){
  if(!node)return null;
  if(++count>2048)fail('Після розгортання власних блоків програма завелика. Скороти повторні виклики.',origin||node.id);
  const next=node.next?.block;
  if(node.type==='my_block_parameter'){
   const s=node.extraState,binding=s?.definitionId===path.at(-1)&&bindings.get(s.parameterId);
   if(!binding)fail('Параметр можна використати лише всередині своєї команди.',origin||node.id);
   return mark(clone(binding),origin);
  }
  if(node.type==='my_block_call'){
   const id=node.extraState?.definitionId,def=byId.get(id),caller=origin||node.id;
   if(!def)fail('Власний блок не знайдено. Віднови його визначення.',caller);
   if(path.includes(id)||path.length>=8)fail('Перевір вкладення власних блоків: самовиклик заборонено, максимум 8 рівнів.',caller);
   if(node.disabledReasons?.length||node.enabled===false)return expand(next,path,origin,bindings);
   const locals=new Map();let prefix=null,slot=0;
   for(const p of def.parameters||[]){
    const input=node.inputs?.[parameterInput(p.id)],raw=input?.block||input?.shadow||(!node.extraState?.parameterIds?.includes(p.id)?parameterDefault(p):null);
    if(!raw)fail(`Задай параметр «${p.name}» у команді «${def.name}».`,caller);
    const rawKind=raw.type==='my_block_parameter'?byId.get(raw.extraState?.definitionId)?.parameters?.find(p=>p.id===raw.extraState?.parameterId)?.kind:
     raw.type==='my_block_pin'?'pin':['math_number','math_arithmetic','usb_pin_analog'].includes(raw.type)?'number':
     ['logic_boolean','logic_negate','logic_operation','logic_compare','usb_pin_read','usb_pin_button','wired_pin_read'].includes(raw.type)?'boolean':null;
    if(rawKind&&rawKind!==p.kind)fail(`Перевір тип параметра «${p.name}» у команді «${def.name}».`,caller);
    const value=expand(raw,path,caller,bindings);
    if(p.kind==='pin'){
     if(value.type!=='my_block_pin'||!INPUT_PINS.includes(Number(value.fields?.PIN)))fail(`Для «${p.name}» обери GPIO.`,caller);
     locals.set(p.id,value);
    }else{
     if(value.type==='my_block_pin')fail(`Перевір тип параметра «${p.name}».`,caller);
     const v=variableFor(path.length,slot++);
     const assign=mark({type:'variables_set',fields:{VAR:{id:v.id}},inputs:{VALUE:{block:value}}},caller);
     prefix=attach(prefix,assign);locals.set(p.id,{type:'variables_get',fields:{VAR:{id:v.id}}});
    }
   }
   const body=expand(def.body,[...path,id],caller,locals),tail=expand(next,path,origin,bindings);
   return attach(attach(prefix,body),tail);
  }
  const result=clone(node);delete result.next;delete result.x;delete result.y;
  if(origin)mark(result,origin);
  const pin=result.fields?.PIN;
  if(pinActions[result.type]&&typeof pin==='string'&&pin.startsWith('param:')){
   const value=bindings.get(pin.slice(6));
   if(value?.type!=='my_block_pin')fail('Обери параметр GPIO своєї команди.',origin||node.id);
   result.fields.PIN=value.fields.PIN;
   if(!supportsPin(Number(result.fields.PIN),pinActions[result.type]))fail(`GPIO${result.fields.PIN} не підтримує цю дію у власній команді. Обери інший пін.`,origin||node.id);
  }
  for(const input of Object.values(result.inputs||{}))for(const key of ['block','shadow'])if(input[key])input[key]=expand(input[key],path,origin,bindings);
  const expandedNext=expand(next,path,origin,bindings);if(expandedNext)result.next={block:expandedNext};return result;
 }
 state.blocks={...state.blocks,blocks:(state.blocks?.blocks||[]).map(b=>expand(b)).filter(Boolean)};
 const temp=new Blockly.Workspace();
 try{Blockly.serialization.workspaces.load(state,temp);return compile(temp);}
 catch(error){if(origins.has(error.blockId))error.blockId=origins.get(error.blockId);throw error;}
 finally{temp.dispose();}
}

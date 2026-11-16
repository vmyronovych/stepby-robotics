import {unavailableConnections,wrapWiringMessage} from './wiring-diagnostics.js';
import {Blockly} from './blocks.js';
import {emptyWiring,validateWiring,analyzeWiring} from './wiring-model.js';
const states=new WeakMap(),owners=new WeakMap(),openers=new WeakMap();
export const cloneWiring=value=>JSON.parse(JSON.stringify(value));
export function getWiring(workspace){if(workspace?.isFlyout)workspace=workspace.targetWorkspace;return owners.has(workspace)?getWiring(owners.get(workspace)):states.get(workspace)||emptyWiring();}
export function inheritWiring(workspace,owner){owners.set(workspace,owner);}
export function registerWiringOpener(workspace,open){openers.set(workspace,open);}
export function openWiringFor(workspace,ref){const owner=owners.get(workspace)||workspace;openers.get(owner)?.(ref,workspace);}
export const WIRED_CATEGORY={kind:'category',name:'Підключені піни',colour:'#238b89',custom:'MCAR_WIRED'};
export function setWiring(workspace,state){
 states.set(workspace,cloneWiring(state));
 for(const ws of [workspace,...Blockly.common.getAllWorkspaces().filter(w=>owners.get(w)===workspace)])for(const block of ws.getAllBlocks(false))if(block.type.startsWith('wired_pin_'))block.refreshWiring();
 workspace.refreshToolboxSelection?.();
}
class WiringChange extends Blockly.Events.Abstract{
 constructor(workspace,before,after){super();this.type='mcar_wiring';this.isBlank=!workspace;this.workspaceId=workspace?.id;this.before=before;this.after=after;}
 run(forward){setWiring(this.getEventWorkspace_(),forward?this.after:this.before);}
 toJson(){return {...super.toJson(),before:this.before,after:this.after};}
 static fromJson(json,workspace){const event=new WiringChange(workspace,json.before,json.after);event.group=json.group;return event;}
}
Blockly.registry.register(Blockly.registry.Type.EVENT,'mcar_wiring',WiringChange);
export function changeWiring(workspace,state){validateWiring(state);const before=cloneWiring(getWiring(workspace));setWiring(workspace,state);Blockly.Events.fire(new WiringChange(workspace,before,cloneWiring(state)));}
Blockly.serialization.registry.register('wiring',{
 priority:95,save:workspace=>getWiring(workspace).components.length?cloneWiring(getWiring(workspace)):null,
 load:(state,workspace)=>{validateWiring(state);setWiring(workspace,state);},clear:workspace=>setWiring(workspace,emptyWiring()),
});
export function wiredBlockState(ref,action='write'){
 return {type:`wired_pin_${action}`,extraState:{ref},...(action==='write'?{fields:{STATE:'OFF'}}:action==='pwm'?{inputs:{DUTY:{shadow:{type:'math_number',fields:{NUM:128}}}}}:{})};
}
for(const action of ['write','pwm','read'])Blockly.Blocks[`wired_pin_${action}`]={
 init(){
  this.appendDummyInput('LABEL').appendField('пін').appendField(new Blockly.FieldLabel('Підключення'),'LINK');
  if(action==='write')this.appendDummyInput().appendField(new Blockly.FieldDropdown([['увімкнути · 1','ON'],['вимкнути · 0','OFF']]),'STATE');
  if(action==='pwm'){this.appendValueInput('DUTY').setCheck('Number').appendField('ШІМ');this.appendDummyInput().appendField('/ 255');}
  if(action==='read'){this.appendDummyInput().appendField('= 1');this.setOutput(true,'Boolean');}
  else{this.setPreviousStatement(true);this.setNextStatement(true);}
  this.setInputsInline(true);this.setColour('#238b89');this.setTooltip('GPIO визначає провід у «Підключеннях». Контекстне меню відкриває цей контакт на схемі.');
 },
 saveExtraState(){return {ref:this.wiringRef};},
 loadExtraState(state){this.wiringRef=state?.ref;this.refreshWiring();},
 refreshWiring(){
  const binding=analyzeWiring(getWiring(this.workspace)).bindings.find(b=>b.ref===this.wiringRef);
  this.setFieldValue(binding?`${binding.label} · ${binding.gpio===null?'немає GPIO':`GPIO${binding.gpio}`}`:'Підключення видалено','LINK');
  this.setWarningText(binding?.available?null:'Віднови провід або обери інше підключення на схемі.');
 },
};
export function registerWiredToolbox(workspace,open){
 const callbacks=new Set();
 workspace.registerToolboxCategoryCallback('MCAR_WIRED',()=>{
  for(const key of callbacks)workspace.removeButtonCallback(key);callbacks.clear();
  const state=getWiring(workspace),analysis=analyzeWiring(state),bindings=analysis.bindings.filter(b=>b.available),unavailable=unavailableConnections(state,analysis);
  const label=text=>wrapWiringMessage(text).map(text=>({kind:'label',text,'web-class':'wiring-flyout-help',gap:4}));
  const action=(text,ref)=>{const key=`MCAR_WIRING_FIX_${callbacks.size}`;callbacks.add(key);workspace.registerButtonCallback(key,()=>open?.(ref));return {kind:'button',text,callbackKey:key};};
  const items=[{kind:'button',text:'↗ Відкрити підключення',callbackKey:'MCAR_OPEN_WIRING'},...bindings.flatMap(b=>(b.role==='fault'?['read']:['write','pwm']).map(action=>({kind:'block',...wiredBlockState(b.ref,action)})))];
  if(!bindings.length&&!unavailable.length)items.push(...label('З’єднай GPIO зі світлодіодом через резистор або з IN драйвера.'));
  for(const b of unavailable){items.push(...label(`${b.label}${b.connectedGpio===null?'':` → GPIO${b.connectedGpio}`}`));for(const message of b.messages)items.push(...label(message));items.push(action('Показати '+b.label,b.ref));}
  return items;
 });
 workspace.registerButtonCallback('MCAR_OPEN_WIRING',()=>open?.());
}
export function withResolvedWiring(workspace,compile){
 const state=Blockly.serialization.workspaces.save(workspace),wiring=getWiring(workspace),analysis=analyzeWiring(wiring);
 const fatal=analysis.issues.find(i=>i.severity==='error');if(fatal)throw Error(`Перевір підключення: ${fatal.message}`);
 const bindings=new Map(analysis.bindings.map(b=>[b.ref,b]));let changed=false;
 function walk(node){
  if(!node||typeof node!=='object')return;
  if(node.type?.startsWith('wired_pin_')){
   const binding=bindings.get(node.extraState?.ref),action=node.type.slice('wired_pin_'.length);
   if(!binding?.available||(action!=='read'&&binding.role==='fault')){const error=Error('Для цієї команди немає придатного GPIO. Відкрий «Підключення» та віднови провід.');error.blockId=node.id;throw error;}
   node.type=`usb_pin_${action}`;node.fields={...node.fields,PIN:String(binding.gpio)};delete node.fields.LINK;delete node.extraState;changed=true;
  }
  for(const [key,value]of Object.entries(node))if(key!=='wiring'&&value&&typeof value==='object')walk(value);
 }
 walk(state);if(!changed)return compile(workspace);
 delete state.wiring;
 const temp=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,temp);return compile(temp);}finally{temp.dispose();}
}

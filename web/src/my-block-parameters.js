// Editor scope is separate from the project library: parameters are local values.
const scopes=new WeakMap();
export const parameterKinds={number:'Число',boolean:'Умова',pin:'GPIO'};
export const parameterCheck=kind=>({number:'Number',boolean:'Boolean',pin:'McarPin'}[kind]);
export const parameterInput=id=>`ARG_${id}`;
export const setParameterScope=(workspace,definition)=>scopes.set(workspace,definition);
export const getParameterScope=workspace=>scopes.get(workspace?.isFlyout?workspace.targetWorkspace:workspace);
export const parameterState=(definitionId,p)=>({type:'my_block_parameter',extraState:{definitionId,parameterId:p.id,kind:p.kind,name:p.name}});
export const parameterDefault=p=>p.kind==='pin'?{type:'my_block_pin',fields:{PIN:String(p.defaultValue??2)}}:p.kind==='boolean'?{type:'logic_boolean',fields:{BOOL:p.defaultValue===false?'FALSE':'TRUE'}}:{type:'math_number',fields:{NUM:p.defaultValue??0}};
export function validateParameters(def){
 const params=def.parameters||[];
 if(!Array.isArray(params)||params.length>6)throw Error('У команді може бути до 6 параметрів.');
 const ids=new Set(),names=new Set();
 for(const p of params){
  if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id))throw Error('Параметри мають мати різні ідентифікатори.');
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>24||names.has(p.name.trim().toLocaleLowerCase('uk')))throw Error('Назви параметри по-різному — до 24 символів.');
  if(!Object.hasOwn(parameterKinds,p.kind))throw Error('Невідомий тип параметра.');
  if(p.defaultValue!==undefined&&(p.kind==='boolean'?typeof p.defaultValue!=='boolean':typeof p.defaultValue!=='number'||!Number.isFinite(p.defaultValue)||Math.abs(p.defaultValue)>1e6))throw Error('Перевір початкове значення параметра.');
  ids.add(p.id);names.add(p.name.trim().toLocaleLowerCase('uk'));
 }
}

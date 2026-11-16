import {Blockly} from './blocks.js';

// A selected command includes its input expressions/bodies, but not the next
// unselected command in its surrounding stack.
export function selectionBlocks(workspace,ids){
 const result=new Set();
 function include(block,withNext=false){
  if(!block)return;
  if(!result.has(block.id)){
   result.add(block.id);
   for(const input of block.inputList)include(input.connection?.targetBlock(),true);
  }
  if(withNext)include(block.getNextBlock(),true);
 }
 for(const id of ids){const b=workspace.getBlockById(id);if(b&&!b.isShadow()&&b.isDeletable())include(b);}
 return result;
}
export function selectionRoots(workspace,ids){
 const all=selectionBlocks(workspace,ids);
 return [...all].map(id=>workspace.getBlockById(id)).filter(b=>!all.has(b.getParent()?.id));
}
export function copySelection(workspace,ids){
 const all=selectionBlocks(workspace,ids);
 function save(b){
  const state=Blockly.serialization.blocks.save(b,{addCoordinates:true,addNextBlocks:false,saveIds:false});
  const next=b.getNextBlock();if(next&&all.has(next.id))state.next={block:save(next)};
  return state;
 }
 return selectionRoots(workspace,ids).map(save);
}
export function deleteSelection(workspace,ids){
 const all=selectionBlocks(workspace,ids);
 // dispose(true) reconnects the surviving commands on either side. Input
 // children disappear with their owner; skip IDs already disposed that way.
 for(const id of all){const b=workspace.getBlockById(id);if(b?.isDeletable()&&!b.isShadow())b.dispose(true);}
}
export function groupEdit(action){
 const previous=Blockly.Events.getGroup();Blockly.Events.setGroup(previous||true);
 try{return action();}finally{Blockly.Events.setGroup(previous);}
}

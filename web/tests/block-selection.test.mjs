import test from 'node:test';
import assert from 'node:assert/strict';
import {Blockly} from '../src/usb-blocks.js';
import {copySelection,deleteSelection,groupEdit,selectionBlocks} from '../src/block-selection-model.js';
import {duplicateDefinition} from '../src/my-blocks.js';
const pin=(id,n=16)=>({type:'usb_pin_write',id,fields:{PIN:String(n),STATE:'ON'}});
const chain=(...bs)=>bs.reduceRight((next,b)=>({...b,...next?{next:{block:next}}:{}}),null);
function workspace(body){const w=new Blockly.Workspace();Blockly.serialization.blocks.append({type:'usb_start',id:'start',next:{block:body}},w);return w;}
test('copies exactly selected consecutive commands, preserves order, and cuts without losing neighbours',()=>{
 const w=workspace(chain(pin('a'),pin('b',17),pin('c',18),pin('d',19)));
 try{
  const copied=copySelection(w,['b','c']);assert.equal(copied.length,1);assert.equal(copied[0].fields.PIN,'17');assert.equal(copied[0].next.block.fields.PIN,'18');assert.equal(copied[0].next.block.next,undefined);assert.equal(copied[0].id,undefined);
  groupEdit(()=>deleteSelection(w,['b','c']));assert.equal(w.getBlockById('a').getNextBlock().id,'d');assert.equal(w.getAllBlocks().length,3);
 }finally{w.dispose();}
});
test('selected containers include their body once, without the following unselected stack',()=>{
 const w=workspace(chain({type:'controls_repeat_ext',id:'loop',inputs:{DO:{block:chain(pin('a'),pin('b'))}}},pin('tail')));
 try{
  assert.deepEqual([...selectionBlocks(w,['a','loop'])].sort(),[...selectionBlocks(w,['loop','a'])].sort());
  const copied=copySelection(w,['loop','a']);assert.equal(copied.length,1);assert.equal(copied[0].inputs.DO.block.next.block.fields.PIN,'16');assert.equal(copied[0].next,undefined);
  deleteSelection(w,['loop','a']);assert.equal(w.getBlockById('start').getNextBlock().id,'tail');
 }finally{w.dispose();}
});
test('disjoint selections stay separate and protected definition hats cannot be deleted',()=>{
 const w=workspace(chain(pin('a'),pin('b'),pin('c')));
 try{assert.equal(copySelection(w,['a','c']).length,2);Blockly.serialization.blocks.append({type:'my_block_body',id:'hat'},w);deleteSelection(w,['hat']);assert.ok(w.getBlockById('hat'));}finally{w.dispose();}
});
test('definition duplication is independent, uniquely named, and preserves nested calls and variable IDs',()=>{
 const source={id:'source',name:'А'.repeat(40),body:{...pin('old'),next:{block:{type:'my_block_call',id:'call',extraState:{definitionId:'nested'}}}}};
 const copy=duplicateDefinition([source],'source');assert.notEqual(copy.id,source.id);assert.equal(copy.name.length,40);assert.equal(copy.body.id,undefined);assert.equal(copy.body.next.block.id,undefined);assert.equal(copy.body.next.block.extraState.definitionId,'nested');copy.body.fields.PIN='25';assert.equal(source.body.fields.PIN,'16');assert.notEqual(duplicateDefinition([source,copy],'source').name,copy.name);
});
test('copying variable blocks carries variable metadata into another workspace',()=>{
 const a=new Blockly.Workspace(),b=new Blockly.Workspace();
 try{
  a.getVariableMap().createVariable('Швидкість','','speed');
  const block=Blockly.serialization.blocks.append({type:'variables_set',fields:{VAR:{id:'speed'}},inputs:{VALUE:{shadow:{type:'math_number',fields:{NUM:128}}}}},a);
  const [state]=copySelection(a,[block.id]);const pasted=Blockly.serialization.blocks.append(state,b);
  assert.equal(b.getVariableMap().getVariableById(pasted.getFieldValue('VAR')).name,'Швидкість');assert.equal(pasted.getInputTargetBlock('VALUE').getFieldValue('NUM'),128);
 }finally{a.dispose();b.dispose();}
});

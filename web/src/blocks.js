import * as Core from 'blockly/core';
const Blockly = Reflect.get(Core, 'default') ?? Core;
import 'blockly/blocks';
import * as Uk from 'blockly/msg/uk';
Blockly.setLocale(Uk);
// Keep the serialized wait block ID so existing USB projects remain compatible.
export const num=n=>({shadow:{type:'math_number',fields:{NUM:n}}});
Blockly.common.defineBlocksWithJsonArray([
 {type:'robot_wait',message0:'чекати %1 секунд',args0:[{type:'input_value',name:'TIME',check:'Number'}],colour:'#C98B21',previousStatement:null,nextStatement:null,inputsInline:true},
]);
export {Blockly};

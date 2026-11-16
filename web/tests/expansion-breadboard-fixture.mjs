import {HW627_PINS} from '../src/assembly/hw627.js';
export function expansionBreadboard(){return {version:1,components:[
 {id:'esp',kind:'esp32',name:'ESP32',x:80,y:40,expansion:'esp32s-38p',signalsVerified:false},
 {id:'bb',kind:'breadboard',name:'Mini breadboard',x:100,y:520},
 {id:'drv',kind:'driver',name:'DRV8833',x:0,y:0,rotation:270,breadboardMount:{boardId:'bb',holes:Object.fromEntries(HW627_PINS.map(p=>[p.name,`${p.side==='right'?'C':'G'}${p.row+1}`]))}},
 ],wires:[{id:'w34',a:'esp:exp-bottom-S-3',b:'bb:A1',color:'#328f83'},{id:'w35',a:'esp:exp-bottom-S-4',b:'bb:A2',color:'#e8cc36'}],checked:[]};}

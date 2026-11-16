import {physicalLayout} from '../src/wiring-physical.js';
export function driverBreadboard(){
 const board={id:'bb',kind:'breadboard',name:'Mini breadboard',x:360,y:230};
 const driver={id:'drv',kind:'driver',name:'DRV8833',x:0,y:0,rotation:90};
 const p=physicalLayout(driver).points.get('SLEEP'),h=physicalLayout(board).points.get('B10');driver.x=board.x+h.x-p.x;driver.y=board.y+h.y-p.y;
 return {version:1,components:[board,driver],wires:[],checked:[]};
}

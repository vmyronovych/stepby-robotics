import {HW627,HW627_PINS} from './assembly/hw627.js';
import {BREADBOARD,BREADBOARD_PINS} from './breadboard.js';
import {PART_LAYOUTS} from './teaching-parts.js';
import {MOTOR_CONTACTS} from './assembly/motor-contacts.js';
import {ports} from './wiring-model.js';
import {EXPANSION_PINS} from './assembly/board-layouts.js';

export const EXPANSION='esp32s-38p';
export const mounted=c=>c.kind==='esp32'&&c.expansion===EXPANSION;
export const motorPins=MOTOR_CONTACTS.map((p,i)=>({name:i?'B':'A',...p}));
const header=0;
// The same orthographic bounds drive both the rendered model and hit targets.
// No separately estimated image percentages or side-of-card terminal lists.
function baseLayout(c){
 let bounds,unit;
 if(c.kind==='breadboard'){bounds=[0,BREADBOARD.width,0,BREADBOARD.height];unit=1.8;}
 else if(PART_LAYOUTS[c.kind]){const p=PART_LAYOUTS[c.kind];bounds=[0,p.width,0,p.height];unit=1.2;}
 else if(mounted(c)||c.kind==='expansion'){bounds=[-46,46,-34,34];unit=6;}
 else if(c.kind==='esp32'){bounds=[-16.5,16.5,-31,31];unit=8;}
 else if(c.kind==='driver'){bounds=[-10.5,10.5,-10.5,10.5];unit=12*1.8/HW627.pinPitch;}
 else if(c.kind==='motor'){bounds=[-41,29,-12,16];unit=4.8;}
 else{bounds=[0,220,0,200];unit=1.2;}
 const [left,right,bottom,top]=bounds,width=(right-left)*unit,imageHeight=(top-bottom)*unit;
 const project=(x,y)=>({x:(x-left)*unit,y:header+(top-y)*unit});
 const points=new Map();
 for(const p of ports(c)){
  let x,y,side=p.side;
  if(c.kind==='breadboard'){({x,y,side}=BREADBOARD_PINS.find(n=>n.id===p.id));}
  else if(PART_LAYOUTS[c.kind]){({x,y,side}=PART_LAYOUTS[c.kind].pins[p.id]);}
  else if(c.kind==='esp32'){
   if(p.id.startsWith('exp-')){const actual=EXPANSION_PINS.find(e=>e.name===p.id.slice(4));x=actual.x;y=actual.y;side=y>0?'top':'bottom';}
   else{
    x=p.id==='USB'?0:p.side==='left'?-12.7:12.7;y=p.id==='USB'?-28:22.86-p.row*2.54;
    if(mounted(c)){[x,y]=[-y-8.14,x];side=p.id==='USB'?'right':p.side==='left'?'bottom':'top';}
    else if(p.id==='USB')side='bottom';
   }
  }else if(c.kind==='driver'){({x,y}=HW627_PINS.find(pin=>pin.name===p.id));}
  else if(c.kind==='motor'){({x,y}=motorPins.find(n=>n.name===p.id));side='left';}
  else if(c.kind==='battery'){x=p.id==='PLUS'?55:165;y=16;side='bottom';}
  else if(c.kind==='usb'){x=172;y=24;side='right';}
  else{
   const actual=EXPANSION_PINS.find(e=>e.name===p.id)||EXPANSION_PINS.find(e=>p.id==='G'?e.group==='Ряд G':p.id==='V'?e.group==='Ряд V':e.group==='Ряд S'&&e.label.split(' · ')[0]===p.label.replace('S · ',''));
   x=actual?.x??-31;y=actual?.y??20;side=y>0?'top':'bottom';
  }
  points.set(p.id,{...project(x,y),world:{x,y,z:c.kind==='motor'?5:p.id.startsWith('exp-')?4:mounted(c)?8.2:1.2},side,size:c.kind==='breadboard'?13:c.kind==='driver'?18:c.kind==='esp32'?mounted(c)?10:15:14});
 }
 return {width,height:header+imageHeight,imageHeight,header,bounds,points,project};
}

// Rotate the physical body; pin labels stay upright.
export function physicalLayout(c){
 const base=baseLayout(c),rotation=c.rotation??0,turns=rotation/90;
 const w=base.width,h=base.imageHeight;
 const rotate=(x,y)=>rotation===90?{x:h-y,y:x}:rotation===180?{x:w-x,y:h-y}:rotation===270?{x:y,y:w-x}:{x,y};
 const project=(x,y)=>{const p=base.project(x,y),q=rotate(p.x,p.y-header);return {x:q.x,y:q.y+header};};
 const sides=['top','right','bottom','left'];
 const points=new Map([...base.points].map(([id,p])=>{const q=rotate(p.x,p.y-header);return [id,{...p,x:q.x,y:q.y+header,side:sides[(sides.indexOf(p.side)+turns)%4]}];}));
 const width=turns%2?h:w,imageHeight=turns%2?w:h;
 const imageTransform={0:'none',90:`translate(${h}px, 0) rotate(90deg)`,180:`translate(${w}px, ${h}px) rotate(180deg)`,270:`translate(0, ${w}px) rotate(270deg)`}[rotation];
 return {...base,width,imageHeight,height:header+imageHeight,points,project,imageWidth:w,imageOriginalHeight:h,imageTransform};
}

import {EXPANSION_JUMPER,jumperCenter} from './expansion-jumper.js';
import * as THREE from 'three';
import {ESP_PINS,EXPANSION_PINS} from './board-layouts.js';

function builder(labels){
 const root=new THREE.Group(),contacts=new Map(),hitTargets=[];
 const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.32:.65});
 const metal=mat('#b9c4cd',.8),black=mat('#171b20'),yellow=mat('#e5cf46'),white=mat('#eeeedd');
 function box(x,y,z,w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);root.add(o);return o;}
 function cylinder(x,y,z,r,h,m,axis='z'){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;o.position.set(x,y,z);root.add(o);return o;}
 function text(s,x,y,z,w=8,h=1.5,back=false,tight=false){if(!labels)return;const c=document.createElement('canvas');c.width=tight?s.length*30+12:512;c.height=80;const ctx=c.getContext('2d');if(!ctx)return;ctx.font='bold 48px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e5e7df';ctx.fillText(s,c.width/2,40);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}));o.position.set(x,y,z);if(back)o.rotation.y=Math.PI;root.add(o);}
 function board(w,h,color,holes=[]){const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();for(const [x,y,r]of holes){const hole=new THREE.Path();hole.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(hole);}const o=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:16}),mat(color));root.add(o);return o;}
 function contact(p,{socket=false,male=false,bare=false}={}){
  const {x,y,z=1.15}=p;
  if(socket){box(x,y,2,2.45,2.45,2,yellow);box(x,y,3.03,.95,.95,.08,black);}
  else if(male){box(x,y,1.8,2.45,2.45,1.6,p.group==='Ряд G'||p.name.startsWith('aux-')?black:p.group==='Ряд V'?mat('#b34337'):yellow);box(x,y,4,.55,.55,4,metal);}
  else if(!bare){cylinder(x,y,1.1,.7,.15,metal);box(x,y,-1.1,2.45,2.45,2,yellow);box(x,y,-3.3,.55,.55,5,metal);}
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1,.2,8,24),new THREE.MeshBasicMaterial({color:p.color||'#f4c653',depthTest:false}));halo.position.set(x,y,z+.1);halo.visible=false;halo.renderOrder=4;root.add(halo);
  const hit=new THREE.Mesh(new THREE.SphereGeometry(1.12,10,8),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(x,y,z);hit.userData.pin=p.name;root.add(hit);hitTargets.push(hit);contacts.set(p.name,{...p,halo,group:hit});
 }
 return {root,contacts,hitTargets,mat,metal,black,yellow,white,box,cylinder,text,board,contact};
}
export function createESP32Model({labels=true}={}){
 const b=builder(labels),{box,text,metal,black}=b;
 b.board(29,57,'#152022',[[-12,26,1.2],[12,26,1.2],[-12,-26,1.2],[12,-26,1.2]]);
 for(const p of ESP_PINS){b.contact(p);text(p.label.replace('GPIO','G'),p.x-Math.sign(p.x)*2.6,p.y,1.13,3,1);}
 box(0,8,1.8,18,24,1.6,b.mat('#3e483e'));box(0,6,2.9,17,18,1.4,metal);
 text('ESP-32',0,9,3.65,12,2.5);text('WiFi + BT',0,5,3.65,11,1.3);text('ESPRESSIF',0,2,3.65,12,1.2);
 box(0,23,1.3,18,9,.5,black);
 for(let i=0;i<5;i++){box(-7+i*3,23,1.61,.45,7,.05,b.mat('#64705b'));box(-5.5+i*3,26-(i%2)*6,1.61,3,.45,.05,b.mat('#64705b'));}
 box(0,-12,1.7,6,6,1.2,black);for(let i=0;i<7;i++)for(const s of [-1,1])box(s*3.2,-14.4+i*.8,1.5,.8,.4,.3,metal);
 box(4,-20,2,5,5,1.8,black);for(let i=0;i<3;i++)box(7,-21.7+i*1.6,1.4,1.5,.7,.5,metal);
 box(0,-25.3,2.5,8,6,3,metal);box(0,-28.35,2.4,6,.1,1.6,black);box(0,-28.4,2.2,4,.15,.3,b.mat('#cbae54',.7));
 for(const x of [-9,9]){box(x,-23.8,1.8,3.4,3.4,1.5,metal);b.cylinder(x,-23.8,2.8,1.2,.7,black);text(x<0?'EN':'BOOT',x,-20.7,1.1,4,1);}
 for(let i=0;i<7;i++){box(-8+i*2.5,-6,1.4,1.2,2,.6,metal);box(-8+i*2.5,-6,1.75,.8,1.2,.15,black);}
 for(let i=0;i<5;i++)box(-8,-10-i*1.8,1.5,1.3,.9,.7,b.mat('#b7a77e'));
 return b;
}
export function createExpansionModel({labels=true,jumperVoltage=5,drawJumper=true}={}){
 const b=builder(labels),{box,text,metal,black}=b;
 b.board(86,61,'#602879',[[-39,26,1.9],[25,26,1.9],[-39,-26,1.9],[25,-26,1.9]]);
 for(const p of EXPANSION_PINS){b.contact(p,{socket:p.group==='Гнізда ESP32',male:p.group!=='Гнізда ESP32'});if(p.name.startsWith('socket-top-')||p.name.startsWith('socket-bottom-'))text(p.label.split(' · ')[0].replace('GPIO','P'),p.x,p.y-Math.sign(p.y)*3.2,1.12,2.2,.8);}
 for(const p of EXPANSION_PINS.filter(p=>/^top-S-|^bottom-S-/.test(p.name)))text(p.label.split(' · ')[0].replace('GPIO','P'),p.x,Math.sign(p.y)*17.2,1.12,2.2,.8);
 for(const p of EXPANSION_PINS.filter(p=>p.name.startsWith('aux-')))text(p.label,p.x,p.y+(p.name.startsWith('aux-top-')?2.3:-2.3),1.12,2.3,.8);
 text('ESP32S 38P Expansion board',-7,2,1.08,47,2.5);
 text('S  V  G',-37,22.5,1.08,4,1.4);text('S  V  G',-37,-22.5,1.08,4,1.4);
 text('DC6.5–16V',34,17,1.08,13,1.6);text('USB5V',35,-25,1.08,12,1.5);
 box(34,23,5,14,11,8,black);b.cylinder(41,23,5,3.5,1,metal,'x');b.cylinder(41.6,23,5,2.8,1,black,'x');
 for(const [y,w]of [[10,7],[-17,9]]){box(40,y,2.6,7,w,3,metal);box(43.6,y,2.6,.12,w-2,1.6,black);}
 for(const y of [13,2]){b.cylinder(25,y,4.5,3.6,7,black);b.cylinder(25,y,8.1,3.45,.2,metal);text('47',25,y,8.24,5,2);}
 box(31,-5,2.2,6,7,2.3,black);box(27.5,-5,1.4,2,6,.6,metal);for(let i=0;i<3;i++)box(35,-7+i*2,1.7,3,.9,.6,metal);
 if(drawJumper){
 // Photo: three vertical posts (3.3V / V / 5V), yellow shunt on V–5V.
 const {x:jumperX,top:jumperTop}=EXPANSION_JUMPER;
 const jumperBase=box(jumperX,jumperTop-2.54,1.8,2.45,7.53,1.6,black);jumperBase.name='expansion-jumper-base';
 for(let i=0;i<3;i++){const post=box(jumperX,jumperTop-i*2.54,4,.55,.55,4,metal);post.name=`expansion-jumper-post-${i}`;}
 const capY=jumperCenter({jumperVoltage}).y;
 // Open shunt housing: two yellow walls and end bridges, visible dark recess.
 const shunt=new THREE.Group();shunt.name='expansion-jumper-shunt';shunt.userData.voltage=jumperVoltage;b.root.add(shunt);
 for(const [x,y,w,h]of [[jumperX-1.1,capY,.7,5.3],[jumperX+1.1,capY,.7,5.3],[jumperX,capY-2.3,1.5,.7],[jumperX,capY+2.3,1.5,.7]]){const wall=box(x,y,4,w,h,3.8,b.yellow);shunt.add(wall);}
 const bridge=box(jumperX,capY,3.8,.9,3.3,.35,metal);shunt.add(bridge);
 for(const [i,label]of ['3.3V','V','5V'].entries())text(label,jumperX-3.8,jumperTop-i*2.54,1.12,4.5,1.4,false,true);
 text('JUMP',jumperX,jumperTop-8.41,1.12,6,1.4,false,true);
 }
 for(let i=0;i<4;i++)box(22+i*3,-1,1.6,1,2,.9,metal);
 return b;
}
export function createMotorModel({labels=true,pins=[]}={}){
 const b=builder(labels),{box,metal,black}=b;
 const yellow=b.mat('#f1cf25');
 box(8,2,5,27,20,10,yellow);box(-9,2,5,10,17,10,yellow);
 b.cylinder(-21,2,5,7,15,metal,'x');b.cylinder(-29,2,5,6.5,2,black,'x');
 b.cylinder(14,0,14,2.5,9,b.white);box(14,0,18.6,4,3,.25,b.white);
 box(23,6,5,3,4,5,yellow);
 for(const y of [-5,9]){b.cylinder(-2,y,10.1,1.1,.12,black);b.cylinder(19,y,10.1,.8,.12,black);}
 for(const [i,p] of pins.entries()){
  const lead=new THREE.LineCurve3(new THREE.Vector3(-29,p.y,p.z),new THREE.Vector3(p.x+1.5,p.y,p.z));
  const wire=new THREE.Mesh(new THREE.TubeGeometry(lead,1,.65,8,false),b.mat(i?'#25292b':'#ba413f'));b.root.add(wire);
  box(p.x,p.y,p.z,3,1,.8,metal);b.contact(p,{bare:true}); // Clickable cable ends, not a permanent +/− assignment.
 }
 return b;
}

// ESP32 seated in the narrow 38-pin sockets, antenna pointing left.
export function createMountedESP32Model(options={}){
 const base=createExpansionModel(options),controller=createESP32Model(options);
 controller.root.rotation.z=Math.PI/2;controller.root.position.set(-8.14,0,7);
 base.root.add(controller.root);
 for(const [id,contact] of controller.contacts)base.contacts.set(id,contact);
 base.hitTargets.push(...controller.hitTargets);
 return base;
}

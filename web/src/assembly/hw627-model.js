import * as THREE from 'three';
import {HW627,HW627_PINS} from './hw627.js';

// Reconstructed surfaces, component placement and markings from the supplied
// component-side photo. No photograph is used as a flat stand-in for the board.
export function createHW627Model({labels=true}={}){
 const root=new THREE.Group(),contacts=new Map(),hitTargets=[];
 const pcb=new THREE.MeshStandardMaterial({color:'#171d20',roughness:.62,metalness:.12});
 const metal=new THREE.MeshStandardMaterial({color:'#bcc4ca',metalness:.82,roughness:.27});
 const black=new THREE.MeshStandardMaterial({color:'#25262a',roughness:.8});
 const ceramic=new THREE.MeshStandardMaterial({color:'#b4a58b',roughness:.8});
 const gold=new THREE.MeshStandardMaterial({color:'#cead60',metalness:.64,roughness:.42});
 function box(x,y,z,w,h,d,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);root.add(mesh);return mesh;}
 const outline=new THREE.Shape();const w=HW627.width/2,h=HW627.height/2;
 outline.moveTo(-w,-h);outline.lineTo(w,-h);outline.lineTo(w,h);outline.lineTo(-w,h);outline.closePath();
 for(const p of HW627_PINS){const hole=new THREE.Path();hole.absarc(p.x,p.y,.43,0,Math.PI*2,true);outline.holes.push(hole);}
 const board=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:HW627.thickness,bevelEnabled:false,curveSegments:16}),[pcb,new THREE.MeshStandardMaterial({color:'#5a5136',roughness:.9})]);root.add(board);
 for(const p of HW627_PINS){
  const group=new THREE.Group();group.position.set(p.x,p.y,0);root.add(group);
  for(const z of [HW627.thickness+.025,-.025]){
   const pad=new THREE.Mesh(new THREE.RingGeometry(.44,.82,8),metal);pad.position.z=z;if(z<0)pad.rotation.x=Math.PI;group.add(pad);
   const rim=new THREE.Mesh(new THREE.TorusGeometry(.51,.075,6,24),gold);rim.position.z=z;group.add(rim);
  }
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,HW627.thickness,20,1,true),metal);sleeve.rotation.x=Math.PI/2;sleeve.position.z=HW627.thickness/2;group.add(sleeve);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.88,.14,8,32),new THREE.MeshBasicMaterial({color:'#f8c758',transparent:true,opacity:.95,depthTest:false}));halo.position.z=HW627.thickness+.08;halo.visible=false;halo.renderOrder=4;group.add(halo);
  const hit=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({visible:false}));hit.position.z=.35;hit.userData.pin=p.name;group.add(hit);hitTargets.push(hit);
  contacts.set(p.name,{...p,group,halo});
 }
 // HTSSOP package and sixteen bent metal legs.
 box(0,.25,1.35,5.5,6.2,1.15,black);
 for(const side of [-1,1])for(let i=0;i<8;i++){
  const y=.25+(i-3.5)*.69;
  box(side*3.05,y,1.1,.7,.33,.2,metal);box(side*3.42,y,.91,.2,.33,.45,metal);box(side*3.7,y,.81,.55,.38,.15,metal);
 }
 const dot=new THREE.Mesh(new THREE.CircleGeometry(.19,16),new THREE.MeshBasicMaterial({color:'#5b5d5c'}));dot.position.set(-1.95,2.55,1.94);root.add(dot);
 // Gold 10 uF capacitor at the bottom of the photograph.
 box(0,-6.15,1.38,3.5,2.5,1.25,gold);box(-1.8,-6.15,1.02,.38,2.4,.45,metal);box(1.8,-6.15,1.02,.38,2.4,.45,metal);
 box(-1.15,-6.15,2.02,.25,2.45,.025,new THREE.MeshBasicMaterial({color:'#6b5a30'}));
 function smd(x,y,vertical,material){const a=vertical?.9:1.8,b=vertical?1.8:.9;box(x,y,1.03,a,b,.48,material);for(const side of [-1,1])box(x+(vertical?0:side*.89),y+(vertical?side*.89:0),1.02,vertical?.95:.35,vertical?.35:.95,.5,metal);}
 smd(4.6,2.5,true,ceramic);smd(3.8,6.9,false,ceramic);smd(-4.7,3.15,true,black);smd(4.65,-3.1,true,black);
 box(-3.65,6.6,.96,2.5,1.25,.28,metal);
 box(-3.65,6.6,1.29,1.5,.9,.55,new THREE.MeshStandardMaterial({color:'#c5e0c5',transparent:true,opacity:.78,roughness:.25}));
 box(-3.65,6.6,1.35,.45,.5,.12,new THREE.MeshStandardMaterial({color:'#80b698',emissive:'#183526',emissiveIntensity:.1}));
 // Small vias and two solder pads, visible in the component-side photograph.
 for(const [x,y]of [[2.9,4.75],[-2.8,-3.6],[4.8,-5.8]]){const via=new THREE.Mesh(new THREE.RingGeometry(.12,.24,16),gold);via.position.set(x,y,.79);root.add(via);}
 const pad=new THREE.Mesh(new THREE.CircleGeometry(.4,20),metal);pad.position.set(5,-6.4,.79);root.add(pad);
 // Fine printed outlines and traces, kept distinct from highlighted teaching wires.
 const ink=new THREE.LineBasicMaterial({color:'#a4b0b1',transparent:true,opacity:.65});
 for(const [x,y,sx,sy]of [[0,.25,4.2,3.55],[0,-6.15,2.25,1.7],[-3.65,6.6,1.7,.95]]){
  const pts=[[-sx,-sy],[sx,-sy],[sx,sy],[-sx,sy],[-sx,-sy]].map(([a,b])=>new THREE.Vector3(x+a,y+b,.795));root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),ink));
 }
 const traces=new THREE.LineBasicMaterial({color:'#303c3d'});
 for(const p of HW627_PINS){const sign=Math.sign(p.x),points=[[p.x,p.y],[sign*5.9,p.y],[sign*4.2,p.y*.46]].map(([x,y])=>new THREE.Vector3(x,y,.785));root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),traces));}
 function lettering(text,x,y,size,width,{back=false,color='#c1caca',z=.82}={}){
  if(!labels)return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle=color;ctx.font='bold 58px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,size),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));plane.position.set(x,y,back?-.05:z);if(back)plane.rotation.y=Math.PI;root.add(plane);
 }
 lettering('HW-627',0,4.9,1.2,5.5);lettering('DRV8833',0,-4.1,1.1,6.2);lettering('10uF',0,-8.15,.85,3);lettering('0.01uF',4.55,.55,.6,2.8);lettering('472',-4.65,3.15,.55,1.1);lettering('DRV8833',0,.3,.75,4.2,{z:1.94,color:'#7d8688'});
 // The second reference is the solder side: x is mirrored when viewed from below.
 for(const p of HW627_PINS)lettering(p.name,p.x-Math.sign(p.x)*2.55,p.y,.75,p.name==='SLEEP'?3.6:p.name==='FAULT'?3.6:2.9,{back:true});
 lettering('DRV8833',0,-7.75,.9,5.4,{back:true});lettering('J1',-.2,7.35,.7,1.1,{back:true});lettering('en',2.8,5.7,.55,1.3,{back:true});lettering('sleep',2.3,4.6,.5,2.5,{back:true});
 for(const x of [-1.15,.2]){const jumper=box(x,6.6,-.12,.8,.8,.18,metal);jumper.userData.jumper=true;}
 // J1 is shown as pads, not a claimed closed solder bridge: actual state unknown.
 return {root,board,contacts,hitTargets};
}
export function disposeModel(root){root.traverse(obj=>{obj.geometry?.dispose();for(const material of Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[]){material.map?.dispose();material.dispose();}});}

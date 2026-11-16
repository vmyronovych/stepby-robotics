import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createHW627Model,disposeModel} from './hw627-model.js';
import {createESP32Model,createExpansionModel,createMotorModel,createMountedESP32Model} from './photo-models.js';

export function createModuleModel(component,options={}){
 const factory={hw627:createHW627Model,esp32:createESP32Model,'esp32-mounted':createMountedESP32Model,expansion:createExpansionModel,motor:createMotorModel}[component.model];
 return factory({jumperVoltage:component.jumperVoltage,...options,pins:component.pins});
}
export function createModuleViewer(host,component,onSelect){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
 catch{return createPinFallback(host,component,onSelect);}
 const canvas=renderer.domElement;canvas.className='module-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','3D-модель. Перетягни для обертання, + і − для масштабу, стрілки для обертання. Контакти також доступні у списку.');
 renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(canvas);host.dataset.renderMode='3d';
 const scene=new THREE.Scene(),model=createModuleModel(component);scene.add(model.root);
 const camera=new THREE.OrthographicCamera(-40,40,40,-40,.1,1000);camera.up.set(0,1,0);
 const bounds=new THREE.Box3().setFromObject(model.root),center=bounds.getCenter(new THREE.Vector3());
 const size=bounds.getSize(new THREE.Vector3());
 const controls=new OrbitControls(camera,canvas);controls.target.copy(center);controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=4;controls.enableDamping=false;
 scene.add(new THREE.HemisphereLight(0xffffff,0x66717e,2.9));
 for(const [x,y,z,intensity]of [[-30,60,100,2.5],[40,-20,-80,2]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(x,y,z);scene.add(light);}
 const overlay=document.createElement('div');overlay.className='module-pins';host.append(overlay);
 const buttons=new Map();let disposed=false,selected=null,pending=0,group=null;
 for(const p of component.pins){
  const button=document.createElement('button');button.type='button';button.className='module-pin';button.dataset.pin=p.name;
  button.setAttribute('aria-label',`${p.label||p.name} — ${p.role}`);button.setAttribute('aria-pressed','false');button.style.setProperty('--pin-color',p.color||'#3a829f');
  const label=document.createElement('span');label.textContent=p.label||p.name;button.append(label);if(component.model==='hw627')button.classList.add('label-always');
  button.onclick=()=>onSelect(p.name);overlay.append(button);buttons.set(p.name,button);
 }
 function draw(){if(disposed||pending)return;pending=requestAnimationFrame(()=>{pending=0;if(disposed)return;
  renderer.render(scene,camera);const r=host.getBoundingClientRect();
  for(const p of component.pins){const point=new THREE.Vector3(p.x,p.y,p.z??.8).project(camera),button=buttons.get(p.name);
   button.style.left=`${(point.x+1)*r.width/2}px`;button.style.top=`${(1-point.y)*r.height/2}px`;
   // Hit markers must not cover neighbouring contacts on dense 38P/SVG rows.
   if(component.model==='esp32'||component.model==='expansion'){
    const neighbour=new THREE.Vector3(p.x+(component.model==='expansion'?2.54:0),p.y+(component.model==='esp32'?2.54:0),p.z??.8).project(camera);
    const pitch=Math.hypot((neighbour.x-point.x)*r.width/2,(neighbour.y-point.y)*r.height/2);
    const diameter=THREE.MathUtils.clamp(pitch*.85,4,18);button.style.width=button.style.height=`${diameter}px`;button.style.borderWidth=diameter<10?'1px':'2px';
   }

   button.hidden=!!group&&p.group!==group||Math.abs(point.x)>.96||Math.abs(point.y)>.96||point.z>1;
   button.classList.toggle('label-left',point.x<0);
  }
 });}
 function resize(){if(disposed)return;const r=host.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height,half=Math.max(size.y*.68,size.x*.68/aspect,size.z*.9);camera.left=-half*aspect;camera.right=-camera.left;camera.top=half;camera.bottom=-camera.top;camera.updateProjectionMatrix();draw();}
 function view(name){camera.position.copy(center).add(name==='back'?new THREE.Vector3(0,0,-160):name==='front'?new THREE.Vector3(0,0,160):new THREE.Vector3(35,-50,140));camera.up.set(0,1,0);camera.zoom=1;camera.lookAt(center);controls.update();resize();}
 function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.6,4);camera.updateProjectionMatrix();draw();}
 function select(name){selected=name;const pin=component.pins.find(p=>p.name===name);for(const [key,c]of model.contacts)c.halo.visible=key===name||!!pin?.pair?.includes(key);for(const [key,b]of buttons)b.setAttribute('aria-pressed',String(key===name));draw();}
 controls.addEventListener('change',draw);
 let down=null;const ray=new THREE.Raycaster();
 canvas.addEventListener('pointerdown',e=>{down=e.isPrimary?[e.clientX,e.clientY,e.pointerId]:null;});canvas.addEventListener('pointercancel',()=>{down=null});
 canvas.addEventListener('pointerup',e=>{const start=down;down=null;if(!start||start[2]!==e.pointerId||Math.hypot(e.clientX-start[0],e.clientY-start[1])>6)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=ray.intersectObjects(model.hitTargets.filter(o=>!group||component.pins.find(p=>p.name===o.userData.pin)?.group===group),false)[0];if(hit)onSelect(hit.object.userData.pin);});
 canvas.addEventListener('keydown',e=>{if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(['+','=','-'].includes(e.key))zoom(e.key==='-'?1/1.2:1.2);else{const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);const offset=camera.position.clone().sub(center).applyAxisAngle(axis,e.key==='ArrowLeft'||e.key==='ArrowUp'?-.18:.18);camera.position.copy(center).add(offset);controls.update();draw();}}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed)return;api.dispose();const fallback=createPinFallback(host,component,onSelect);if(selected)fallback.select(selected);Object.assign(api,fallback);});
 const observer=new ResizeObserver(resize);observer.observe(host);
 const api={select,view,zoom,filter(value){group=value||null;draw();},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(pending);observer.disconnect();controls.dispose();disposeModel(model.root);renderer.dispose();renderer.forceContextLoss();overlay.remove();canvas.remove();}};
 view('iso');return api;
}
// The fallback keeps physical positions and keyboard interaction; it is explicitly 2D.
export function createPinFallback(host,component,onSelect){
 host.dataset.renderMode='2d';const notice=document.createElement('p');notice.className='module-fallback-note';notice.textContent='2D-карта контактів · 3D недоступне у цьому браузері';host.append(notice);
 const surface=document.createElement('div');surface.className='module-flat';surface.style.background=component.model==='expansion'?'#602879':component.model==='motor'?'#e6c62e':'#18242a';host.append(surface);
 const xs=component.pins.map(p=>p.x),ys=component.pins.map(p=>p.y),minX=Math.min(...xs)-5,maxX=Math.max(...xs)+5,minY=Math.min(...ys)-4,maxY=Math.max(...ys)+4;
 for(const p of component.pins){const b=document.createElement('button');b.type='button';b.className='module-pin';b.dataset.pin=p.name;b.setAttribute('aria-label',p.label||p.name);b.setAttribute('aria-pressed','false');b.style.left=`${(p.x-minX)/(maxX-minX)*100}%`;b.style.top=`${(maxY-p.y)/(maxY-minY)*100}%`;b.style.setProperty('--pin-color',p.color||'#4e95c5');const label=document.createElement('span');label.textContent=p.label||p.name;b.append(label);if(component.model==='hw627')b.classList.add('label-always');b.onclick=()=>onSelect(p.name);surface.append(b);}
 function resize(){const r=surface.getBoundingClientRect();if(!r.width)return;if(['esp32','expansion'].includes(component.model)){const diameter=Math.max(3,Math.min(16,.8*2.54*(component.model==='esp32'?r.height/(maxY-minY):r.width/(maxX-minX))));for(const b of surface.querySelectorAll('button')){b.style.width=b.style.height=`${diameter}px`;b.style.borderWidth=diameter<10?'1px':'2px';}}}resize();const observer=globalThis.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(surface);
 return {select(name){for(const b of surface.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.pin===name));},view(){},zoom(){},filter(group){for(const b of surface.querySelectorAll('button'))b.hidden=!!group&&component.pins.find(p=>p.name===b.dataset.pin)?.group!==group;},dispose(){observer?.disconnect();surface.remove();notice.remove();}};
}

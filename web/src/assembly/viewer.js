import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import data from './presentation-data.js';
import {componentKey,COMPONENTS} from './components.js';
import {createModuleModel} from './module-viewer.js';

const Z=new THREE.Vector3(0,0,1);
const stageNames={1:'Нижня платформа',2:'Лівий передній мотор',3:'Мотор · посадка приблизна',4:'Колесо та втулка',5:'Опора 30 мм · посадка приблизна',6:'Відсік під нижньою платформою',7:'Ескіз кронштейна датчика',8:'Датчик лінії та затискачі',9:'Верхня платформа і гвинти',10:'Плата розширення ESP32 38P',11:'Плата ESP32',12:'Драйвер моторів DRV8833',13:'Перетворювач 5 В',18:'Акумулятор AA NiMH'};
export function partName(part){
 if(part.id==='batteryEnvelope')return 'Габарит відсіку 62 × 58 × 18 мм · кріплення скотчем знизу; точне положення невідоме';
 if(/^retainer/.test(part.id))return 'Ескіз кріплення мотора · звірити з комплектом';
 const names={lower:'Нижня акрилова платформа',upper:'Верхня акрилова платформа',esp:'ESP32 · 38 контактів',espShield:'Металевий екран ESP32',antenna:'Антена Wi-Fi',usb:'Роз’єм USB',sensor:'Датчик QTR-MD-05A',optics:'Віконце датчика — дивиться вниз',switch:'Головний вимикач S1',button:'Кнопка старту / стоп',expansion:'Плата розширення ESP32 38P · пропорції фото',espsocket:'Гніздо ESP32 · 19 контактів',expansionPin:'Контакти S / V / G плати розширення',voltageJumper:'Перемичка живлення периферії · 3,3 В',expansionDC:'Круглий вхід DC · у нашій схемі не використовується',expansionMicroUSB:'Micro-USB плати розширення · живлення 5 В від U2',expansionTypeC:'USB-C плати розширення · у нашій схемі вільний',expansionpost:'Ізоляційна опора плати розширення',regulator:'Перетворювач S13V30F5',inductor:'Дросель перетворювача'};
 if(names[part.id])return names[part.id];
 if(/^(driver[01]|driverchip[01]|drivercap[01])$/.test(part.id))return part.id.endsWith('0')?'D1 · DRV8833 HW-627 · передні мотори':'D2 · DRV8833 HW-627 · задні мотори';
 if(/^driverMount/.test(part.id))return 'Ескіз кріплення драйвера '+(part.id.endsWith('0')?'D1':'D2')+' · деталь ще не спроєктована';
 if(part.id==='driversocket')return 'Ескіз монтажу драйвера · виконання ще не визначене';
 if(/^(regMount|switchMount|buttonMount)/.test(part.id))return 'Ескіз ізольованого кріплення · виконання ще не визначене';
 if(/^wheel/.test(part.id))return ['Ліве переднє колесо','Праве переднє колесо','Ліве заднє колесо','Праве заднє колесо'][+part.id.slice(-1)];
 if(/^motor\d/.test(part.id))return ['Лівий передній мотор','Правий передній мотор','Лівий задній мотор','Правий задній мотор'][+part.id.slice(-1)];
 if(/^cell/.test(part.id))return 'AA NiMH · '+(+part.id.slice(-1)+1)+' з 4';
 if(/^upperthumb/.test(part.id))return 'Ручний гвинт верхньої платформи';
 return stageNames[part.stage]||'Деталь робота';
}

export class AssemblyViewer {
 constructor(host,onSelect,onFailure){
  this.host=host;this.onSelect=onSelect;this.active=false;this.generation=0;this.pending=false;this.step=data.steps[0];this.lift=0;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  this.renderer.setClearColor(0xf9faf7,1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.canvas=this.renderer.domElement;this.canvas.tabIndex=0;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','3D-модель машинки. Перетягни, щоб обертати; коліщатко або два пальці — масштаб. Стрілки на клавіатурі обертають.');
  host.append(this.canvas);
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-250,250,250,-250,1,4000);this.camera.up.set(0,0,1);
  this.camera.position.set(420,510,390);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,0,60);this.controls.enableDamping=false;
  this.controls.minZoom=.45;this.controls.maxZoom=3;this.controls.enablePan=true;this.controls.addEventListener('change',()=>this.draw());
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xa7abb4,2.5));
  const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(-200,50,450);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xe4ecff,1);fill.position.set(200,-250,130);this.scene.add(fill);
  const underside=new THREE.DirectionalLight(0xffffff,1.5);underside.position.set(0,-100,-300);this.scene.add(underside);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),new THREE.MeshBasicMaterial({color:0xf5f6f1}));floor.position.z=data.display.floor_z-2;this.scene.add(floor);this.floor=floor;
  const grid=new THREE.GridHelper(1000,40,0xdce3dc,0xe8ece5);grid.rotation.x=Math.PI/2;grid.position.z=data.display.floor_z-1;this.scene.add(grid);this.grid=grid;
  this.model=new THREE.Group();this.scene.add(this.model);this.meshes=[];
  for(const part of data.parts){
   const positions=[];
   for(const face of part.faces)for(let i=1;i<face.length-1;i++)for(const n of [face[0],face[i],face[i+1]])positions.push(...part.vertices[n]);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
   const material=new THREE.MeshStandardMaterial({color:part.color,roughness:.65,metalness:.12,side:THREE.DoubleSide,flatShading:true});
   if(part.id==='batteryEnvelope'){material.transparent=true;material.opacity=.3;material.depthWrite=false;}
   const mesh=new THREE.Mesh(geometry,material);mesh.userData.part=part;mesh.userData.center=geometry.boundingBox.getCenter(new THREE.Vector3());
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),new THREE.LineBasicMaterial({color:0x4b5b6b,transparent:true,opacity:.2}));mesh.add(edges);
   if(part.id==='driver0'||part.id==='driver1'){
    const badge=document.createElement('canvas');badge.width=128;badge.height=64;
    const ctx=badge.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,64);
    ctx.fillStyle='#193c61';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(part.id==='driver0'?'D1':'D2',64,33);
    const texture=new THREE.CanvasTexture(badge);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));
    label.position.copy(mesh.userData.center).add(new THREE.Vector3(0,0,16));label.scale.set(22,11,1);label.renderOrder=10;label.userData.pickMesh=mesh;mesh.add(label);
   }
   // Keep the shared assembly coordinates and step semantics; the photo-based
   // surfaces replace only schematic electronics. Mounts remain approximate.
   const replacement={driver0:'D1',driver1:'D2',esp:'ESP32',expansion:'30P'}[part.id];
   mesh.userData.suppressed=(part.stage===10&&!['expansion','expansionpost'].includes(part.id))||(part.stage===11&&part.id!=='esp')||/^(driverchip|drivercap)/.test(part.id)||part.id==='driversocket';
   if(replacement){
    const detailed=createModuleModel(COMPONENTS[replacement]);
    detailed.root.position.copy(mesh.userData.center);if(replacement==='30P')detailed.root.rotation.z=-Math.PI/2;
    if(replacement==='ESP32'){const carrier=this.meshes.find(m=>m.userData.part.id==='expansion');if(carrier){detailed.root.position.x=carrier.userData.center.x;detailed.root.position.y=carrier.userData.center.y+8.14;detailed.root.position.z=carrier.userData.center.z+8;}}
    // Align the two display pin grids; real socket fit and mounts remain unmeasured.
    mesh.material.colorWrite=false;mesh.material.depthWrite=false;edges.visible=false;
    detailed.root.traverse(obj=>{if(obj.isMesh&&obj.material?.visible!==false)obj.userData.pickMesh=mesh;});mesh.add(detailed.root);
   }
   this.model.add(mesh);this.meshes.push(mesh);
  }
  this.wires=new THREE.Group();this.model.add(this.wires);this.arrows=new THREE.Group();this.scene.add(this.arrows);
  this.ray=new THREE.Raycaster();let down=null;
  this.canvas.addEventListener('pointerdown',e=>{down=e.isPrimary?[e.clientX,e.clientY,e.pointerId]:null});
  this.canvas.addEventListener('pointercancel',()=>{down=null});
  this.canvas.addEventListener('pointerup',e=>{const start=down;down=null;if(!start||start[2]!==e.pointerId||Math.hypot(e.clientX-start[0],e.clientY-start[1])>6)return;const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
   const targets=this.meshes.filter(m=>m.visible).flatMap(m=>{const targets=[m];m.traverse(c=>{if(c!==m&&c.userData.pickMesh)targets.push(c);});return targets;});
   const hit=this.ray.intersectObjects([...targets,...this.wires.children],false)[0];this.select(hit?.object.userData.pickMesh||hit?.object);});
  this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft'||e.key==='ArrowRight')this.rotate(e.key==='ArrowLeft'?-1:1);else this.zoom(['ArrowUp','+','='].includes(e.key)?1.15:1/1.15)}});
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('3D-перегляд призупинено браузером. Кроки доступні нижче; спробуй перезавантажити сторінку.');});
  this.canvas.addEventListener('webglcontextrestored',()=>{onFailure('');this.draw()});
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
 }
 disposeGroup(group){for(const obj of [...group.children]){obj.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()});group.remove(obj)}}
 draw(){if(!this.active||this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;if(this.active){this.floor.visible=this.grid.visible=this.camera.position.z>0;this.renderer.render(this.scene,this.camera)}})}
 resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);const aspect=width/height,half=this.half||180;this.camera.left=-half*Math.max(1,aspect);this.camera.right=-this.camera.left;this.camera.top=half*Math.max(1,1/aspect);this.camera.bottom=-this.camera.top;this.camera.updateProjectionMatrix();this.draw()}
 resume(){this.active=true;this.resize();this.draw()}
 pause(){this.active=false;this.generation++}
 basePosition(mesh){return new THREE.Vector3(0,0,mesh.userData.part.stage>=9&&mesh.userData.part.stage<=13?this.lift:0)}
 setStep(step,openTop=false){
  this.generation++;this.step=step;this.lift=step.lift||((openTop&&step.stage>=9)?82:0);this.selected=null;
  for(const mesh of this.meshes){const p=mesh.userData.part;mesh.visible=p.stage<=step.stage&&!mesh.userData.suppressed;mesh.position.copy(this.basePosition(mesh));mesh.material.color.set(p.color);if(!step.preview&&p.stage!==step.new)mesh.material.color.lerp(new THREE.Color(0xdbe2e4),.67);mesh.material.emissive.set(0);}
  this.disposeGroup(this.wires);
  data.wires.forEach((w,i)=>{if(w.stage>step.stage)return;const points=w.points.map((p,j)=>new THREE.Vector3(...p).lerp(new THREE.Vector3(...data.liftedWires[i].points[j]),this.lift/82));
   const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,1.25,5,false);const color=step.preview||step.new===w.stage?w.color:0xc1cbd0;
   const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.65}));mesh.userData.part={id:'wire',stage:w.stage,name:w.name};this.wires.add(mesh);});
  this.disposeGroup(this.arrows);
  const arrowLift=step.new>=9&&step.new<=13?this.lift:0;
  this.arrowSegments=(step.arrows||[]).map(pair=>pair.map(([x,y,z])=>[x,y,z+arrowLift]));
  for(const [from,to]of this.arrowSegments){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),delta=end.clone().sub(start);this.arrows.add(new THREE.ArrowHelper(delta.clone().normalize(),start,delta.length(),0xe39822,9,4));}
  this.onSelect(null);
  if(step.view)this.view(step.view);else if(this.previousView)this.view('iso');
  this.previousView=step.view;this.fit();this.draw();
 }
 fit(){
  const bounds=new THREE.Box3();for(const m of this.meshes)if(m.visible)bounds.union(m.geometry.boundingBox.clone().translate(m.position));
  for(const [a,b]of this.arrowSegments||[]){bounds.expandByPoint(new THREE.Vector3(...a));bounds.expandByPoint(new THREE.Vector3(...b));}
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  this.half=Math.max(135,size.length()*.55);const offset=this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(700);
  this.controls.target.copy(center);this.camera.position.copy(center).add(offset);this.camera.zoom=1;this.controls.update();this.resize();
 }
 view(name){const target=this.controls.target,dir=name==='top'?new THREE.Vector3(0,-.001,1):name==='bottom'?new THREE.Vector3(0,-.3,-1):new THREE.Vector3(1.1,1.4,1.05);this.camera.position.copy(target).add(dir.normalize().multiplyScalar(700));this.controls.update();this.fit();this.draw()}
 rotate(sign){const d=this.camera.position.clone().sub(this.controls.target).applyAxisAngle(Z,sign*.28);this.camera.position.copy(this.controls.target).add(d);this.controls.update();this.draw()}
 zoom(factor){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.45,3);this.camera.updateProjectionMatrix();this.draw()}
 select(mesh){if(this.selected)this.selected.material.emissive.set(0);this.selected=mesh;if(mesh)mesh.material.emissive.set(0x56400b);this.onSelect(mesh?{id:mesh.userData.part.id,component:componentKey(mesh.userData.part),name:mesh.userData.part.name||partName(mesh.userData.part),stage:mesh.userData.part.stage}:null);this.draw()}
 componentMesh(key){
  const primary={D1:'driver0',D2:'driver1',ESP32:'esp','30P':'expansion',QTR:'sensor',U2:'regulator',BT1:'batteryEnvelope',chassis:'lower',button:'button',switch:'switch',M1:'motor0',M2:'motor1',M3:'motor2',M4:'motor3'}[key];
  return this.meshes.find(m=>m.visible&&m.userData.part.id===primary)||this.meshes.find(m=>m.visible&&componentKey(m.userData.part)===key);
 }
 selectComponent(key){const mesh=this.componentMesh(key);if(!mesh)return false;this.select(mesh);return true}
 componentPoint(key){
  const mesh=this.componentMesh(key);if(!mesh)return null;
  this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld();const badge=mesh.children.find(c=>c.userData.pickMesh);
  const point=badge?badge.getWorldPosition(new THREE.Vector3()):mesh.localToWorld(mesh.userData.center.clone());point.project(this.camera);
  const r=this.canvas.getBoundingClientRect();return {x:(point.x+1)*r.width/2,y:(1-point.y)*r.height/2};
 }
 animate(){
  if(!this.step.arrows?.length)return;
  const token=++this.generation,started=performance.now(),meshes=this.meshes.filter(m=>m.visible&&m.userData.part.stage===this.step.new);
  const offsets=meshes.map(m=>{let nearest=this.step.arrows[0],distance=Infinity;for(const arrow of this.step.arrows){const d=m.userData.center.distanceTo(new THREE.Vector3(...arrow[1]));if(d<distance){nearest=arrow;distance=d}}
   return new THREE.Vector3(...nearest[0]).sub(new THREE.Vector3(...nearest[1]));});
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1300;
  const frame=now=>{if(token!==this.generation||!this.active)return;const t=duration?Math.min(1,(now-started)/duration):1,remaining=(1-t)**3;
   meshes.forEach((m,i)=>m.position.copy(this.basePosition(m)).addScaledVector(offsets[i],remaining));this.draw();if(t<1)requestAnimationFrame(frame);};requestAnimationFrame(frame);
 }
 snapshot(){return {visible:this.meshes.filter(m=>m.visible).map(m=>m.userData.part.key),lift:this.lift,camera:this.camera.position.toArray(),positions:this.meshes.map(m=>({key:m.userData.part.key,position:m.position.toArray()}))}}
}

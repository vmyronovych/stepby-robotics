import * as THREE from 'three';
import {initModelFullscreen} from './fullscreen.js';
import './fullscreen.css';
import {initComponentDetails} from './component-details.js';
import './component-details.css';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import trace from '../../../assembly/sources/chassis-photo-trace.json';
import mesh from '../../../assembly/sources/chassis-planar-mesh.json';
import battery from '../../../assembly/sources/battery-measurements.json';

const host=document.getElementById('chassis3d');
const status=document.getElementById('chassis3dStatus');
try {
 const t=mesh.thickness_mm,gap=mesh.clear_gap_mm;
 if(!(t>0&&gap>0))throw Error('Спочатку потрібно виміряти товщину й проміжок.');
 const positions=[];
 const tri=(a,b,c)=>positions.push(...a,...b,...c);
 // Bottom/top triangles and walls share the exact same traced hole boundaries.
 for(const inds of mesh.triangles){
  const vs=inds.map(i=>mesh.vertices_xy[i]);
  const sign=(vs[1][0]-vs[0][0])*(vs[2][1]-vs[0][1])-(vs[1][1]-vs[0][1])*(vs[2][0]-vs[0][0]);
  if(sign<0)vs.reverse();
  tri(...vs.map(([x,y])=>[x,y,t]));tri(...[...vs].reverse().map(([x,y])=>[x,y,0]));
 }
 for(const [index,original]of [trace.outline.polygon_xy,...trace.features.map(f=>f.polygon_xy)].entries()){
  const loop=original.map(p=>new THREE.Vector2(...p));
  // Solid interior is on the left: outer CCW, openings CW.
  if(THREE.ShapeUtils.isClockWise(loop)!==(index>0))loop.reverse();
  loop.forEach((a,i)=>{const b=loop[(i+1)%loop.length];tri([a.x,a.y,0],[b.x,b.y,0],[b.x,b.y,t]);tri([a.x,a.y,0],[b.x,b.y,t],[a.x,a.y,t]);});
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xf8faf7);host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Дві пластини товщиною 3 мм із чистим проміжком 30 мм. Перетягуй для обертання.');renderer.domElement.setAttribute('role','img');
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x687784,2.4));const light=new THREE.DirectionalLight(0xffffff,2.6);light.position.set(-180,-200,400);scene.add(light);
 const camera=new THREE.OrthographicCamera(-220,220,170,-170,1,2000);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,(2*t+gap)/2);controls.minZoom=.6;controls.maxZoom=4;controls.enablePan=false;
 const material=new THREE.MeshStandardMaterial({color:0xc7ae6f,roughness:.8,side:THREE.DoubleSide});
 const lower=new THREE.Mesh(geometry,material);const upper=new THREE.Mesh(geometry,material.clone());upper.position.z=t+gap;
 scene.add(lower,upper);
 // Measured outer envelope only. No invented wall thickness, mounting holes or cells.
 const holder=new THREE.Mesh(new THREE.BoxGeometry(battery.width_mm,battery.length_mm,battery.height_with_cells_mm),new THREE.MeshStandardMaterial({color:0x236eb4,transparent:true,opacity:.45,roughness:.85,depthWrite:false}));
 // Underside region confirmed by owner; exact XY and fastening offset remain unknown.
 holder.position.set(...battery.display_pose.centre_xy_mm,battery.display_pose.top_z_mm-battery.height_with_cells_mm/2);
 holder.add(new THREE.LineSegments(new THREE.EdgesGeometry(holder.geometry),new THREE.LineBasicMaterial({color:0x164e89})));
 scene.add(holder);
 for(const part of [lower,upper])part.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,35),new THREE.LineBasicMaterial({color:0x716344,transparent:true,opacity:.4})));
 // Dimension guide stands outside the plate envelope, never resembles a support.
 const dimension=new THREE.BufferGeometry().setFromPoints([[92,-90,t],[92,-90,t+gap]].map(p=>new THREE.Vector3(...p)));
 scene.add(new THREE.Line(dimension,new THREE.LineBasicMaterial({color:0x326b9d})));
 function draw(){renderer.render(scene,camera)}
 function view(name){camera.up.set(0,name==='bottom'?1:0,name==='bottom'?0:1);camera.position.set(...({iso:[420,320,300],top:[0,0,650],bottom:[0,0,-650],side:[650,0,18]}[name]));camera.zoom=1;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();draw();}
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const a=w/h;camera.left=-170*Math.max(1,a);camera.right=-camera.left;camera.top=170*Math.max(1,1/a);camera.bottom=-camera.top;camera.updateProjectionMatrix();draw()}
 const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',draw);
 document.querySelectorAll('[data-chassis-view]').forEach(b=>b.onclick=()=>view(b.dataset.chassisView));
 document.getElementById('hideUpper').onchange=e=>{upper.visible=!e.target.checked;draw()};
 document.getElementById('showBattery').onchange=e=>{holder.visible=e.target.checked;document.getElementById('batteryFootprint').style.display=e.target.checked?'':'none';draw()};
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='3D-перегляд перервано. Карта отворів нижче залишається доступною.';});
 resize();view('iso');
 const picker=document.getElementById('chassisComponentSelect');
 const details=initComponentDetails(host,{onClose:()=>{picker.value='';},onNavigate:key=>details.open(key)});
 picker.onchange=()=>{if(picker.value)details.open(picker.value);else details.close()};
 const ray=new THREE.Raycaster();let down=null;
 renderer.domElement.tabIndex=0;
 renderer.domElement.addEventListener('pointerdown',e=>{down=e.isPrimary?[e.clientX,e.clientY,e.pointerId]:null});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null});
 renderer.domElement.addEventListener('pointerup',e=>{
  const start=down;down=null;if(!start||start[2]!==e.pointerId||Math.hypot(e.clientX-start[0],e.clientY-start[1])>6)return;
  const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  const hit=ray.intersectObjects([lower,upper,holder].filter(m=>m.visible),false)[0];
  if(hit){picker.value=hit.object===holder?'BT1':'chassis';details.open(picker.value);}
 });
 const fullscreenButton=document.getElementById('chassisFullscreen');
 initModelFullscreen(document.getElementById('chassisPresentation'),fullscreenButton);fullscreenButton.disabled=false;
 status.textContent=`Відсік ${battery.length_mm} × ${battery.width_mm} × ${battery.height_with_cells_mm} мм під нижньою платформою: власник підтвердив, що поміщається й не торкається підлоги. До підлоги 3–4 мм до приклеювання. Обрано двосторонній скотч; отвори не збігаються. Його товщина й точне положення ще невідомі.`;
 const holderBounds=new THREE.Box3().setFromObject(holder);host.dataset.batteryBounds=JSON.stringify({min:holderBounds.min.toArray(),max:holderBounds.max.toArray(),location:"under_lower_plate",reportedClearanceBeforeTape:battery.selected_pose.ground_clearance_mm,finalGroundClearance:null,exactMountingPosition:false});
 host.dataset.ready='true';host.dataset.lowerZ=[geometry.boundingBox.min.z,geometry.boundingBox.max.z].join(',');host.dataset.upperZ=[geometry.boundingBox.min.z+upper.position.z,geometry.boundingBox.max.z+upper.position.z].join(',');
}catch(e){status.textContent='3D недоступне: '+e.message+' Карта отворів нижче залишається доступною.';}

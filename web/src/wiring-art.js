import {breadboardSvg} from './breadboard.js';
import {teachingPartSvg} from './teaching-parts.js';
import {jumperVoltage} from './assembly/expansion-jumper.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {physicalLayout,mounted,motorPins} from './wiring-physical.js';
// Reuse the project's models made from the owner's photos. These thumbnails
// illustrate the components; terminal locations belong to the wiring diagram.
const cache=new Map();
const svgImage=body=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200">${body}</svg>`);
export function componentArt(component){
 if(component==='breadboard'||component?.kind==='breadboard')return Promise.resolve('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(breadboardSvg()));
 if(typeof component==='string'&&['led','resistor'].includes(component))return Promise.resolve('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(teachingPartSvg({kind:component})));
 if(['led','resistor'].includes(component?.kind))return Promise.resolve('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(teachingPartSvg(component)));
 const c=typeof component==='string'?{kind:component}:component,kind=c.kind,key=mounted(c)?'mounted':kind;
 if(cache.has(key))return cache.get(key);
 const promise=(async()=>{
  if(kind==='battery')return svgImage('<rect x="22" y="23" width="176" height="154" rx="12" fill="#323b3f"/>'+[0,1,2,3].map(i=>`<rect x="${31+i*41}" y="35" width="35" height="129" rx="12" fill="#d4b859"/><rect x="${39+i*41}" y="29" width="18" height="9" rx="3" fill="#afb9b7"/><text x="${48+i*41}" y="98" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#273940">AA</text>`).join('')+'<path d="M55 170v14" stroke="#c75542" stroke-width="6"/><path d="M165 170v14" stroke="#293538" stroke-width="6"/><circle cx="55" cy="184" r="4" fill="#b8bec1"/><circle cx="165" cy="184" r="4" fill="#b8bec1"/>');
  if(kind==='usb')return svgImage('<rect x="28" y="18" width="164" height="100" rx="10" fill="#31464c"/><rect x="38" y="28" width="144" height="80" rx="4" fill="#e3eeeb"/><path d="M85 120h50l14 18H71z" fill="#8fa3a7"/><path d="M110 140v22q0 14 35 14h20" fill="none" stroke="#414d52" stroke-width="7"/><rect x="160" y="163" width="22" height="25" rx="4" fill="#777f80"/><text x="110" y="76" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#4a7168">USB</text>');
  const [THREE,models,driver]=await Promise.all([import('three'),import('./assembly/photo-models.js'),import('./assembly/hw627-model.js')]);
  const factory=mounted(c)?models.createMountedESP32Model:{esp32:models.createESP32Model,expansion:models.createExpansionModel,motor:models.createMotorModel,driver:driver.createHW627Model}[kind];
  const model=factory({pins:kind==='motor'?motorPins:[],jumperVoltage:jumperVoltage(c),drawJumper:false}),renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  let environment,pmrem;
  try{
   const layout=physicalLayout({...c,rotation:0}),[left,right,bottom,top]=layout.bounds;
   renderer.setSize(layout.width*2,layout.imageHeight*2);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
   renderer.setClearColor(0x000000,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   const scene=new THREE.Scene();pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);room.dispose();scene.environment=environment.texture;scene.environmentIntensity=.3;scene.add(model.root,new THREE.HemisphereLight(0xffffff,0x596275,1.2));
   const light=new THREE.DirectionalLight(0xfff6e8,2);light.position.set(-35,40,95);light.castShadow=true;
   Object.assign(light.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:250});light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.0003;scene.add(light);
   const fill=new THREE.DirectionalLight(0xd8e8ff,.6);fill.position.set(60,-20,50);scene.add(fill);
   model.root.traverse(o=>{if(o.isMesh&&!o.material?.transparent&&o.material?.visible!==false){o.castShadow=true;o.receiveShadow=true;}});
   const camera=new THREE.OrthographicCamera(left,right,top,bottom,.1,500);camera.position.set(0,0,160);camera.up.set(0,1,0);camera.lookAt(0,0,0);
   renderer.render(scene,camera);return renderer.domElement.toDataURL();
  }finally{environment?.dispose();pmrem?.dispose();driver.disposeModel(model.root);renderer.dispose();renderer.forceContextLoss();}

 })().catch(()=>svgImage('<rect x="40" y="30" width="140" height="140" rx="12" fill="#526d67"/><text x="110" y="108" text-anchor="middle" font-family="sans-serif" font-size="16" fill="white">Модуль</text>'));
 cache.set(key,promise);return promise;
}

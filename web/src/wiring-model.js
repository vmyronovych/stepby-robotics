import {validateMounts,mountLinks} from './breadboard-mount-data.js';
import {BREADBOARD_PINS} from './breadboard.js';
import {analyzeLEDs} from './wiring-led.js';
import {RESISTANCES,LED_COLORS} from './teaching-parts.js';
import {boardPins,OUTPUT_PINS} from './usb-pins.js';
import {EXPANSION_PINS} from './assembly/board-layouts.js';
import {HW627_PINS} from './assembly/hw627.js';

export const CATALOG={
 esp32:{name:'ESP32',model:'esp32',detail:'Твоя плата · 38 контактів'},
 driver:{name:'DRV8833',model:'hw627',detail:'Чорний модуль HW-627'},
 breadboard:{name:'Mini breadboard',detail:'170 отворів · 10 × 17'},
 resistor:{name:'Резистор',detail:'Обмежує струм · ±5%'},
 led:{name:'Світлодіод',detail:'Анод A · катод K'},
 motor:{name:'Мотор',model:'motor',detail:'Жовтий мотор-редуктор'},
 battery:{name:'Батареї',detail:'4 × AA NiMH · номінал 4,8 В'},
 usb:{name:'USB комп’ютера',detail:'Кабель до самої ESP32'},
 expansion:{name:'Плата розширення',model:'expansion',detail:'ESP32S 38P/4 · ряди S / V / G'},
};
export const emptyWiring=()=>({version:1,components:[],wires:[],checked:[]});
export const endpoint=(component,pin)=>`${typeof component==='string'?component:component.id}:${pin}`;
export function ports(component){
 const port=(id,role,side,row,label=id,extra={})=>({id,label,role,side,row,...extra});
 if(component.kind==='esp32')return [...boardPins.map(p=>port(p.id,p.kind==='signal'?'gpio':p.kind==='input'?'input':p.kind==='power'?'rail':p.kind,p.side,p.row,p.label,{gpio:p.gpio,strapping:p.strapping,voltage:p.label==='3V3'?3.3:p.label==='5V'?5:undefined})),port('USB','usb','right',19),...(component.expansion==='esp32s-38p'?expansionPorts():[])];
 if(component.kind==='driver')return HW627_PINS.map(p=>port(p.name,p.name.startsWith('IN')||p.name==='SLEEP'?'control':p.name.startsWith('OUT')?'output':p.name==='GND'?'ground':p.name==='VCC'?'supply':'fault',p.side,p.row));
 if(component.kind==='breadboard')return BREADBOARD_PINS.map(p=>port(p.id,'breadboard',p.side,p.row,p.id,{group:p.group}));
 if(component.kind==='resistor')return [port('A','resistor','left',0,'Вивід A'),port('B','resistor','right',0,'Вивід B')];
 if(component.kind==='led')return [port('A','led-anode','left',0,'A · анод (+)'),port('K','led-cathode','right',0,'K · катод (−)')];
 if(component.kind==='motor')return [port('A','motor','left',0,'Провід A'),port('B','motor','left',1,'Провід B')];
 if(component.kind==='battery')return [port('PLUS','source','right',0,'+ 4,8 В',{voltage:4.8}),port('GND','ground','right',1,'−')];
 if(component.kind==='usb')return [port('USB','usb','right',0,'USB-кабель')];
 // S labels represent breakouts, not an invented internal power schematic.
 const signals=boardPins.filter(p=>p.gpio!==null);
 return [...signals.map((p,i)=>port(`S${p.gpio}`,'breakout',i<16?'left':'right',i%16,`S · ${p.label}`,{gpio:p.gpio})),port('V','unknown','right',16,'Ряд V'),port('G','ground','right',17,'Ряд G')];
}

export function expansionPorts(){
 return EXPANSION_PINS.filter(p=>p.group!=='Гнізда ESP32').map((p,row)=>{
  if(p.name.startsWith('aux-')){
   const label=p.label,base=boardPins.find(b=>b.label===label.replace(/^D/,'GPIO'));
   return {id:`exp-${p.name}`,label:`${label} · окрема гребінка`,role:label==='GND'?'ground':label==='VCC'?'unknown':['TX','RX'].includes(label)?'reserved':'breakout',side:'top',row,gpio:base?.gpio??null,hostPin:label.startsWith('D')||['TX','RX'].includes(label)?base?.id:undefined};
  }
  const band=p.group.slice(-1),label=p.label.split(' · ')[0];
  const base=boardPins.find(b=>b.label===label||b.label==='SP'&&label==='SVP'||b.label==='SN'&&label==='SVN');
  return {id:`exp-${p.name}`,label:band==='G'?`GND · G (${label})`:`${label} · ${band}`,role:band==='G'?'ground':band==='V'?'unknown':base?.kind==='power'?'rail':'breakout',voltage:band==='S'&&base?.kind==='power'?(label==='5V'?5:3.3):undefined,side:p.y>0?'top':'bottom',row,gpio:band==='S'?(base?.gpio??null):null,hostPin:band==='S'&&base?.kind!=='power'?base?.id:undefined};
 });
}
// Fold existing separate expansion components into the controller without losing wires.
export function mountLegacyExpansions(state){
 const result=JSON.parse(JSON.stringify(state));const esp=result.components.find(c=>c.kind==='esp32');
 if(!esp||esp.expansion)return result;
 const candidates=result.components.filter(c=>c.kind==='expansion'&&(!c.host||c.host===esp.id));
 if(candidates.length!==1)return result;
 const expansion=candidates[0],pins=expansionPorts();for(const other of result.components)if(other!==esp&&other!==expansion&&other.x>esp.x+100)other.x=Math.min(3000,other.x+288);esp.expansion='esp32s-38p';
 const remap=key=>{
  if(!key.startsWith(expansion.id+':'))return key;
  const id=key.slice(expansion.id.length+1),p=pins.find(p=>id==='G'?p.role==='ground':id==='V'?p.role==='unknown':p.role==='breakout'&&p.gpio===Number(id.slice(1)));
  if(!p)throw Error('Не вдалося перенести контакт плати розширення.');return `${esp.id}:${p.id}`;
 };
 for(const w of result.wires){w.a=remap(w.a);w.b=remap(w.b);}
 result.components=result.components.filter(c=>c!==expansion);result.checked=[];
 return result;
}

export function terminalMap(state){return new Map(state.components.flatMap(c=>ports(c).map(p=>[endpoint(c,p.id),{...p,component:c,key:endpoint(c,p.id)}])));}
export function validateWiring(state){
 if(!state||state.version!==1||!Array.isArray(state.components)||!Array.isArray(state.wires)||state.components.length>16||state.wires.length>100)throw Error('Невідомий формат схеми або забагато компонентів / проводів.');
 const ids=new Set();
 for(const c of state.components){
  if(!c||!Object.hasOwn(CATALOG,c.kind)||typeof c.id!=='string'||!/^[-\w]{1,80}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>40||![c.x,c.y].every(n=>Number.isFinite(n)&&n>=0&&n<=3000))throw Error('Перевір назви, координати та ідентифікатори компонентів.');
  if(c.resistance!==undefined&&(c.kind!=='resistor'||!RESISTANCES.includes(c.resistance)))throw Error('Невідомий номінал резистора.');
  if(c.ledColor!==undefined&&(c.kind!=='led'||typeof c.ledColor!=='string'||!Object.hasOwn(LED_COLORS,c.ledColor)))throw Error('Колір світлодіода: червоний, жовтий або зелений.');
  if(c.jumperVoltage!==undefined&&(![3.3,5].includes(c.jumperVoltage)||!['esp32','expansion'].includes(c.kind)))throw Error('Перемичка плати розширення: обери 3,3 В або 5 В.');
  if(c.rotation!==undefined&&![0,90,180,270].includes(c.rotation))throw Error('Кут повороту компонента має бути 0°, 90°, 180° або 270°.');
  if(c.expansion!==undefined&&(c.kind!=='esp32'||!['none','esp32s-38p'].includes(c.expansion)))throw Error('Невідома плата розширення ESP32.');
  // Accept the deprecated boolean in saved projects, without using it as a gate.
  if(c.host!==undefined&&typeof c.host!=='string'||c.signalsVerified!==undefined&&typeof c.signalsVerified!=='boolean')throw Error('Невідоме підключення плати розширення.');
  ids.add(c.id);
 }
 if(state.components.filter(c=>c.kind==='esp32').length>1)throw Error('Один проєкт програмує одну ESP32.');
 for(const c of state.components)if(c.host&&!state.components.some(h=>h.id===c.host&&h.kind==='esp32'))throw Error('Не знайдено ESP32 для плати розширення.');
 const terminals=terminalMap(state),wireIds=new Set(),pairs=new Set();
 for(const w of state.wires){
  const pair=[w.a,w.b].sort().join('|');
  if(typeof w.id!=='string'||!/^[-\w]{1,80}$/.test(w.id)||wireIds.has(w.id)||!terminals.has(w.a)||!terminals.has(w.b)||w.a===w.b||pairs.has(pair)||!/^#[0-9a-f]{6}$/i.test(w.color))throw Error('Провід має невідомий контакт, дублюється або містить некоректні дані.');
  if(w.vertices!==undefined&&(!Array.isArray(w.vertices)||w.vertices.length>32||w.vertices.some(p=>!p||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=6000))))throw Error('Маршрут проводу: не більше 32 точок у межах полотна.');
  wireIds.add(w.id);pairs.add(pair);
 }
 validateMounts(state);
 if(state.checked!==undefined&&(!Array.isArray(state.checked)||state.checked.length>100||state.checked.some(id=>!wireIds.has(id))))throw Error('Не вдалося прочитати звіряння проводів.');
 return state;
}

export function analyzeWiring(state){
 validateWiring(state);
 const terminals=terminalMap(state),parents=new Map([...terminals.keys()].map(k=>[k,k]));
 const find=k=>{let p=parents.get(k);if(p!==k){p=find(p);parents.set(k,p);}return p;};
 const join=(a,b)=>{if(terminals.has(a)&&terminals.has(b))parents.set(find(a),find(b));};
 const issues=[],add=(severity,code,message,keys=[],steps=[])=>{const wireIds=state.wires.filter(w=>keys.includes(w.a)||keys.includes(w.b)).map(w=>w.id);issues.push({severity,code,message,keys,wireIds,steps});};
 for(const c of state.components){
  if(c.kind==='breadboard'){const groups=new Map();for(const p of ports(c)){const first=groups.get(p.group);if(first)join(endpoint(c,first),endpoint(c,p.id));else groups.set(p.group,p.id);}}
  const grounds=ports(c).filter(p=>p.role==='ground');for(const g of grounds.slice(1))join(endpoint(c,grounds[0].id),endpoint(c,g.id));
  if(c.kind==='esp32'&&c.expansion==='esp32s-38p'){
   add('unknown','expansion-power',`${c.name}: живлення червоних рядів V`,ports(c).filter(p=>p.id.startsWith('exp-')&&p.label.endsWith(' · V')).map(p=>endpoint(c,p.id)),[
    'Знайди жовту перемичку JUMP біля USB на платі розширення. Вона обирає живлення рядів V: 3,3 В або 5 В.',
    c.jumperVoltage===undefined?'На фото закриті середній V і нижній 5V. Натисни перемичку на схемі, щоб обрати положення.':`На схемі обрано ${String(c.jumperVoltage).replace('.',',')} В. Звір положення з реальною платою; переставляй перемичку лише без живлення.`,
    'Перед підключенням модуля попроси вчителя виміряти напругу між червоним V і чорним G та звірити її з живленням модуля.',
   ]);
   const vcc=ports(c).filter(p=>p.id.startsWith('exp-aux-')&&p.role==='unknown').map(p=>endpoint(c,p.id));
   if(state.wires.some(w=>vcc.includes(w.a)||vcc.includes(w.b)))add('unknown','expansion-vcc',`${c.name}: окремо перевір VCC`,vcc,[
    'Це контакти VCC на чорній гребінці 2×4 біля круглого роз’єму живлення.',
    'Попроси вчителя виміряти VCC відносно GND. Положення JUMP саме по собі не підтверджує напругу цих контактів.',
   ]);
   // This supported board profile defines its S/G mapping; old confirmation flags are ignored.
   for(const p of expansionPorts())if(p.hostPin)join(endpoint(c,p.id),endpoint(c,p.hostPin));
  }
  if(c.kind==='expansion'){
   add('unknown','expansion-power','Плата розширення: напруга V та внутрішні шляхи живлення не підтверджені.',ports(c).map(p=>endpoint(c,p.id)));
   if(c.host){
    const host=state.components.find(h=>h.id===c.host);join(endpoint(c,'G'),endpoint(host,'left-13'));
    for(const p of ports(c).filter(p=>p.role==='breakout')){const hp=ports(host).find(h=>h.gpio===p.gpio);if(hp)join(endpoint(c,p.id),endpoint(host,hp.id));}
   }else add('unknown','expansion-host','Обери ESP32, встановлену в плату розширення.');
  }
 }
 const placements=mountLinks(state);for(const [a,b]of placements)join(a,b);
 const usbPowered=new Set();
 for(const w of state.wires){
  const a=terminals.get(w.a),b=terminals.get(w.b);
  if(a.role==='usb'||b.role==='usb'){
   if(a.role==='usb'&&b.role==='usb'&&new Set([a.component.kind,b.component.kind]).has('esp32')&&new Set([a.component.kind,b.component.kind]).has('usb'))usbPowered.add(a.component.kind==='esp32'?a.component.id:b.component.id);
   else add('error','usb-port','USB-кабель з’єднує комп’ютер із USB-роз’ємом ESP32.',[w.a,w.b]);
   continue;
  }
  join(w.a,w.b);
 }
 const nets=new Map();for(const t of terminals.values()){const key=find(t.key);if(!nets.has(key))nets.set(key,[]);nets.get(key).push(t);}
 const net=key=>nets.get(find(key))||[];
 const connected=key=>state.wires.some(w=>w.a===key||w.b===key)||placements.some(pair=>pair.includes(key));
 for(const members of nets.values()){
  if(members.length<2||!members.some(t=>connected(t.key)))continue;
  const keys=members.map(t=>t.key),has=role=>members.some(t=>t.role===role);
  const controllers=members.filter(t=>['gpio','input'].includes(t.role)),sources=members.filter(t=>['source','rail'].includes(t.role));
  if(has('ground')&&sources.length)add('error','short','Живлення з’єднане із землею. Прибери цей шлях замикання.',keys);
  const external=sources.filter(t=>t.role==='source'),rails=sources.filter(t=>t.role==='rail'),railKinds=new Set(rails.map(t=>`${t.component.id}:${t.voltage}`));
  if(external.length>1||railKinds.size>1||external.length&&rails.some(t=>t.voltage!==5))add('error','sources','З’єднано різні джерела або шини живлення. Розділи їх.',keys);
  if(sources.length&&controllers.length)add('error','gpio-power','Живлення потрапляє на GPIO. Для живлення використовуй відповідні контакти.',keys);
  if(has('ground')&&controllers.length)add('error','gpio-ground','GPIO з’єднано напряму із землею. Не вмикай такий вихід; прибери з’єднання.',keys);
  if(controllers.length>1)add('error','gpio-conflict','Декілька GPIO з’єднано разом. Для команд драйвера обери окремі сигнали.',keys);
  if(has('reserved'))add('error','reserved','Службові контакти пам’яті, UART та перезапуску залишаємо вільними.',keys);
  if(has('motor')&&controllers.length)add('error','motor-gpio','Мотору потрібен DRV8833. Підключи його до OUT1/OUT2 або OUT3/OUT4.',keys);
  if(has('motor')&&members.some(t=>!['motor','output','breadboard'].includes(t.role)))add('error','motor-connection','У цій схемі проводи мотора підключаємо лише до виходів DRV8833.',keys);
  if(has('output')&&members.some(t=>!['output','motor','breadboard'].includes(t.role)))add('error','motor-output','Виходи OUT призначені для проводів мотора, не для GPIO чи живлення.',keys);
  if(members.filter(t=>t.role==='output').length>1)add('error','output-conflict','Виходи моторного драйвера не можна об’єднувати в цій навчальній схемі.',keys);
  if(has('control')&&controllers.some(t=>t.role==='input'))add('error','input-only','Цей GPIO лише читає сигнали. Для IN драйвера обери вихідний GPIO.',keys);
  if(has('control')&&has('fault'))add('error','signal-conflict','Вихід FAULT та входи керування потребують окремих підключень.',keys);
  if(has('unknown'))add('unknown','unknown-rail','До проводу приєднано V або VCC: перед підключенням модуля виміряй цей контакт відносно GND разом із учителем.',keys);
  for(const t of controllers)if(t.strapping)add('unknown','strapping',`${t.label} також впливає на запуск ESP32. Перевір зовнішнє підключення.`,[t.key]);
 }
 for(const c of state.components){
  if(c.kind==='esp32'){
   const inputs=ports(c).filter(p=>p.role==='rail'&&p.voltage===5),powered=inputs.map(p=>({key:endpoint(c,p.id),sources:net(endpoint(c,p.id)).filter(t=>t.role==='source')})).filter(p=>p.sources.length);
   if(!usbPowered.has(c.id)&&!powered.length)add('incomplete','esp-power','Познач живлення ESP32: USB або зовнішнє живлення через 5V та GND.',[endpoint(c,'USB')]);
   for(const supply of powered){
    if(usbPowered.has(c.id))add('error','usb-backfeed','USB та зовнішнє живлення одночасно під’єднані до 5V. Від’єднай зовнішній плюс перед USB-підключенням; розв’язку цієї плати не підтверджено.',[supply.key]);
    add('unknown','external-5v','5V — контакт живлення, не GPIO. 4,8 В — лише номінал батарей: звір фактичну напругу, допустимий діапазон і шлях живлення плати; для входу 5V потрібне відповідне стабільне живлення.',[supply.key]);
    const ground=net(endpoint(c,'left-13'));
    if(supply.sources.some(source=>!ground.some(g=>g.component.id===source.component.id&&g.role==='ground')))add('incomplete','external-ground','Для зовнішнього живлення ESP32 також потрібен мінус джерела до GND.',[supply.key,endpoint(c,'left-13')]);
   }
  }
  if(c.kind==='driver'){
   const power=net(endpoint(c,'VCC')).filter(t=>t.role==='source');
   if(!power.length)add('incomplete','driver-power',`${c.name}: підключи живлення моторів до VCC.`,[endpoint(c,'VCC')]);
   const ground=net(endpoint(c,'GND'));
   if(!ground.some(t=>t.component.kind==='esp32')||power.some(t=>!ground.some(g=>g.component.id===t.component.id&&g.role==='ground')))add('incomplete','ground',`${c.name}: потрібна спільна земля драйвера, ESP32 та батарей.`,[endpoint(c,'GND')]);
  }
  if(c.kind==='motor'){
   const a=net(endpoint(c,'A')).filter(t=>t.role==='output'),b=net(endpoint(c,'B')).filter(t=>t.role==='output');
   if(a.length!==1||b.length!==1)add('incomplete','motor-pair',`${c.name}: з’єднай два проводи з парою OUT одного драйвера.`,[endpoint(c,'A'),endpoint(c,'B')]);
   else if(a[0].component.id!==b[0].component.id||!['OUT1,OUT2','OUT3,OUT4'].includes([a[0].id,b[0].id].sort().join(',')))add('error','motor-pair',`${c.name}: потрібна пара OUT1/OUT2 або OUT3/OUT4 одного драйвера.`,[endpoint(c,'A'),endpoint(c,'B')]);
   else{
    const first=a[0].id==='OUT1'||a[0].id==='OUT2'?1:3,d=a[0].component;
    for(const n of [first,first+1])if(!net(endpoint(d,`IN${n}`)).some(t=>t.role==='gpio'||t.role==='ground'))add('incomplete','motor-control',`${c.name}: підключи ${d.name} IN${n} до вихідного GPIO.`,[endpoint(d,`IN${n}`)]);
   }
   add('unknown','motor-rating',`${c.name}: напругу, пусковий струм і допустиме навантаження перевіряємо на реальному моторі.`,[endpoint(c,'A'),endpoint(c,'B')]);
  }
  if(c.kind==='battery')add('unknown','battery-voltage','4,8 В — номінал батарей. Фактичну напругу та полярність звір перед подаванням живлення.',[endpoint(c,'PLUS')]);
 }
 const bindings=analyzeLEDs(state,net,add,issues);
 for(const t of terminals.values())if(t.role==='control'||t.role==='fault'){
  const gpios=net(t.key).filter(p=>['gpio','input'].includes(p.role));
  const errors=issues.filter(i=>i.severity==='error'&&i.keys.some(k=>net(t.key).some(n=>n.key===k)));
  const gpio=gpios.length===1&&!errors.length?gpios[0].gpio:null;
  const n=Number(t.id.replace('IN','')),outs=Number.isFinite(n)&&n>0?(n<=2?['OUT1','OUT2']:['OUT3','OUT4']):[];
  const motor=outs.length?state.components.find(c=>c.kind==='motor'&&outs.every(out=>net(endpoint(t.component,out)).some(p=>p.component.id===c.id&&p.role==='motor'))):null;
  const label=`${motor?.name||t.component.name} · ${t.id}`;
  if(t.role==='fault'&&connected(t.key))add('unknown','fault-pullup',`${t.component.name}: FAULT активний низьким рівнем. Звір підтягування до 3,3 В і напругу виходу модуля.`,[t.key]);
  if(connected(t.key)||gpio!==null)bindings.push({ref:t.key,label,gpio,role:t.role,available:gpio!==null&&(t.role==='fault'||OUTPUT_PINS.includes(gpio))});
 }
 return {issues,bindings,terminals,net,usbPowered};
}

export function wiringImpact(before,after,project){
 const oldMap=new Map(analyzeWiring(before).bindings.map(b=>[b.ref,b])),newMap=new Map(analyzeWiring(after).bindings.map(b=>[b.ref,b]));
 const affected=[];
 function walk(node,owner='Програма'){
  if(!node||typeof node!=='object')return;
  if(node.type?.startsWith('wired_pin_')){const ref=node.extraState?.ref,a=oldMap.get(ref),b=newMap.get(ref);if(a?.gpio!==b?.gpio||a?.label!==b?.label)affected.push({ref,owner,from:a?.gpio??null,to:b?.gpio??null,label:b?.label||a?.label||'Видалене підключення'});}
  for(const [key,value] of Object.entries(node))if(key!=='wiring'&&key!=='myBlocks'&&value&&typeof value==='object')walk(value,owner);
 }
 walk(project.blocks);for(const def of project.myBlocks||[])walk(def.body,def.name);return affected;
}

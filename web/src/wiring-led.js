import {resistance} from './teaching-parts.js';

// Follow a simple series resistor chain, never merging a resistor or LED into
// a zero-ohm wire. This lesson uses active-high GPIO → R → A / K → GND.
export function analyzeLEDs(state,net,add,existingIssues){
 const bindings=[];
 function trace(start){
  let current=start,total=0;const seen=new Set(),keys=new Set();
  for(let step=0;step<=state.components.length;step++){
   const members=net(current);for(const p of members)keys.add(p.key);
   const anchors=members.filter(p=>['gpio','input','ground','source','rail','unknown','reserved','output','control','fault'].includes(p.role));
   if(anchors.length)return {anchors,total,keys:[...keys]};
   const candidates=members.filter(p=>p.role==='resistor'&&p.key!==current);
   if(candidates.length!==1||members.some(p=>p.key!==current&&p.role.startsWith('led-')))return {anchors:[],total,keys:[...keys]};
   const p=candidates[0];if(seen.has(p.component.id))break;
   seen.add(p.component.id);total+=resistance(p.component);current=`${p.component.id}:${p.id==='A'?'B':'A'}`;
  }
  return {anchors:[],total,keys:[...keys]};
 }
 for(const c of state.components.filter(c=>c.kind==='led')){
  const ref=`${c.id}:A`,a=trace(ref),k=trace(`${c.id}:K`),keys=[...new Set([...a.keys,...k.keys])];
  const gpio=a.anchors.filter(p=>p.role==='gpio'||p.role==='input'),kGPIO=k.anchors.filter(p=>p.role==='gpio'||p.role==='input');
  let usable=false;
  if(net(ref).some(p=>p.key===`${c.id}:K`))add('error','led-shorted',`${c.name}: обидві ніжки потрапили в одну з’єднану групу breadboard. Перестав одну ніжку в інший номер або через центральну канавку.`,keys);
  else if(a.anchors.some(p=>p.role==='ground')&&kGPIO.length)add('error','led-polarity',`${c.name}: світлодіод розвернутий. Для цього прикладу A — до GPIO через резистор, K — до GND.`,keys);
  else if(!a.anchors.length||!k.anchors.length)add('incomplete','led-circuit',`${c.name}: з’єднай GPIO → резистор → A, а K → GND. Резистор також може стояти між K і GND. Кожен LED має свій послідовний резистор.`,keys);
  else if(gpio.length!==1||a.anchors.some(p=>!['gpio','input'].includes(p.role))||!k.anchors.every(p=>p.role==='ground'))add('error','led-source',`${c.name}: для цієї вправи потрібні один GPIO на стороні A та GND на стороні K.`,keys);
  else if(gpio[0].role==='input')add('error','led-input',`${c.name}: GPIO${gpio[0].gpio} — лише вхід. Обери вихідний GPIO для блимання.`,keys);
  else if(a.total+k.total===0)add('error','led-resistor',`${c.name}: додай резистор послідовно зі світлодіодом. Почни з 330 Ом.`,keys);
  else{usable=true;if(a.total+k.total<220)add('unknown','led-resistance',`${c.name}: опір ${a.total+k.total} Ом. Звір струм за параметрами свого LED; початковий номінал у конструкторі — 330 Ом.`,keys);}
  if(usable&&a.total+k.total>10000)add('unknown','led-dim',`${c.name}: великий опір — світло може бути дуже слабким.`,keys);
  if(usable&&existingIssues.some(i=>i.severity==='error'&&i.keys.some(key=>keys.includes(key))))usable=false;
  bindings.push({ref,label:c.name,gpio:usable?gpio[0].gpio:null,role:'led',available:usable,keys});
 }
 return bindings;
}

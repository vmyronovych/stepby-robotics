import {boardPins} from './usb-pins.js';
// Explain rejected connections without treating unsuitable GPIOs as
// usable bindings. Compilation continues to use analyzeWiring's available flag.
export function unavailableConnections(state,analysis){
 return analysis.bindings.filter(b=>!b.available).flatMap(b=>{
  const terminals=[...new Map((b.keys||[b.ref]).flatMap(key=>analysis.net(key)).map(t=>[t.key,t])).values()],keys=new Set(terminals.map(t=>t.key));
  if(!state.wires.some(w=>keys.has(w.a)||keys.has(w.b))&&b.role!=='led')return [];
  const gpios=[...new Set(terminals.filter(t=>['gpio','input','breakout'].includes(t.role)&&Number.isInteger(t.gpio)).map(t=>t.gpio))];
  const messages=[];
  if(b.role!=='fault')for(const gpio of gpios)if(boardPins.some(p=>p.gpio===gpio&&p.kind==='input'))messages.push(`GPIO${gpio} — лише вхід. Для керування потрібен вихідний GPIO.`);
  const errors=analysis.issues.filter(i=>i.severity==='error'&&i.keys.some(k=>keys.has(k)));
  for(const issue of errors)if(issue.code!=='input-only'||!messages.some(m=>m.includes('лише вхід')))messages.push(issue.message);
  if(!messages.length){const issue=analysis.issues.find(i=>i.severity==='incomplete'&&i.keys.some(k=>keys.has(k)));messages.push(issue?.message||'Немає з’єднання з придатним GPIO. Перевір контакти цього проводу.');}
  return [{...b,connectedGpio:gpios.length===1?gpios[0]:null,messages:[...new Set(messages)]}];
 });
}
export function wrapWiringMessage(text,max=34){
 const lines=[];let line='';for(const word of text.split(/\s+/)){if(line&&(line+' '+word).length>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;
}

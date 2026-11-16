// Four-band resistor coding: two digits, multiplier, gold ±5%.
// Reference: https://www.vishay.com/docs/49411/resistor_color_code_calculator.pdf
export const BAND_COLORS=[['Чорна','#222222'],['Коричнева','#744329'],['Червона','#c93630'],['Помаранчева','#ed852b'],['Жовта','#e9c93c'],['Зелена','#398b50'],['Синя','#316db9'],['Фіолетова','#83559d'],['Сіра','#8a8e90'],['Біла','#eeeae2']];
export const GOLD=['Золота','#c8a345'];
const E24=[10,11,12,13,15,16,18,20,22,24,27,30,33,36,39,43,47,51,56,62,68,75,82,91];
export const RESISTANCES=[...Array.from({length:5},(_,power)=>E24.map(n=>n*10**power)).flat(),1_000_000];
export const LED_COLORS={red:{name:'Червоний',color:'#d93835',light:'#ffaaa0',dark:'#851c24'},yellow:{name:'Жовтий',color:'#e8bb25',light:'#fff1a0',dark:'#917317'},green:{name:'Зелений',color:'#38a764',light:'#a4ebad',dark:'#165b39'}};
export const resistance=c=>c.resistance??330;
export const ledColor=c=>c.ledColor??'red';
export const formatResistance=value=>`${String(value>=1e6?value/1e6:value>=1000?value/1000:value).replace('.',',')} ${value>=1e6?'МОм':value>=1000?'кОм':'Ом'}`;
export function resistorBands(value){
 if(!RESISTANCES.includes(value))throw Error('Обери опір зі списку номіналів.');
 const exponent=Math.floor(Math.log10(value))-1,digits=Math.round(value/10**exponent);
 return [BAND_COLORS[Math.floor(digits/10)],BAND_COLORS[digits%10],BAND_COLORS[exponent],GOLD];
}
export const PART_LAYOUTS={
 resistor:{width:110,height:60,grip:{x:33.4,y:19.2,width:43.2,height:21.6},pins:{A:{x:19,y:30,side:'left'},B:{x:91,y:30,side:'right'}}},
 led:{width:60,height:84,grip:{x:10.2,y:10,width:35.6,height:38.6},pins:{A:{x:21,y:12,side:'bottom'},K:{x:39,y:12,side:'bottom'}}},
};
export function teachingPartSvg(c){
 const resistor=c.kind==='resistor',layout=PART_LAYOUTS[c.kind];
 const metal='<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6b777c"/><stop offset=".35" stop-color="#edf0ec"/><stop offset=".65" stop-color="#a8b3b5"/><stop offset="1" stop-color="#657278"/></linearGradient>';
 let body;
 if(resistor){
  const bands=resistorBands(resistance(c));
  body=`<defs>${metal}<linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e6c991"/><stop offset=".35" stop-color="#f6e2b9"/><stop offset="1" stop-color="#b49562"/></linearGradient><clipPath id="shape"><path d="M59 32Q53 32 53 41V59Q53 68 62 68H73L81 64H139L147 68H158Q167 68 167 59V41Q167 32 158 32H147L139 36H81L73 32Z"/></clipPath></defs><path d="M15 50H205" stroke="#627176" stroke-width="5"/><path d="M15 49H205" stroke="#d8dedd" stroke-width="3"/><path d="M59 32Q53 32 53 41V59Q53 68 62 68H73L81 64H139L147 68H158Q167 68 167 59V41Q167 32 158 32H147L139 36H81L73 32Z" fill="url(#body)" stroke="#8c764f" stroke-width="1"/><g clip-path="url(#shape)">${bands.map(([name,color],i)=>`<rect x="${[64,87,110,148][i]}" y="31" width="9" height="38" fill="${color}"><title>${name}</title></rect>`).join('')}<path d="M56 40H164" stroke="white" opacity=".2" stroke-width="2"/></g>`;
 }else{
  const color=LED_COLORS[ledColor(c)];
  body=`<defs>${metal}<linearGradient id="lens" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${color.dark}"/><stop offset=".3" stop-color="${color.light}"/><stop offset=".65" stop-color="${color.color}"/><stop offset="1" stop-color="${color.dark}"/></linearGradient></defs><path d="M55 85V160M95 85V160" stroke="#707e84" stroke-width="5"/><path d="M54 85V160M94 85V160" stroke="#e1e5e1" stroke-width="2"/><path d="M40 98V57A35 35 0 0 1 110 57V98Z" fill="url(#lens)" fill-opacity=".88" stroke="${color.dark}" stroke-width="1.5"/><path d="M55 98V73H64M95 98V70H81L76 77H67" fill="none" stroke="#bfcac7" stroke-width="4"/><path d="M64 73Q73 52 81 70" fill="none" stroke="#efe8a7" stroke-width="1"/><path d="M35 98H109V108H35Q31 103 35 98Z" fill="${color.color}" stroke="${color.dark}" stroke-width="1.5"/><path d="M48 63V56Q48 37 63 32" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" opacity=".55"/><text x="39" y="158" text-anchor="end" font-family="Arial" font-size="11" fill="#406955">A</text><text x="108" y="158" font-family="Arial" font-size="11" fill="#406955">K</text>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}">${resistor?`<g transform="translate(13.3157894737 0) scale(0.378947368421 0.6)">${body}</g>`:`<g transform="translate(-3.75 0) scale(0.45)">${body}</g>`}</svg>`;
}

// 170-point mini board: 17 independent columns, two isolated groups of five.
export const BREADBOARD={width:270,height:202};
export const BREADBOARD_PINS=Array.from({length:10},(_,row)=>Array.from({length:17},(_,column)=>({
 id:`${String.fromCharCode(65+row)}${column+1}`,group:`${row<5?'AE':'FJ'}${column+1}`,row,column,
 x:39+column*12,y:BREADBOARD.height-(29+row*12+(row>=5?36:0)),side:row<5?'top':'bottom',
}))).flat();
export function breadboardSvg(){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREADBOARD.width} ${BREADBOARD.height}"><defs><linearGradient id="plastic" x2="0" y2="1"><stop stop-color="#fffefb"/><stop offset="1" stop-color="#e1e2de"/></linearGradient><linearGradient id="hole" x2="0" y2="1"><stop stop-color="#b8bfbd"/><stop offset="1" stop-color="#f7f8f5"/></linearGradient></defs>
 <path d="M7 8H260V191H7Z" fill="#c3c9c5"/><rect x="5" y="4" width="256" height="184" rx="4" fill="url(#plastic)" stroke="#c3cac5"/><path d="M7 187H259V193H7Z" fill="#cbd0cb"/><path d="M92 188h17v8H92M261 60h7v17h-7M261 132h7v17h-7" fill="#e0e3dd" stroke="#c3cac5"/>
 <rect x="55" y="89" width="156" height="26" rx="2" fill="#c5ccc8"/><path d="M57 112V91H209" fill="none" stroke="#fdfefa" stroke-width="3"/><path d="M57 113H209V91" fill="none" stroke="#adb7b1" stroke-width="2"/>
 ${[36,231].map(x=>`<circle cx="${x}" cy="102" r="8" fill="#c8ceca" stroke="#edf0ea" stroke-width="2"/><circle cx="${x}" cy="103" r="5" fill="#b7bfba"/>`).join('')}
 ${BREADBOARD_PINS.map(p=>{const y=BREADBOARD.height-p.y;return `<rect x="${p.x-3.8}" y="${y-3.8}" width="7.6" height="7.6" rx=".7" fill="url(#hole)"/><rect x="${p.x-1.6}" y="${y-1.6}" width="3.2" height="3.2" fill="#697671"/>`;}).join('')}
 <g font-family="Arial" font-size="5.5" fill="#79877e" text-anchor="middle">${Array.from({length:17},(_,i)=>`<text x="${39+i*12}" y="17">${i+1}</text>`).join('')}${Array.from({length:10},(_,i)=>`<text x="22" y="${31+i*12+(i>=5?36:0)}">${String.fromCharCode(65+i)}</text>`).join('')}</g></svg>`;
}

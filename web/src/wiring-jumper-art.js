import {EXPANSION_JUMPER,jumperCenter} from './assembly/expansion-jumper.js';
import {physicalLayout} from './wiring-physical.js';

// Native SVG stays sharp at canvas zoom and device pixel ratios; the board
// thumbnail omits this detail so there is no blurred copy underneath.
export function jumperArt(component){
 const layout=physicalLayout({...component,rotation:0});
 const point=(x,y)=>{const p=layout.project(x,y);return {x:p.x,y:p.y-layout.header};};
 const {x,top,pitch}=EXPANSION_JUMPER,center=jumperCenter(component),cap=point(center.x,center.y),first=point(x,top),last=point(x,top-2*pitch);
 const posts=[0,1,2].map(i=>point(x,top-i*pitch));
 return `<svg class="wiring-jumper-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.imageWidth} ${layout.imageOriginalHeight}" aria-hidden="true">
 <rect x="${first.x-8}" y="${first.y-8}" width="16" height="${last.y-first.y+16}" rx="1.4" fill="#171c20" stroke="#343b40" stroke-width="1"/>
 ${posts.map(p=>`<rect x="${p.x-2}" y="${p.y-2}" width="4" height="4" fill="#c5cbd0" stroke="#707a80" stroke-width=".6"/><path d="M${p.x-1.5} ${p.y+1.5}v-3h3" fill="none" stroke="#f1f4ee" stroke-width=".7"/>`).join('')}
 <rect x="${cap.x-9}" y="${cap.y-16}" width="18" height="32" rx="1.6" fill="#d2ae24" stroke="#735d19" stroke-width=".8"/>
 <path d="M${cap.x-8} ${cap.y+15}v-30h16" fill="none" stroke="#f8df65" stroke-width="1.5"/>
 <rect x="${cap.x-4.5}" y="${cap.y-11.5}" width="9" height="23" rx=".8" fill="#22292b" stroke="#a88c26" stroke-width=".7"/>
 ${posts.filter(p=>Math.abs(p.y-cap.y)<12).map(p=>`<rect x="${p.x-2.3}" y="${p.y-2.3}" width="4.6" height="4.6" fill="#bdc5c6"/><path d="M${p.x-1.8} ${p.y+1.8}v-3.6h3.6" fill="none" stroke="#edf1ec" stroke-width=".7"/>`).join('')}
 <g fill="#f4f2ed" font-family="Arial, sans-serif" font-size="9" font-weight="600" text-anchor="end">
 ${['3.3V','V','5V'].map((label,i)=>`<text x="${first.x-13}" y="${posts[i].y+3}">${label}</text>`).join('')}
 </g><text x="${first.x}" y="${last.y+22}" fill="#f4f2ed" font-family="Arial, sans-serif" font-size="9" font-weight="600" text-anchor="middle">JUMP</text>
 </svg>`;
}

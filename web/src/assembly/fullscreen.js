// Shared presentation mode. Browsers without the Fullscreen API still get a
// viewport-sized model with the same exit button and keyboard controls.
export function initModelFullscreen(target, button){
 let fallback=false,active=false,busy=false,previousOverflow='',previousFocus=null;
 let lastExit=-Infinity,revision=0;
 const dialog=target.closest('dialog');
 button.setAttribute('aria-controls',target.id);
 button.setAttribute('aria-pressed','false');
 function sync(){
  const next=fallback||document.fullscreenElement===target;
  if(next!==active){
   if(next){
    previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
   }else{
    document.body.style.overflow=previousOverflow;lastExit=performance.now();
   }
   active=next;target.classList.toggle('model-fullscreen',active);
   button.textContent=active?'⛶ Вийти з повного екрана':'⛶ На весь екран';
   button.setAttribute('aria-pressed',String(active));
   if(active)button.focus({preventScroll:true});
   else if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
 }
 async function exit(){
  revision++;fallback=false;
  if(document.fullscreenElement===target){
   try{await document.exitFullscreen()}catch{/* Keep the visible exit control if the browser refuses. */}
  }
  sync();
 }
 async function toggle(){
  if(busy)return;
  if(active){await exit();return;}
  const attempt=++revision;busy=true;
  try{
   if(!target.requestFullscreen||!document.fullscreenEnabled)throw Error('Use viewport mode');
   await target.requestFullscreen();
  }catch{
   if(attempt===revision)fallback=true;
  }finally{
   busy=false;
   if(attempt!==revision){if(document.fullscreenElement===target)await exit();}
   else sync();
  }
 }
 button.addEventListener('click',toggle);
 document.addEventListener('fullscreenchange',sync);
 document.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();void exit();
  }else if(event.key==='Tab'){
   const controls=[...target.querySelectorAll('button,input,select,a[href],[tabindex]')]
    .filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!target.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!target.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
 },true);
 // Esc exits the presentation before it can close the assembly dialog.
 dialog?.addEventListener('cancel',event=>{
  if(active||performance.now()-lastExit<300){event.preventDefault();void exit();}
 });
 dialog?.addEventListener('close',()=>{void exit();});
 return {exit,get active(){return active}};
}

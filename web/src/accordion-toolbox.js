import {Blockly} from './blocks.js';
import './accordion-toolbox.css';

// Keep Blockly's real flyout blocks and native drag-to-connect behavior, but
// place its SVG in the selected category's document flow instead of over canvas.
class AccordionFlyout extends Blockly.VerticalFlyout{
 createDom(tag){const svg=super.createDom(tag);svg.classList.add('accordion-flyout');return svg;}
 getFlyoutScale(){
  const width=this.targetWorkspace?.getToolbox()?.getWidth()||272;
  const widest=Math.max(1,...this.getContents().map(i=>i.getElement().getBoundingRectangle().getWidth()));
  return Math.min(.8,(width-28)/(widest+24));
 }
 getX(){return 0;}
 getY(){return 0;}
 layout_(contents){
  super.layout_(contents);
  this.commandPadding=0;this.layoutActions();
 }
 layoutActions(){
  const padding=Math.max(0,36/this.getFlyoutScale()-48),delta=padding-(this.commandPadding||0);let extra=0;
  for(const item of this.getContents()){const element=item.getElement();element.moveBy(0,extra);if(element.type==='my_block_call')extra+=delta;}
  this.commandPadding=padding;
 }
 position(){
  if(!this.isVisible()||!this.targetWorkspace?.isVisible())return;
  const width=this.targetWorkspace.getToolbox().getWidth();
  const bottom=Math.max(0,...this.getContents().map(i=>i.getElement().getBoundingRectangle().bottom));
  this.width_=width;this.height_=Math.ceil((bottom+20)*this.workspace_.scale);
  this.svgBackground_.setAttribute('d',`M0 0H${width}V${this.height_}H0Z`);
  this.positionAt_(width,this.height_,0,0);
  this.workspace_.scrollbar?.setVisible(false);
 }
 reflowInternal_(){this.layoutActions();super.reflowInternal_();this.position();this.addCommandActions();}
 wheel_(e){e.stopPropagation();const sidebar=this.targetWorkspace.getToolbox().HtmlDiv;sidebar.scrollTop+=e.deltaY;e.preventDefault();}
 autoHide(){} // Collapse only by choosing a category, not by working on canvas.
 addCommandActions(){
  const scale=this.workspace_.scale;
  for(const b of this.workspace_.getTopBlocks(false)){
   if(b.type!=='my_block_call')continue;
   const existing=b.getSvgRoot().querySelector('.command-row-actions');
   if(existing){
    existing.setAttribute('width',String((this.width_-28)/scale));existing.setAttribute('height',String(30/scale));existing.querySelector('.command-hover-actions').style.transform=`scale(${1/scale})`;
    const zone=b.getSvgRoot().querySelector('.command-hover-zone');zone.setAttribute('width',String((this.width_-28)/scale));zone.setAttribute('height',String(b.getHeightWidth().height+33/scale));continue;
   }
   const zone=document.createElementNS('http://www.w3.org/2000/svg','rect');zone.classList.add('command-hover-zone');
   zone.setAttribute('width',String((this.width_-28)/scale));zone.setAttribute('height',String(b.getHeightWidth().height+33/scale));zone.setAttribute('fill','transparent');
   b.getSvgRoot().prepend(zone);
   const row=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');row.classList.add('command-row-actions');
   row.setAttribute('x','0');row.setAttribute('y',String(b.getHeightWidth().height+3));row.setAttribute('width',String((this.width_-28)/scale));row.setAttribute('height',String(30/scale));
   const actions=document.createElement('div');actions.className='command-hover-actions';actions.style.transform=`scale(${1/scale})`;actions.style.transformOrigin='top left';
   const name=b.getFieldValue('NAME');
   for(const [key,label,icon]of [['EDIT','Редагувати','<path d="m4 16-1 5 5-1L20 8l-4-4L4 16zm10-10 4 4"/>'],['DUPLICATE','Дублювати','<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>']]){
    const button=document.createElement('button');button.type='button';button.title=`${label}: ${name}`;button.setAttribute('aria-label',`${label}: ${name}`);button.dataset.commandAction=key.toLowerCase();
    button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${icon}</svg>`;
    button.addEventListener('pointerdown',e=>{e.stopPropagation();});
    button.addEventListener('keydown',e=>e.stopPropagation());
    button.addEventListener('click',e=>{e.stopPropagation();this.targetWorkspace.getButtonCallback(`MCAR_${key}_${b.definitionId}`)?.();});
    actions.append(button);
   }
   row.append(actions);b.getSvgRoot().append(row);
  }
 }
}
class AccordionToolbox extends Blockly.Toolbox{
 createContainer_(){const div=super.createContainer_();div.classList.add('accordion-toolbox');return div;}
 init(){
  super.init();
  this.flyoutDom=this.getFlyout().svgGroup_;
  this.HtmlDiv.append(this.flyoutDom);
  this.resizeObserver=new ResizeObserver(()=>{if(this.HtmlDiv?.isConnected){this.position();this.getFlyout().reflow();Blockly.svgResize(this.workspace_);}});
  this.resizeObserver.observe(this.HtmlDiv);
 }
 onClick_(e){if(e.target.closest('.accordion-flyout'))return;super.onClick_(e);}
 onKeyDown_(e){if(e.target.closest('.accordion-flyout'))return;super.onKeyDown_(e);}
 autoHide(){}
 updateFlyout_(oldItem,newItem){
  for(const item of this.getToolboxItems())item.getDiv()?.setAttribute('aria-expanded',String(item===newItem));
  const host=newItem?.getDiv();
  if(host&&this.flyoutDom)host.append(this.flyoutDom);
  super.updateFlyout_(oldItem,newItem);
  this.getFlyout().position();
 }
 dispose(){this.resizeObserver?.disconnect();super.dispose();}
}
export const accordionPlugins={toolbox:AccordionToolbox,flyoutsVerticalToolbox:AccordionFlyout};

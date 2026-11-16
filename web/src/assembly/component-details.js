import {COMPONENTS} from './components.js';
import {createModuleViewer} from './module-viewer.js';

const icons={brain:'🧠',motor:'⚙',battery:'🔋',ground:'⏚',moon:'☾',alert:'!',chip:'▦',eye:'◉'};
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
const option=(label,value)=>{const node=el('option',label);node.value=value;return node;};
export function initComponentDetails(host,{onClose=()=>{},onNavigate=()=>{},createViewer=createModuleViewer}={}){
 const panel=el('section',null,'component-panel');panel.dataset.componentPanel='';panel.hidden=true;panel.setAttribute('aria-labelledby','componentTitle');
 panel.innerHTML='<header class="component-header"><button type="button" data-back>← До машинки</button><span data-crumb></span></header><div class="component-body"></div>';
 host.append(panel);const body=panel.querySelector('.component-body');let previousFocus=null,viewer=null;
 function disposeViewer(){viewer?.dispose();viewer=null;}
 function close({restoreFocus=false}={}){if(panel.hidden)return;disposeViewer();panel.hidden=true;if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
 function back(){close({restoreFocus:true});onClose();}panel.querySelector('[data-back]').onclick=back;
 function open(id){
  const c=COMPONENTS[id];if(!c)return;if(panel.hidden)previousFocus=document.activeElement;disposeViewer();
  panel.hidden=false;panel.dataset.component=id;panel.querySelector('[data-crumb]').textContent=`Машинка / ${id==='30P'?'38P':id}`;body.replaceChildren();body.scrollTop=0;
  const title=el('h2',c.title);title.id='componentTitle';body.append(title,el('p',c.subtitle,'component-subtitle'));
  const detail=el('section',null,'component-pin-detail');detail.setAttribute('aria-live','polite');
  detail.append(el('span','☝','pin-intro-icon'),el('strong',c.pins.length?'Торкнися контакту':'Роздивись деталь'),el('p',c.summary));
  const select=el('select');select.setAttribute('aria-label','Знайти контакт');select.dataset.pinPicker='';select.append(option('Знайти контакт…',''));
  for(const group of new Set(c.pins.map(p=>p.group))){const optgroup=el('optgroup');optgroup.label=group;for(const p of c.pins.filter(p=>p.group===group))optgroup.append(option(p.label||p.name,p.name));select.append(optgroup);}
  function selectPin(name){
   const pin=c.pins.find(p=>p.name===name);if(!pin)return;viewer?.select(name);select.value=name;
   const route=el('div',null,'pin-route');route.dataset.direction=pin.direction||'out';route.style.setProperty('--route-color',pin.color||'#438ba9');
   const from=el('strong',pin.label||pin.name,'pin-route-source'),wire=el('span',null,'pin-route-wire'),target=el(pin.target?'button':'div',null,'pin-route-target');
   if(pin.target){target.type='button';target.onclick=()=>onNavigate(pin.target);target.setAttribute('aria-label',`Відкрити ${pin.destination}`);}
   const icon=el('span',icons[pin.icon]||'◉','pin-route-icon');icon.setAttribute('aria-hidden','true');target.append(icon,el('span',pin.destination||pin.connection));route.append(from,wire,target);
   detail.replaceChildren(route,el('strong',pin.role),el('p',pin.short||pin.connection));
   if(pin.pair)detail.append(el('small',pin.pair.join(' + ')+' → один мотор','pin-pair'));
   for(const button of body.querySelectorAll('.component-pin-group button'))button.setAttribute('aria-pressed',String(button.dataset.pin===name));
   for(const row of body.querySelectorAll('[data-pin-row]'))row.classList.toggle('selected',row.dataset.pinRow===name);
   const technical=body.querySelector('[data-pin-technical]');if(technical)technical.textContent=`${pin.label||pin.name}: ${pin.connection}. ${pin.note||''}`;
  }
  select.onchange=()=>selectPin(select.value);
  if(c.model){
   const explorer=el('div',null,'module-explorer'),visual=el('div',null,'module-visual'),stage=el('div',null,'module-stage');stage.dataset.model=c.model;
   const tools=el('div',null,'module-tools');tools.setAttribute('aria-label','Ракурс модуля');
   for(const [view,label]of [['iso','Об’єм'],['front','Зверху'],['back','Зі звороту']]){const b=el('button',label);b.type='button';b.dataset.moduleView=view;b.onclick=()=>viewer?.view(view);tools.append(b);}
   for(const [factor,label]of [[1/1.25,'−'],[1.25,'+']]){const b=el('button',label);b.type='button';b.setAttribute('aria-label',factor>1?'Наблизити модуль':'Віддалити модуль');b.onclick=()=>viewer?.zoom(factor);tools.append(b);}
   visual.append(stage,tools,el('small','Обертай · наближай · натискай контакти','module-gesture'));
   const side=el('div',null,'module-info');side.append(detail,select);
   if(c.model==='expansion'){
    const filter=el('select');filter.setAttribute('aria-label','Показати ряд контактів');for(const [value,label]of [['Ряд S','S · сигнали'],['Ряд V','V · живлення'],['Ряд G','G · земля'],['Гнізда ESP32','Гнізда ESP32'],['','Усі контакти']])filter.append(option(label,value));
    filter.onchange=()=>viewer?.filter(filter.value);select.onchange=()=>{const pin=c.pins.find(p=>p.name===select.value);if(pin){filter.value=pin.group;viewer?.filter(pin.group);selectPin(pin.name);}};side.append(filter);
   }
   explorer.append(visual,side);body.append(explorer);viewer=createViewer(stage,c,selectPin);if(stage.dataset.renderMode==='2d'){for(const button of tools.querySelectorAll('button'))button.disabled=true;visual.querySelector('.module-gesture').textContent='Вибирай контакт на карті або зі списку';}if(c.model==='expansion')viewer.filter('Ряд S');
  }else{
   body.append(el('p',c.summary));if(c.pins.length){const grid=el('div',null,'component-pin-groups');for(const group of new Set(c.pins.map(p=>p.group))){const section=el('section',null,'component-pin-group');section.append(el('h4',group));for(const p of c.pins.filter(p=>p.group===group)){const b=el('button',p.label||p.name);b.type='button';b.dataset.pin=p.name;b.setAttribute('aria-pressed','false');b.onclick=()=>selectPin(p.name);section.append(b);}grid.append(section);}body.append(grid,detail);}
  }
  const teacher=el('details',null,'component-teacher');teacher.append(el('summary','Для вчителя · підключення та джерела'));
  const facts=el('ul',null,'component-facts');for(const fact of c.facts)facts.append(el('li',fact));teacher.append(facts);
  if(c.diagramNote)teacher.append(el('p',c.diagramNote));const technical=el('p',null,'pin-technical');technical.dataset.pinTechnical='';teacher.append(technical);
  if(c.pins.length){const wrap=el('div',null,'component-table-wrap'),table=el('table');table.append(el('caption','Усі контакти'));const thead=el('thead'),tr=el('tr');for(const text of ['Контакт','Призначення','Підключення в машинці']){const th=el('th',text);th.scope='col';tr.append(th);}thead.append(tr);table.append(thead);const tbody=el('tbody');for(const p of c.pins){const row=el('tr');row.dataset.pinRow=p.name;const th=el('th',p.label||p.name);th.scope='row';row.append(th,el('td',p.role),el('td',p.connection));tbody.append(row);}table.append(tbody);wrap.append(table);teacher.append(wrap);}
  const notes=el('ul',null,'component-notes');for(const note of c.notes)notes.append(el('li',note));teacher.append(notes);
  if(c.source){const link=el('a',c.source.label+' ↗');link.href=c.source.url;link.target='_blank';link.rel='noopener';teacher.append(link);}body.append(teacher);
  if(c.related.length){const links=el('div',null,'component-related');links.setAttribute('aria-label','Пов’язані компоненти');for(const key of c.related){const b=el('button',COMPONENTS[key].title);b.type='button';b.dataset.related=key;b.onclick=()=>onNavigate(key);links.append(b);}body.append(links);}
  panel.querySelector('[data-back]').focus({preventScroll:true});
 }
 document.addEventListener('keydown',event=>{if(panel.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();back();}else if(event.key==='Tab'){event.stopImmediatePropagation();const controls=[...panel.querySelectorAll('button,a[href],select,summary,canvas[tabindex]')].filter(e=>!e.disabled&&e.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first?.focus();}}},true);
 return {open,close,get isOpen(){return !panel.hidden},panel};
}

// One visible task at a time. Existing flash controls move into the setup screen
// so status, retry actions and logs have a single owner throughout onboarding.
export function initConnectionScreen({choose,retry,skip,resized,install}){
 const $=id=>document.getElementById(id),screen=$('connectionScreen'),app=$('app');
 const card=$('flashCard'),log=document.querySelector('.usb-log');
 const cardHome=document.createComment('flash-card'),logHome=document.createComment('usb-log');
 card.before(cardHome);log.before(logHome);
 let action=choose,previous='';
 $('connectionAction').onclick=()=>action();
 $('connectionSkip').onclick=skip;
 $('connectionReselect').onclick=choose;
 $('connectionInstall').onclick=install;
 return ({state,message='',multiple=false,working=false,lost=false})=>{
  const editor=state==='editor',setup=['setup','transferring'].includes(state);
  screen.hidden=editor;app.hidden=!editor;app.inert=!editor;screen.dataset.step=state;
  $('connectionJob').hidden=!setup;
  $('connectionRecovery').hidden=state!=='error';
  $('connectionDiagnostics').hidden=!['error','setup'].includes(state)||!$('connectionDiagnosticText').textContent;
  $('connectionReselect').disabled=$('connectionInstall').disabled=working;
  const canSkip=!working&&['cable','error','unsupported','setup'].includes(state);
  $('connectionSkip').hidden=$('connectionSkipHint').hidden=!canSkip;
  if(setup){if(card.parentNode!==$('connectionJob'))$('connectionJob').append(card,log);}else if(card.parentNode!==cardHome.parentNode){cardHome.after(card);logHome.after(log);}
  const copy={
   scanning:['ПІДКЛЮЧЕННЯ','Знайомимося з твоєю платою','Перевіряємо доступні USB-плати…','',''],
   cable:['КРОК 1 · КАБЕЛЬ',lost?'Повернімо зв’язок':'Підключи свою ESP32',lost?'Під’єднай кабель знову. Твої блоки збережено.':'Маленький кінець micro-USB — у плату. Інший — у комп’ютер.',multiple?'Обрати свою ESP32':'Кабель підключено — обрати ESP32','Першого разу браузер попросить вибрати USB Serial / CP210x. Уже дозволену плату знайдемо автоматично.'],
   permission:['КРОК 2 · ДОЗВІЛ','Обери ESP32 у вікні браузера','Знайди USB Serial / CP210x і натисни «Підключити».','','Вибір плати не змінює її програму.'],
   checking:['КРОК 2 · ЗНАЙОМСТВО','Плату знайдено','Перевіряємо, чи готова вона до твоїх блоків.','','Поточна програма залишається на платі.'],
   transferring:['БЛОКИ → ESP32','Передаємо твою програму','Залиш USB підключеним. Після завершення повернемося до блоків.','',''],
   setup:['БАЗОВА ПРОШИВКА','Встановлення — окрема дія','Це не перевірка USB: встановлення замінить програму на платі.','',''],
   error:['ПІДКЛЮЧЕННЯ','Відновімо зв’язок',message,'Перевірити підключення','Закрий інші програми, що використовують USB-порт. Твої блоки збережено.'],
   unsupported:['ПОТРІБЕН USB-ДОСТУП','Відкрий у Chrome або Edge','Для підключення ESP32 потрібен настільний Chrome або Edge та адреса HTTPS або localhost.','','Якщо це шкільний комп’ютер, учитель допоможе перевірити доступ до USB.'],
  }[state];
  if(copy){const [step,title,description,button,hint]=copy;
   $('connectionStep').textContent=step;$('connectionTitle').textContent=title;
   const text=state==='cable'&&message?message:description;
   if($('connectionDescription').textContent!==text)$('connectionDescription').textContent=text;
   $('connectionAction').hidden=!button;$('connectionAction').textContent=button;$('connectionAction').disabled=working;
   $('connectionHint').textContent=hint;$('connectionHint').hidden=!hint;
  }
  action=state==='error'?retry:choose;
  $('connectionHelp').hidden=!['cable','error','unsupported'].includes(state);
  $('connectionVisualNote').textContent=state==='setup'?'Знайди напис BOOT біля USB-роз’єму':['checking','permission'].includes(state)?'ESP32 · 38 контактів':'Кабель має передавати дані, а не лише заряджати';
  if(previous!==state){
   const wasEditor=previous==='editor';previous=state;
   if(editor)requestAnimationFrame(resized);
   else if(wasEditor||state==='setup'||state==='error')requestAnimationFrame(()=>$('connectionTitle').focus({preventScroll:true}));
   if(!editor){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
  }
 };
}

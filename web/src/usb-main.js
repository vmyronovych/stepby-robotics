import {accordionPlugins} from './accordion-toolbox.js';
import {initBlockSelection} from './block-selection.js';
import {initWiringEditor} from './wiring-editor.js';
import {initMyBlocks} from './my-blocks-editor.js';
import './style.css';
import './usb.css';
import {Blockly,usbToolbox,usbExamples} from './usb-blocks.js';
import {compileUsb} from './usb-compiler.js';
import {compileUsbBytecode} from './usb-bytecode.js';
import {initPinEditor} from './usb-pin-editor.js';
import {validatePinState} from './usb-pins.js';
import {initConnectionScreen} from './usb-connection-screen.js';
import {probeRuntime} from './runtime-upload.js';
import {usbDiagnostic} from './usb-diagnostics.js';
import {initUsbConsole} from './usb-console.js';
import './usb-console.css';
const browserMode=new URLSearchParams(location.search).get('transport')!=='local';
const base=import.meta.env.BASE_URL;
const browserPorts=new Map();
let chosenPort=null,choosingPort=false;
let flasherLoadError=false;
let installingRuntime=false;
let wakePending=false;
let connectionKnown=false,boardState='idle',boardCheckError='',boardLost=false,checkingBoard=false,boardEpoch=0;
const supported=()=>!!navigator.serial&&window.isSecureContext;
const EDITOR_ACCESS='mandrivnyk-editor-without-board';
let editWithoutBoard=false;
try{editWithoutBoard=sessionStorage.getItem(EDITOR_ACCESS)==='true';}catch{}
function setEditorAccess(value){editWithoutBoard=value;try{sessionStorage.setItem(EDITOR_ACCESS,String(value));}catch{}}
const offlineEditor=()=>browserMode&&editWithoutBoard&&boardState!=='ready';

const $=id=>document.getElementById(id),STORE='mandrivnyk-usb-v1';
const usbConsole=initUsbConsole($('usbConsole'),{onConnectionError:consoleConnectionLost});
const theme=Blockly.Theme.defineTheme('usb-workshop',{base:Blockly.Themes.Classic,fontStyle:{family:'Arial, sans-serif',size:15},componentStyles:{workspaceBackgroundColour:'#fff',toolboxBackgroundColour:'#fafbf9',flyoutBackgroundColour:'#f3f5f1',scrollbarColour:'#cbd5ca'}});
const workspace=Blockly.inject('blocklyDiv',{toolbox:usbToolbox,plugins:accordionPlugins,theme,renderer:'zelos',media:base+'media/',sounds:false,trashcan:true,scrollbars:true,grid:{spacing:24,length:2,colour:'#e3e8df'},zoom:{controls:true,wheel:true,startScale:innerWidth<760?.6:1,maxScale:1.8,minScale:.5},move:{drag:true,wheel:true,scrollbars:true}});
new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('blocklyArea'));
let token='',ready=false,ports=[],busy=false,polling=false,submitting=false,lastJob=null,submitted=null,saveTimer,localError='',connectionError='',jobFirstSeen=0;
const showConnection=initConnectionScreen({choose:connectBoard,install:prepareInstallation,skip:()=>{setEditorAccess(true);save();update();notice('Можна створювати блоки й схеми без плати. Для запуску програми підключи ESP32.');},retry:()=>{boardState='idle';boardCheckError='';lastJob=null;localError='';if(chosenPort)void inspectBoard();else void connectBoard();},resized:()=>{Blockly.svgResize(workspace);workspace.scrollCenter();}});
const project=()=>({format:'mandrivnyk-usb',version:1,name:$('projectName').value||'Моя програма',workspace:Blockly.serialization.workspaces.save(workspace)});
const graph=()=>JSON.stringify(project().workspace);
function notice(text){$('notice').textContent=text;}
function diagnostic(stage,message,log='',port=chosenPort){$('connectionDiagnosticText').textContent=usbDiagnostic({stage,message,log,port});}
function consoleConnectionLost(port,error){
 if(port!==chosenPort||boardState!=='ready'||busy||submitting)return;
 boardEpoch++;boardState='error';boardCheckError='USB-зв’язок перервався. Це не означає, що прошивку втрачено. Перепідключи USB та повтори перевірку.';
 diagnostic('читання консолі',error.message,'',port);save();update();
}
function prepareInstallation(){
 if(busy||submitting||checkingBoard)return;
 setEditorAccess(false);boardState='setup';localError='';boardCheckError='';
 renderJob({id:crypto.randomUUID(),phase:'setup-required',mode:'install',finished:true,message:'Ти обрав встановлення базової прошивки. Воно замінить програму на платі тестом блимання; блоки в редакторі залишаться. Якщо плата вже працювала, спочатку перевір USB без запису.'});update();
}
function requestConnectionRecheck(){
 if(!browserMode||!chosenPort){wakePending=false;return;}
 if(busy||submitting||checkingBoard||choosingPort){wakePending=true;return;}
 wakePending=false;boardEpoch++;boardState='idle';boardCheckError='';localError='';lastJob=null;
 diagnostic('відновлення після сну / повернення до вкладки','Закриваємо попередню USB-сесію та перевіряємо плату без запису.');
 save();update();void inspectBoard();
}
function showRemoteConnection(log){
 const match=[...log.matchAll(/REMOTE_WIFI: (Mandrivnyk-[a-f0-9]+) password=([a-f0-9]{12}) http:\/\/192\.168\.4\.1/g)].at(-1);
 if(!match)return;
 $('remoteConnection').hidden=false;
 $('remoteNetwork').textContent=match[1];$('remotePassword').textContent=match[2];
}
initPinEditor({workspace,notice});
initWiringEditor({workspace,notice});
initMyBlocks({workspace,toolbox:usbToolbox,notice});
initBlockSelection(workspace,$('blocklyArea'),{notice});
function save(){try{localStorage.setItem(STORE,JSON.stringify(project()));$('savedLabel').textContent='збережено тут';}catch{$('savedLabel').textContent='збережи у файл';}}
function load(p){if(p?.format!=='mandrivnyk-usb'||p.version!==1||typeof p.name!=='string'||p.name.length>60||!p.workspace)throw Error('Потрібен проєкт USB-майстерні (.mcar).');const raw=JSON.stringify(p.workspace);if(raw.length>100000)throw Error('Файл завеликий.');validatePinState(p.workspace);const temp=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(p.workspace,temp);if(temp.getAllBlocks(false).length>256)throw Error('Максимум 256 блоків.');}finally{temp.dispose();}Blockly.serialization.workspaces.load(p.workspace,workspace);$('projectName').value=p.name;save();workspace.scrollCenter();}
function example(name){const p=usbExamples[name];if(p)load({format:'mandrivnyk-usb',version:1,...p});}
try{const saved=localStorage.getItem(STORE);if(saved)load(JSON.parse(saved));else example('blink');}catch{example('blink');notice('Попередній файл не вдалося відкрити. Завантажено приклад блимання.');}
function update(){
 void usbConsole.setPort(browserMode&&boardState==='ready'&&!installingRuntime?chosenPort:null);
 const validPort=ports.some(p=>p.path===$('usbPort').value),working=busy||submitting,changed=!!submitted&&submitted!==graph();
 $('flashProgram').disabled=!ready||(!browserMode&&!validPort)||working||checkingBoard||choosingPort;
 $('flashProgram').setAttribute('aria-busy',String(working));
 $('flashLabel').textContent=working?'Прошивання триває':flasherLoadError?'Оновити сторінку':offlineEditor()?'Підключити ESP32':lastJob?.phase==='setup-required'?'BOOT затиснуто — встановити':localError||['error','runtime-error'].includes(lastJob?.phase)?'Спробувати ще раз':changed?'Прошити зміни':browserMode&&!chosenPort?'Обрати плату й прошити':'Прошити програму';
 $('flashIcon').textContent='↗';
 $('usbPort').disabled=working||!ports.length;$('refreshUsb').disabled=working;
 $('reinstallRuntime').disabled=working||!ready||(browserMode&&(!chosenPort||checkingBoard));
 $('blockCount').textContent=workspace.getAllBlocks(false).filter(b=>!b.isShadow()).length+' блоків';
 $('changedNote').hidden=!changed;
 $('changedNote').textContent=working?'Можеш редагувати далі. Зараз записуємо попередню версію блоків.':'Є нові зміни в блоках. Проший ще раз, щоб записати їх на плату.';
 if(browserMode&&editWithoutBoard&&!chosenPort){$('usbBadge').textContent=supported()?'Без плати':'USB недоступний';$('usbBadge').className='badge offline';}
 renderStatus();renderConnection();
}
$('fitProgram').onclick=()=>{workspace.zoomToFit();workspace.scrollCenter();};
workspace.addChangeListener(e=>{if(e.isUiEvent)return;localError='';clearTimeout(saveTimer);saveTimer=setTimeout(save,300);update();});$('projectName').oninput=save;$('usbPort').onchange=()=>{if(browserMode){selectBoard(browserPorts.get($('usbPort').value)||null);void inspectBoard();}update();};
function download(){const blob=new Blob([JSON.stringify(project(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=project().name.replace(/[\\/:*?"<>|]/g,'_')+'.mcar';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('saveProject').onclick=download;$('openProject').onclick=()=>$('projectFile').click();$('projectFile').onchange=async()=>{try{const file=$('projectFile').files[0];if(!file)return;if(file.size>120000)throw Error('Файл завеликий.');load(JSON.parse(await file.text()));notice('Проєкт відкрито. Натисни «Прошити», щоб записати його на плату.');}catch(error){notice(error.message);}finally{$('projectFile').value='';}};
$('exampleSelect').onchange=()=>{const key=$('exampleSelect').value;if(!key)return;download();example(key);$('exampleSelect').value='';notice('Приклад відкрито. Попередню програму збережено у файл.');};
function source(){workspace.highlightBlock(null);try{return compileUsb(workspace,{allowRemote:browserMode})||'Команди телефона виконуються базовою прошивкою ESP32. Завантаж програму кнопкою «Прошити»; експорт окремого Arduino-коду для пульта не підтримується.';}catch(error){if(error.blockId){workspace.highlightBlock(error.blockId);workspace.centerOnBlock(error.blockId);}throw error;}}
$('codeButton').onclick=()=>{try{$('codePreview').textContent=source();$('codeDialog').showModal();}catch(error){notice(error.message);}};$('closeCode').onclick=()=>$('codeDialog').close();
async function request(url,options={}){const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(10000)});const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('Запусти локальну USB-майстерню командою npm run dev у папці web.');const data=await response.json();if(!response.ok)throw Error(data.error||'Не вдалося виконати запит.');return data;}
const phaseOrder=['compiling','uploading','verifying'];
function renderJob(job){
 showRemoteConnection(job?.log||'');
 if(job?.id!==lastJob?.id)jobFirstSeen=Date.now();
 lastJob=job;busy=!!job&&!job.finished;
 $('usbLog').textContent=job?.log||'';
 if(browserMode&&job?.finished&&job.phase==='connection-error'){
  boardState='error';boardCheckError=job.message;diagnostic(job.failedPhase||job.mode||'перевірка USB',job.message,job.log);
 }
 if(browserMode&&job?.mode==='install'){if(job.phase==='done')job.message='Майстерню встановлено. На GPIO2 запущено тест: 0,5 секунди увімкнено, 0,5 вимкнено. Тепер склади блоки й натисни «Прошити програму».';if(job.phase==='setup-required')boardState='setup';else if(['done','runtime-error'].includes(job.phase))boardState='ready';}
}
function renderStatus(){
 const job=lastJob,working=busy||submitting,phase=job?.phase||'validating',offline=offlineEditor()&&!working&&!choosingPort;
 const seconds=Math.max(0,Math.floor(((job?.finishedAt||Date.now())-(job?.startedAt||jobFirstSeen||Date.now()))/1000));
 let state='idle',title='Готові спробувати?',message='Склади блоки й натисни «Прошити програму».',icon='↗',hint='';
 if(working){
  state='working';icon='';
  title=phase==='uploading'?'Записуємо на плату':phase==='verifying'?'Перевіряємо запуск':phase==='connecting'?'З’єднуємося з ESP32':'Готуємо програму';
  message=phase==='connecting'?'Перевіряємо модель плати. Якщо підключення затрималось, утримуй BOOT на платі.':phase==='uploading'?'Залиш USB підключеним. Твоя програма переноситься на ESP32.':phase==='verifying'?'Програму записано. Чекаємо відповіді від ESP32.':'Перетворюємо блоки на програму для ESP32. Можеш продовжувати редагувати.';
  hint=phase==='uploading'?Number.isFinite(job?.uploadPercent)?job.overallProgress?`Записано ${Math.round(job.uploadPercent)}% · перевіряємо дані у flash.`:`Образ ${job.uploadImage||1} · ${Math.round(job.uploadPercent)}%. Кожен образ записується окремо.`:'З’єднуємося з платою…':phase==='verifying'?'Перевірка запуску займає кілька секунд.':browserMode?(phase==='connecting'?'Плата має бути підключена кабелем із передаванням даних.':'Готуємо пакет у браузері. Встановлювати програми не потрібно.'):(seconds>=15?'Компіляція ще триває. Перший запуск може потребувати кількох хвилин.':'Збираємо програму на цьому комп’ютері.');
  if(job?.mode==='detecting'){title='З’єднуємося з майстернею на платі';message='Перевіряємо, чи готова ESP32 прийняти новий алгоритм.';hint='Для звичайного оновлення кнопка BOOT не потрібна.';}
  if(job?.mode==='algorithm'){title=phase==='verifying'?'Зберігаємо й запускаємо':'Передаємо твій алгоритм';message=phase==='verifying'?'Перевіряємо дані та запуск нових блоків.':'Базова прошивка вже на платі. Передаємо лише нові блоки.';hint=phase==='uploading'?`Плата отримала ${Math.round(job.uploadPercent||0)}% алгоритму.`:'Попередню програму зберігаємо до завершення запису нової.';}
  if(job?.mode==='install'&&['connecting','compiling'].includes(phase)){title='Перше налаштування ESP32';message='Встановлюємо базову прошивку. Після цього алгоритми можна передавати без BOOT.';hint=phase==='connecting'?'Якщо з’єднання не вдається, утримуй BOOT лише для цього першого встановлення.':'Готуємо базову прошивку та твою програму.';}
 }else if(job){
  state=phase==='done'?'done':phase==='uploaded'?'warning':'error';icon=state==='done'?'✓':'!';
  title=state==='done'?'Готово!':state==='warning'?'Записано. Перевір плату':phase==='runtime-error'?'Перевір блоки':'Не вдалося прошити';message=job.message;
  if(phase==='error')hint=job.failedPhase==='uploading'?'Перевір USB і повтори. Якщо в журналі довго видно Connecting, утримуй BOOT під час підключення.':'Відкрий деталі прошивання нижче, виправ причину та повтори.';
 }
 if(phase==='setup-required'&&!working){state='setup';icon='↧';title=job.setupRetry?'Допоможемо платі під’єднатися':'Підготуймо цю плату';message=job.message;hint='Після встановлення наступні алгоритми передаватимуться без BOOT.';}
 if(!working&&!ports.length&&!job){state='idle';title='Підключи свою ESP32';message=browserMode?'Під’єднай USB, натисни «Обрати плату й прошити» й вибери ESP32 у вікні браузера.':'Під’єднай плату USB-кабелем до цього комп’ютера. Ми знайдемо її автоматично.';icon='↗';}
 else if(!working&&ports.length>1&&!$('usbPort').value){title='Обери свою плату';message='Відкрий налаштування підключення й обери USB-порт ESP32.';}
 if(!ready&&!connectionError){state='error';title=browserMode?'Потрібен Chrome або Edge':'Компілятор недоступний';message=browserMode?'Відкрий майстерню у настільному Chrome або Edge через HTTPS. USB-доступ також може обмежувати політика школи.':'Перевір локальні налаштування Arduino CLI.';icon='!';}
 if(offline){state='idle';title='Працюємо без плати';icon='✎';message='Створюй блоки, збирай схему та зберігай проєкт. Підключи ESP32, коли захочеш запустити програму.';hint=supported()?'':'Для запису на плату відкрий проєкт у настільному Chrome або Edge через HTTPS або localhost.';}
 if(choosingPort){state='working';title='Обери ESP32 у браузері';message='У вікні вибору натисни на USB Serial / CP210x і підтвердь підключення.';hint='Якщо плати немає у списку, перевір USB-кабель і драйвер.';}
 if(localError||connectionError){state='error';title=connectionError?'Зв’язок перервано':'Перевір програму';message=connectionError||localError;icon='!';}
 if(flasherLoadError){state='error';title='Не завантажився прошивач';message='Запис на плату не розпочався: браузер не завантажив модуль прошивання. Відпусти BOOT та онови сторінку. Якщо помилка повториться, перезапусти локальний сервер майстерні.';hint='Оновлення сторінки не прошиває ESP32. Твої блоки збережено на цьому комп’ютері.';icon='!';}
 const setup=phase==='setup-required'&&!offline&&!working&&!localError&&!connectionError;
 $('setupGuide').hidden=!setup;
 $('setupRetryHelp').hidden=!job?.setupRetry;
 $('probeAgain').disabled=working||!ready;
 $('bootHold').hidden=!(working&&job?.mode==='install'&&['connecting','compiling'].includes(phase));
 $('bootRelease').hidden=offline||!(job?.mode==='install'&&['uploading','verifying','done','uploaded'].includes(phase));
 document.querySelector('.usb-progress').hidden=setup||offline;
 $('flashCard').dataset.state=state;$('statusTitle').textContent=title;$('statusIcon').textContent=icon;
 $('statusEyebrow').textContent=working?'ПРОШИВАННЯ':state==='done'?'ПРОГРАМА НА ПЛАТІ':'ВІД БЛОКІВ ДО ПЛАТИ';
 if($('usbStatus').textContent!==message)$('usbStatus').textContent=message;
 $('elapsed').hidden=offline||setup||choosingPort||(!job&&!submitting);$('elapsed').textContent=seconds<60?seconds+' с':Math.floor(seconds/60)+' хв '+seconds%60+' с';
 $('activityHint').hidden=!hint;$('activityHint').textContent=hint;
 const track=$('activityTrack'),determinate=working&&phase==='uploading'&&Number.isFinite(job?.uploadPercent)&&!connectionError;
 track.hidden=!working||!!connectionError;track.classList.toggle('determinate',determinate);track.style.setProperty('--progress',(job?.uploadPercent||0)+'%');
 if(determinate){track.setAttribute('aria-valuenow',String(job.uploadPercent));track.setAttribute('aria-valuetext',job.overallProgress?`Записано ${job.uploadPercent}%`:`Образ ${job.uploadImage||1}: ${job.uploadPercent}%`);}else{track.removeAttribute('aria-valuenow');track.removeAttribute('aria-valuetext');}
 const index=['validating','connecting'].includes(phase)?0:phaseOrder.indexOf(job?.failedPhase||phase);
 for(const [i,item]of [...document.querySelectorAll('[data-phase]')].entries()){
  const complete=!!job&&(i<index||['done','uploaded','runtime-error'].includes(phase));
  item.classList.toggle('active',working&&index===i);item.classList.toggle('complete',complete);item.classList.toggle('failed',phase==='error'&&index===i);
  item.querySelector('span').textContent=complete?'✓':String(i+1);
  if(working&&index===i)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
 }
 $('flashNote').textContent=offline?'Блоки та схема зберігаються на цьому комп’ютері.':setup?'Встановить майстерню й тест блимання замість поточної програми на ESP32. Твої блоки залишаться в редакторі.':working?'Залиш USB підключеним до завершення.':state==='done'?'Програма збережена на ESP32. Її можна запускати без браузера.':'Замінить програму на платі й одразу її запустить.';
 if(flasherLoadError)$('flashNote').textContent='Перезавантажить лише сторінку. Програма на платі залишиться без змін.';
}

function selectBoard(port){
 if(port===chosenPort)return;
 $('remoteConnection').hidden=true;$('remoteNetwork').textContent='';$('remotePassword').textContent='';
 chosenPort=port;boardEpoch++;boardState='idle';boardCheckError='';lastJob=null;localError='';
}
function renderConnection(){
 if(!browserMode){showConnection({state:'editor'});return;}
 let state=!supported()?'unsupported':!connectionKnown?'scanning':choosingPort?'permission':!chosenPort?'cable':boardState==='ready'?'editor':boardState==='setup'?'setup':boardState==='error'?'error':'checking';
 if(chosenPort&&boardState==='ready'&&(busy||submitting)&&!choosingPort)state='transferring';
 if(boardState==='error'&&!chosenPort&&boardCheckError)state='error';
 if(editWithoutBoard&&!busy&&!submitting&&!choosingPort)state='editor';
 showConnection({state,message:boardCheckError,multiple:ports.length>1,working:busy||submitting||checkingBoard,lost:boardLost});
}
async function connectBoard(){
 if(busy||submitting||checkingBoard||choosingPort)return;
 setEditorAccess(false);choosingPort=true;boardCheckError='';update();
 try{await chooseBrowserPort();if(boardState==='error'){boardState='idle';boardCheckError='';}}
 catch(error){boardCheckError=error.name==='NotFoundError'?'Плату ще не обрано. Під’єднай кабель і спробуй ще раз.':error.name==='SecurityError'?'Браузер не дозволив USB-доступ. У класі звернися до вчителя.':error.message;}
 finally{choosingPort=false;update();void inspectBoard();}
}
async function inspectBoard(){
 if(!browserMode||!chosenPort||boardState!=='idle'||checkingBoard||busy||submitting||choosingPort)return;
 const port=chosenPort,epoch=boardEpoch;checkingBoard=true;boardState='checking';update();
 let log='';
 try{
  await usbConsole.pause();
  const result=await probeRuntime({port,log:text=>{log=(log+text).slice(-24000);}});
  if(epoch!==boardEpoch)return;
  if(result?.compatible){boardState='ready';boardLost=false;lastJob=null;showRemoteConnection(log);diagnostic('готово',`Відповіла прошивка ${result.runtime}. Перевірка без запису.`,log,port);}
  else if(result){boardState='setup';const message=`Плата відповіла: ${result.runtime}. Потрібне оновлення базової прошивки для цієї версії майстерні.`;diagnostic('версія прошивки',message,log,port);renderJob({id:crypto.randomUUID(),phase:'setup-required',mode:'install',finished:true,log,message});}
  else{boardState='error';boardCheckError='USB-порт відкрився, але ESP32 не відповіла на HELLO. Це не означає, що прошивка відсутня. Відпусти BOOT, перепідключи USB та повтори перевірку без запису.';diagnostic('очікування HELLO / READY',boardCheckError,log,port);}
 }catch(error){if(epoch!==boardEpoch)return;boardState='error';boardCheckError=error.code==='USB_TIMEOUT'?error.message:'Не вдалося відкрити або прочитати USB-порт. Це не означає, що прошивку втрачено. Закрий інші монітори порту, перепідключи USB та повтори перевірку.';diagnostic(error.stage||'відкриття / читання USB',`${error.name}: ${error.message}`,log,port);}
 finally{checkingBoard=false;update();if(epoch!==boardEpoch)void inspectBoard();}
}

async function poll(){if(browserMode)return pollBrowser();if(polling)return;polling=true;try{const data=await request('/api/usb/status');connectionError='';token=data.token;ready=data.ready;ports=data.ports;const selected=$('usbPort').value;const choices=ports.length>1?[{path:'',label:'Обери свою ESP32…'},...ports]:ports.length?ports:[{path:'',label:'USB-плату не знайдено'}];if(JSON.stringify(choices)!==$('usbPort').dataset.choices){$('usbPort').replaceChildren(...choices.map(p=>new Option(p.label,p.path)));$('usbPort').dataset.choices=JSON.stringify(choices);if(ports.length>1)document.querySelector('.usb-connection').open=true;if(ports.some(p=>p.path===selected))$('usbPort').value=selected;}
 $('usbBadge').textContent=ports.length?'USB знайдено':'Підключи USB';$('usbBadge').className='badge '+(ports.length?'online':'offline');
 renderJob(data.job);
 }catch(error){ready=false;$('usbBadge').textContent='Сервер недоступний';$('usbBadge').className='badge offline';connectionError=lastJob&&!lastJob.finished?'Втрачено зв’язок із локальним сервером. Не від’єднуй USB; віднови сервер і перевір журнал.':error.message;}finally{polling=false;update();}}
async function pollBrowser(){
 if(polling||busy||submitting)return;polling=true;
 if(wakePending&&!checkingBoard&&!choosingPort){polling=false;requestConnectionRecheck();return;}
 try{
  ready=supported();connectionError='';
  const list=ready?await navigator.serial.getPorts():[];browserPorts.clear();
  ports=list.map((port,i)=>{const path='browser-'+i;browserPorts.set(path,port);return {path,label:'ESP32 / USB-плата '+(i+1)};});
  if(chosenPort&&!list.includes(chosenPort)){boardLost=true;selectBoard(null);}
  if(!chosenPort&&list.length===1)selectBoard(list[0]);
  connectionKnown=true;
  $('usbPort').replaceChildren(new Option('Обрати плату…',''),...ports.map(p=>new Option(p.label,p.path)));
  $('usbPort').value=[...browserPorts].find(([,p])=>p===chosenPort)?.[0]||'';
  $('usbBadge').textContent=!ready?'USB недоступний':chosenPort?'Плату обрано':editWithoutBoard?'Без плати':'Обери USB';$('usbBadge').className='badge '+(chosenPort?'online':'offline');
 }catch(error){connectionKnown=true;boardCheckError=error.message;boardState='error';}finally{polling=false;update();void inspectBoard();}
}
async function chooseBrowserPort(){
 // Must run directly in a click handler while browser user activation is present.
 setEditorAccess(false);const port=await navigator.serial.requestPort();selectBoard(port);await pollBrowser();return port;
}
$('refreshUsb').onclick=browserMode?async()=>{try{await chooseBrowserPort();}catch(error){localError=error.name==='NotFoundError'?'Вибір плати скасовано.':error.message;update();}}:poll;

$('flashProgram').onclick=async()=>{if(busy||submitting||checkingBoard||choosingPort)return;
 if(flasherLoadError){save();location.reload();return;}
 if(offlineEditor()){setEditorAccess(false);if(chosenPort){update();void inspectBoard();}else void connectBoard();return;}
 if(browserMode)return flashInBrowser(lastJob?.phase==='setup-required');try{localError='';source();const snapshot=project().workspace;submitting=true;jobFirstSeen=Date.now();lastJob=null;update();const data=await request('/api/usb/flash',{method:'POST',headers:{'Content-Type':'application/json','X-Mcar-USB-Token':token},body:JSON.stringify({port:$('usbPort').value,workspace:snapshot})});submitted=JSON.stringify(snapshot);renderJob({id:data.id,phase:'compiling',startedAt:jobFirstSeen,message:'Компілюємо твої блоки…',finished:false,log:''});notice('Можеш змінювати блоки. Зараз записуємо версію на момент натискання «Прошити».');}catch(error){localError=error.message;notice(error.message);}finally{submitting=false;update();void poll();}};
async function flashInBrowser(install=false){
 installingRuntime=install;
 const epoch=boardEpoch,portAtStart=chosenPort;
 try{
  localError='';let snapshot=graph(),program;
  if(install&&boardState!=='ready'){const starter=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(usbExamples.blink.workspace,starter);program=compileUsbBytecode(starter);snapshot=null;}finally{starter.dispose();}}
  else{source();program=compileUsbBytecode(workspace);}
  choosingPort=!chosenPort;const selection=chosenPort?Promise.resolve(chosenPort):navigator.serial.requestPort();
  submitting=true;jobFirstSeen=Date.now();update();
  chosenPort=await selection;choosingPort=false;update();
  if(install)await usbConsole.pause();
  let flashBrowserProgram;
  try{({flashBrowserProgram}=await import('./browser-flasher.js'));}
  catch(error){flasherLoadError=true;save();throw error;}
  lastJob=null;
  submitted=snapshot;
  await flashBrowserProgram({port:chosenPort,program,install,onJob:job=>{if(boardEpoch!==epoch||chosenPort!==portAtStart)return;renderJob(job);update();}});
 }catch(error){localError=error.name==='NotFoundError'?'Вибір плати скасовано. Натисни «Прошити», коли будеш готовий.':error.name==='SecurityError'?'USB-доступ заборонено. Відкрий сайт у Chrome або Edge через HTTPS; у класі звернися до вчителя.':error.message;notice(localError);}
 finally{installingRuntime=false;choosingPort=false;submitting=false;busy=false;update();void poll();}
}
if(browserMode){
 $('reinstallRuntime').onclick=prepareInstallation;
 $('probeAgain').onclick=()=>{if(busy||submitting)return;lastJob=null;boardState='idle';void inspectBoard();};
 $('codeDialog').querySelector('p').textContent='Еквівалент твоїх блоків мовою Arduino C++. Для браузерного запису алгоритм зберігається у flash разом із готовим виконавцем.';
 $('refreshUsb').setAttribute('aria-label','Обрати іншу USB-плату');$('refreshUsb').title='Обрати іншу USB-плату';
 notice('Chrome / Edge · підключи ESP32 через USB · без встановлення програм');
 navigator.serial?.addEventListener('connect',()=>{void poll();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestConnectionRecheck();});
 window.addEventListener('pageshow',event=>{if(event.persisted)requestConnectionRecheck();});
 navigator.serial?.addEventListener('disconnect',event=>{if((event.port||event.target)===chosenPort){boardLost=true;selectBoard(null);save();update();}if(!busy&&!submitting)void poll();});
}
else $('reinstallRuntime').hidden=true;
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();download();}});
window.addEventListener('beforeunload',e=>{save();if(busy||submitting){e.preventDefault();e.returnValue='';}});
setInterval(()=>{if(busy||submitting)renderStatus();},1000);
let lastPollAt=Date.now();
setInterval(()=>{const now=Date.now();if(now-lastPollAt>10000&&!document.hidden)requestConnectionRecheck();lastPollAt=now;void poll();},1200);void poll();update();
if(import.meta.env.DEV)window.__usbWorkshop={workspace,project,load,compile:source,examples:usbExamples};


let assemblyGuide=null,assemblyLoading=null;
async function showAssemblyRoute(){
 if(location.hash!=='#assembly'){assemblyGuide?.close();return;}
 // A guide deep link should remain usable before a board has been connected.
 setEditorAccess(true);update();
 try{
  assemblyLoading||=import('./assembly/guide.js');
  const {initAssemblyGuide}=await assemblyLoading;
  assemblyGuide||=initAssemblyGuide({onClose:()=>{Blockly.svgResize(workspace);}});
  if(location.hash==='#assembly')assemblyGuide.open();
 }catch(error){assemblyLoading=null;notice('Не вдалося відкрити 3D-гайд. Спробуй ще раз.');}
}
$('assemblyButton').addEventListener('click',event=>{event.preventDefault();if(location.hash==='#assembly')void showAssemblyRoute();else location.hash='assembly';});
window.addEventListener('hashchange',showAssemblyRoute);
void showAssemblyRoute();

import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {program as wiringProgram} from '../wiring-fixture.mjs';
import {installSerial} from './serial-fixture.js';
const root=path.resolve(import.meta.dirname,'../../dist');
async function staticSite(page,{cancel=false,unsupported=false,stubFlash=false,setup=false}={}){
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await installSerial(page,{cancel,unsupported,legacy:setup});
 await page.route('https://classroom.test/**',async route=>{
  const url=new URL(route.request().url());if(!url.pathname.startsWith('/mcar/'))return route.fulfill({status:404,body:''});
  let name=url.pathname.slice('/mcar/'.length)||'index.html';
  if(setup&&name.startsWith('assets/browser-flasher-'))return route.fulfill({contentType:'application/javascript',body:`let attempts=0;export async function flashBrowserProgram({install,onJob}){window.setupCalls=(window.setupCalls||[]).concat(!!install);const job={id:String(Date.now()),mode:'install',phase:'setup-required',finished:true,log:'LED2=ON ms=9533',message:'Плата не відповіла майстерні. Якщо підключаєш її вперше, встанови базову прошивку — один раз для цієї плати.'};if(install){job.phase='connecting';job.finished=false;onJob({...job});await new Promise(r=>setTimeout(r,350));if(++attempts===1){job.phase='connection-error';job.failedPhase='connecting';job.finished=true;job.message='ESP32 ще не перейшла в режим запису. Запис не розпочався.';}else{job.phase='uploading';job.uploadPercent=35;onJob({...job});await new Promise(r=>setTimeout(r,500));job.phase='done';job.finished=true;job.message='Готово! Твоя програма запустилася на ESP32.';}}onJob({...job});return job;}`});
  if(stubFlash&&name.startsWith('assets/browser-flasher-'))return route.fulfill({contentType:'application/javascript',body:`export async function flashBrowserProgram({program,onJob}){if(!program.bytes?.length)throw Error('missing program');const job={id:'browser-job',phase:'uploading',startedAt:Date.now(),finished:false,overallProgress:true,uploadPercent:45,log:'test transport'};onJob(job);await new Promise(r=>setTimeout(r,350));job.phase='done';job.finished=true;job.finishedAt=Date.now();job.message='Готово! Твоя програма запустилася на ESP32.';onJob(job);return job;}`});
  const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  try{await route.fulfill({contentType:{'.wasm':'application/wasm','.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{await route.fulfill({status:404,body:''});}
 });
 return {errors,requests};
}
test('static classroom homepage prepares blocks and flashes through browser permission without local APIs',async({page})=>{
 const state=await staticSite(page,{stubFlash:true});await page.goto('https://classroom.test/mcar/');
 await expect(page.locator('#app')).toBeHidden();await page.locator('#connectionAction').click();await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('#flashProgram')).toBeEnabled();await expect(page.locator('#flashLabel')).toHaveText('Прошити програму');
 await page.locator('#flashProgram').click();await expect(page.locator('#connectionScreen')).toHaveAttribute('data-step','transferring');await expect(page.locator('#app')).toBeHidden();await expect(page.locator('#statusTitle')).toHaveText('Готово!');
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
 await page.screenshot({path:'../validation/browser-usb-static.png'});
 await expect(page.getByRole('link',{name:'Роздивитися машинку'})).toHaveAttribute('href','#assembly');
});
for(const [example,expectedEvents] of [['remote',[5,7,15]],['toggle',[7]]])test(`${example} phone example compiles and uploads event handlers using the normal USB flow`,async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');
 await page.locator('#connectionAction').click();await expect(page.locator('#app')).toBeVisible();
 await page.locator('#exampleSelect').selectOption(example);
 await page.locator('#flashProgram').click();await expect(page.locator('#usbStatus')).toContainText('без BOOT');
 const hex=await page.evaluate(()=>window.serialFixture.commands.filter(command=>command.includes(' DATA ')).map(command=>command.split(' ')[4]).join(''));
 const bytes=Buffer.from(hex,'hex');expect(bytes.subarray(0,8).toString()).toBe('MCARUSB1');expect(bytes[16]).toBe('H'.charCodeAt(0));
 const events=[];for(let index=16;index<bytes.length;index+=8)if(bytes[index]==='T'.charCodeAt(0))events.push(bytes.readFloatLE(index+4));
 expect(events).toEqual(expectedEvents);expect(state.errors).toEqual([]);
 if(example==='toggle'){
  await expect(page.locator('#blocklyArea')).toContainText('стан');
  await expect(page.locator('#blocklyArea')).toContainText('інакше');
  await page.screenshot({path:'../validation/phone-toggle-blocks.png'});
 }
});
test('console displays only board messages, bounds history and resumes after upload and reconnect',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');
 await page.locator('#connectionAction').click();
 const status=page.locator('[data-console-status]'),output=page.locator('[data-console-output]');
 await expect(status).toContainText('Наживо');
 await page.locator('#exampleSelect').selectOption('console');
 await page.locator('#flashProgram').click();await expect(page.locator('#usbStatus')).toContainText('без BOOT');
 await expect(status).toContainText('Наживо');
 await page.evaluate(()=>{
  const text='<img src=x onerror=alert(1)> Привіт!';const hex=Array.from(new TextEncoder().encode(text),byte=>byte.toString(16).padStart(2,'0')).join('');
  window.serialFixture.emit('REMOTE_WIFI: password=secret');window.serialFixture.emit('MCAR_LOG '+hex);
 });
 await expect(output).toContainText('<img src=x onerror=alert(1)> Привіт!');expect(await output.locator('img').count()).toBe(0);await expect(output).not.toContainText('password');
 await page.evaluate(()=>{for(let index=0;index<250;index++)window.serialFixture.emit('MCAR_LOG 41');});
 await expect(output.locator('div')).toHaveCount(200);
 await page.locator('[data-console-clear]').click();await expect(output.locator('div')).toHaveCount(0);
 await page.evaluate(()=>window.serialFixture.disconnect());await expect(status).not.toContainText('Наживо');
 await page.evaluate(()=>window.serialFixture.connect());await expect(status).toContainText('Наживо');
 await page.evaluate(()=>window.serialFixture.emit('MCAR_LOG d093d0bed182d0bed0b2d0be'));
 await expect(output).toContainText('Готово');expect(state.errors).toEqual([]);
});
test('silent board after reconnect offers connection recovery, never automatic BOOT setup',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');
 await page.locator('#connectionAction').click();await expect(page.locator('[data-console-status]')).toContainText('Наживо');
 await page.evaluate(()=>{window.serialFixture.silence();window.serialFixture.disconnect();});
 await expect(page.locator('#app')).toBeHidden();await page.evaluate(()=>window.serialFixture.connect());
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:12000});
 await expect(page.locator('#setupGuide')).toBeHidden();
 await expect(page.locator('#connectionDescription')).toContainText('не означає');
 expect(await page.evaluate(()=>window.serialFixture.commands.every(command=>command.includes(' HELLO ')))).toBe(true);
 await page.evaluate(()=>window.serialFixture.ready());await page.locator('#connectionAction').click();
 await expect(page.locator('#app')).toBeVisible();expect(state.errors).toEqual([]);
});
test('resume reopens a stale session without USB disconnect events and never writes flash',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await expect(page.locator('[data-console-status]')).toContainText('Наживо');
 const before=await page.evaluate(()=>window.serialFixture.stats().openedCount);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await expect.poll(()=>page.evaluate(()=>window.serialFixture.stats().openedCount)).toBeGreaterThan(before);
 await expect(page.locator('[data-console-status]')).toContainText('Наживо');
 await page.evaluate(()=>{window.serialFixture.silence();window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:12000});
 await expect(page.locator('#connectionDiagnosticText')).toContainText('HELLO');await expect(page.locator('#setupGuide')).toBeHidden();
 await page.evaluate(()=>window.serialFixture.ready());await page.locator('#connectionAction').click();await expect(page.locator('#app')).toBeVisible();
 expect(await page.evaluate(()=>window.serialFixture.commands.every(command=>command.includes(' HELLO ')))).toBe(true);
 expect(state.requests.filter(url=>url.includes('/firmware/'))).toEqual([]);expect(state.errors).toEqual([]);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.serialFixture.silence();window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:12000});
 await page.screenshot({path:'../validation/usb-recovery-mobile.png',fullPage:true});
});
test('cancelled chooser and unsupported browsers give actionable messages without flashing',async({page})=>{
 await staticSite(page,{cancel:true});await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();await expect(page.locator('#connectionDescription')).toContainText('Плату ще не обрано');await expect(page.locator('#connectionAction')).toBeEnabled();await expect(page.locator('#app')).toBeHidden();
});
test('unsupported browser is detected on the static site',async({page})=>{
 await staticSite(page,{unsupported:true});await page.goto('https://classroom.test/mcar/');await expect(page.locator('#connectionTitle')).toContainText('Chrome або Edge');await expect(page.locator('#connectionAction')).toBeHidden();await expect(page.locator('#app')).toBeHidden();
});
test('persistent runtime updates blocks through the real browser client without fetching firmware',async({page})=>{
 const state=await staticSite(page);
 await page.addInitScript(()=>{
  window.runtimeSignals=[];window.runtimeCommands=[];let controller,nonce='',checksum='',offset=0;
  const send=line=>controller.enqueue(new TextEncoder().encode(line+'\n'));
  const port={getInfo:()=>({usbVendorId:0x10c4,usbProductId:0xea60}),async open(){this.readable=new ReadableStream({start:c=>controller=c});this.writable=new WritableStream({write:bytes=>{
   const line=new TextDecoder().decode(bytes).trim(),p=line.split(' ');window.runtimeCommands.push(line);nonce=p[2];
   if(p[1]==='HELLO')send(`MCAR2 READY ${nonce} gpio2-v5 16400`);
   if(p[1]==='BEGIN'){checksum=p[4];offset=0;send(`MCAR2 ACCEPT ${nonce} 0`);}
   if(p[1]==='DATA'){offset+=p[4].length/2;send(`MCAR2 ACK ${nonce} ${offset}`);}
   if(p[1]==='COMMIT'){send(`MCAR2 SAVED ${nonce} ${checksum}`);send(`MCAR2 RUNNING ${nonce} ${checksum}`);}
  }});},async setSignals(s){window.runtimeSignals.push(s);},async close(){}};
  Object.defineProperty(navigator,'serial',{configurable:true,value:{getPorts:async()=>[port],requestPort:async()=>port,addEventListener(){}}});
 });
 await page.goto('https://classroom.test/mcar/');await page.locator('#flashProgram').click();await expect(page.locator('#usbStatus')).toContainText('без BOOT');
 await page.locator('#flashProgram').click();await expect(page.locator('#flashProgram')).toBeEnabled();await expect(page.locator('#usbStatus')).toContainText('без BOOT');
 expect(await page.evaluate(()=>window.runtimeCommands.filter(s=>s.includes(' COMMIT ')).length)).toBe(2);
 expect(await page.evaluate(()=>window.runtimeSignals)).toEqual(Array.from({length:2},()=>({dataTerminalReady:false,requestToSend:false})));
 expect(state.requests.filter(url=>url.includes('/firmware/')||url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
 await page.screenshot({path:'../validation/runtime-upload-browser.png'});
});
test('static site includes the real flasher, intact firmware assets, and working nested-path 3D navigation',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await page.locator('#openPinEditor').click();await expect(page.locator('#pinStage .module-pin')).toHaveCount(38);await page.locator('[data-action="pwm"]').click();await page.locator('#pinDuty').fill('96');await page.locator('#addPinBlock').click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(2, 96.000000f)');await page.locator('#closeCode').click();
 const loaded=await page.evaluate(async()=>{const manifest=await(await fetch('./.vite/manifest.json')).json();const entry=Object.values(manifest).find(e=>e.src==='src/browser-flasher.js');const flasher=await import('./'+entry.file);if(typeof flasher.flashBrowserProgram!=='function')throw Error('Missing real flasher');const pkg=await(await fetch('./firmware/esp32-gpio-v2/manifest.json')).json();return await Promise.all(pkg.files.map(async f=>{const bytes=await(await fetch('./firmware/esp32-gpio-v2/'+f.file)).arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==f.sha256)throw Error('Bad firmware checksum');return bytes.byteLength;}));});
 expect(loaded).toHaveLength(3);expect(loaded[2]).toBeGreaterThan(200000);
 await page.getByRole('link',{name:'Роздивитися машинку'}).click();await expect(page.locator('#guideTitle')).toBeVisible();
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});

test('first setup guides BOOT, recovers failed connection and announces release during writing',async({page})=>{
 const state=await staticSite(page,{setup:true});await page.addInitScript(()=>localStorage.setItem('mandrivnyk-usb-v1',JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Незавершений проєкт',workspace:{blocks:{blocks:[]}}})));await page.goto('https://classroom.test/mcar/');
 await page.locator('#connectionAction').click();await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:10000});
 await page.locator('#connectionRecovery summary').click();await page.locator('#connectionInstall').click();
 await expect(page.locator('#flashCard')).toHaveAttribute('data-state','setup');await expect(page.locator('#setupGuide li')).toHaveCount(3);
 await expect(page.locator('#flashLabel')).toHaveText('BOOT затиснуто — встановити');await expect(page.locator('.usb-progress')).toBeHidden();
 await page.locator('#probeAgain').click();await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:10000});expect(await page.evaluate(()=>window.setupCalls||[])).toEqual([]);
 await page.locator('#connectionInstall').click();await page.locator('#flashProgram').click();await expect(page.locator('#bootHold')).toBeVisible();
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок');await expect(page.locator('#setupGuide')).toBeHidden();
 expect(await page.evaluate(()=>window.setupCalls)).toEqual([true]);await page.locator('#connectionInstall').click();
 await page.setViewportSize({width:390,height:844});await page.locator('#flashCard').scrollIntoViewIfNeeded();
 const overflow=await page.locator('#flashCard').evaluate(el=>el.scrollWidth>el.clientWidth);expect(overflow).toBe(false);
 await page.locator('#flashCard').screenshot({path:'../validation/usb-setup-mobile.png'});
 await page.locator('#flashProgram').click();await expect(page.locator('#bootRelease')).toBeVisible();await expect(page.locator('#statusTitle')).toHaveText('Готово!');await expect(page.locator('#setupGuide')).toBeHidden();expect(await page.evaluate(()=>window.setupCalls)).toEqual([true,true]);await expect(page.locator('#projectName')).toHaveValue('Незавершений проєкт');await expect(page.locator('#blockCount')).toHaveText('0 блоків');expect(state.errors).toEqual([]);
});
test('manual reinstallation shows instructions before starting a flash',async({page})=>{
 await staticSite(page,{setup:true});await page.goto('https://classroom.test/mcar/');await page.evaluate(()=>window.serialFixture.ready());await page.locator('#connectionAction').click();await page.locator('.usb-connection summary').click();await page.locator('#reinstallRuntime').click();
 await expect(page.locator('#setupGuide')).toBeVisible();expect(await page.evaluate(()=>window.setupCalls||[])).toEqual([]);
});

test('unrecognized blinking sketch shows diagnostic recovery without fetching or writing firmware',async({page})=>{
 const state=await staticSite(page);
 await page.addInitScript(()=>{
  const port={getInfo:()=>({usbVendorId:0x10c4,usbProductId:0xea60}),async open(){this.readable=new ReadableStream({start:c=>c.enqueue(new TextEncoder().encode('LED2=ON ms=9533\nLED2=OFF ms=10034\n'))});this.writable=new WritableStream({write(){}});},async setSignals(){},async close(){}};
  Object.defineProperty(navigator,'serial',{configurable:true,value:{getPorts:async()=>[port],requestPort:async()=>port,addEventListener(){}}});
 });
 await page.goto('https://classroom.test/mcar/');
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:10000});
 await expect(page.locator('#connectionDescription')).toContainText('не означає');await expect(page.locator('#connectionDiagnosticText')).toContainText('LED2=ON');
 await expect(page.locator('#connectionAction')).toBeEnabled();await expect(page.locator('#setupGuide')).toBeHidden();
 expect(state.requests.filter(url=>url.includes('/firmware/')||url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});

test('cable screen hides tools; authorized reconnect resumes the same project without writing',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');
 await expect(page.locator('#connectionTitle')).toHaveText('Підключи свою ESP32');await expect(page.locator('#app')).toBeHidden();await expect(page.locator('#app')).toHaveAttribute('inert','');
 await page.screenshot({path:'../validation/usb-connect-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.locator('.scene-cable').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../validation/usb-connect-mobile.png',fullPage:true});
 await page.locator('#connectionAction').click();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#connectionScreen')).toBeHidden();
 await page.locator('#projectName').fill('Мої збережені блоки');
 const saved=await page.evaluate(()=>localStorage.getItem('mandrivnyk-usb-v1'));
 await page.evaluate(()=>window.serialFixture.disconnect());await expect(page.locator('#app')).toBeHidden();await expect(page.locator('#connectionTitle')).toHaveText('Повернімо зв’язок');
 await page.evaluate(()=>window.serialFixture.connect());await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#projectName')).toHaveValue('Мої збережені блоки');
 expect(await page.evaluate(()=>localStorage.getItem('mandrivnyk-usb-v1'))).toBe(saved);
 expect(await page.evaluate(()=>window.serialFixture.commands.every(c=>c.includes(' HELLO ')))).toBe(true);
 expect(state.requests.filter(url=>url.includes('/firmware/')||url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});
test('disconnect during readiness check cannot reopen the editor from a stale response',async({page})=>{
 const state=await staticSite(page,{setup:true});await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await expect(page.locator('#connectionScreen')).toHaveAttribute('data-step','checking');
 await expect.poll(()=>page.evaluate(()=>window.serialFixture.commands.length)).toBeGreaterThan(0);
 await page.evaluate(()=>window.serialFixture.disconnect());await expect(page.locator('#connectionTitle')).toHaveText('Повернімо зв’язок');await expect(page.locator('#app')).toBeHidden();
 await page.evaluate(()=>{window.serialFixture.ready();window.serialFixture.connect();});await expect(page.locator('#app')).toBeVisible();
 expect(await page.evaluate(()=>window.serialFixture.commands.every(c=>c.includes(' HELLO ')))).toBe(true);expect(state.errors).toEqual([]);
});

test('static site imports wiring, resolves a named PWM command and loads the module viewer',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await page.locator('#projectFile').setInputFiles({name:'motor.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Мотор',workspace:wiringProgram()}))});
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(16, 180');await page.locator('#closeCode').click();
 await page.locator('#openWiring').click();await expect(page.locator('.wiring-wire-list button')).toHaveCount(8);
 await page.locator('.wiring-component[data-component="drv"]').click();await page.getByRole('button',{name:'Роздивитися в 3D',exact:true}).click();await expect(page.locator('.wiring-viewer-dialog canvas')).toBeVisible();
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});

test('published site allows editing without a board then connects and flashes explicitly',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await expect(page.locator('#connectionSkip')).toBeVisible();
 await page.screenshot({path:'../validation/usb-optional-connection.png',fullPage:true});
 await page.locator('#connectionSkip').click();await page.locator('#projectName').fill('Спочатку блоки');await page.locator('#openWiring').click();await page.locator('[data-catalog="breadboard"]').click();await page.locator('[data-apply]').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mandrivnyk-usb-v1')).workspace.wiring?.components.length)).toBe(1);
 const saved=await page.evaluate(()=>localStorage.getItem('mandrivnyk-usb-v1'));expect(await page.evaluate(()=>window.serialFixture.commands)).toEqual([]);
 await page.reload();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#projectName')).toHaveValue('Спочатку блоки');await page.locator('#flashProgram').click();
 await expect(page.locator('#flashLabel')).toHaveText('Прошити програму');await expect(page.locator('#app')).toBeVisible();
 expect(await page.evaluate(()=>window.serialFixture.commands.every(c=>c.includes(' HELLO ')))).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('mandrivnyk-usb-v1'))).toBe(saved);
 await page.locator('#flashProgram').click();await expect(page.locator('#statusTitle')).toHaveText('Готово!');expect(await page.evaluate(()=>window.serialFixture.commands.some(c=>c.includes(' COMMIT ')))).toBe(true);
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});


test('built site loads the routing worker and WASM under a nested Pages path',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await page.locator('#projectFile').setInputFiles({name:'routes.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Маршрути',workspace:wiringProgram()}))});await page.locator('#openWiring').click();
 await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','libavoid');
 expect(state.requests.some(url=>url.startsWith('https://classroom.test/mcar/')&&url.endsWith('.wasm'))).toBe(true);
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});


test('published wiring palette explains unavailable expansion GPIOs and opens the affected pin',async({page})=>{
 const {expansionBreadboard}=await import('../expansion-breadboard-fixture.mjs');const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 await page.locator('#projectFile').setInputFiles({name:'expansion.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Схема',workspace:{wiring:expansionBreadboard(),blocks:{languageVersion:0,blocks:[]}}}))});
 await page.getByRole('treeitem',{name:'Підключені піни',exact:true}).click();await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO34 — лише вхід');await expect(page.locator('.blocklyToolboxFlyout')).not.toContainText('Звірити контакти S/G');await page.locator('.blocklyFlyoutButton').filter({hasText:'Показати DRV8833 · IN4'}).click();await expect(page.locator('.wiring-side')).toContainText('GPIO34 — лише вхід');expect(state.errors).toEqual([]);
});
test('published editor groups blocks and creates independent command definitions',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/');await page.locator('#connectionSkip').click();
 const pin=(id,n)=>({type:'usb_pin_write',id,fields:{PIN:String(n),STATE:'ON'}});
 const workspace={myBlocks:[{id:'left',name:'Лівий мотор',body:pin('body',16)}],blocks:{languageVersion:0,blocks:[{type:'usb_start',id:'start',x:30,y:20,next:{block:{...pin('p1',16),next:{block:pin('p2',17)}}}}]}};
 await page.locator('#projectFile').setInputFiles({name:'groups.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Групи',workspace}))});
 const tools=page.locator('.editor-panel .block-selection-tools');await tools.getByRole('button',{name:'Вибрати кілька блоків'}).click();
 for(const id of ['p1','p2'])await page.locator(`#blocklyDiv [data-id="${id}"] > .blocklyPath:not(.blocklyPathSelected)`).click({position:{x:5,y:24}});
 await expect(tools).toContainText('Вибрано: 2');await tools.getByRole('button',{name:'Дублювати вибране',exact:true}).click();
 await expect(page.locator('#blockCount')).toContainText('5');await page.keyboard.press('Control+z');await expect(page.locator('#blockCount')).toContainText('3');
 await page.getByRole('treeitem',{name:'Мої блоки',exact:true}).click();await page.locator('#blocklyDiv .blocklyToolboxFlyout .blocklyText').filter({hasText:'Лівий мотор'}).hover();await page.getByRole('button',{name:'Дублювати: Лівий мотор',exact:true}).click();await expect(page.locator('#myBlockName')).toHaveValue('Лівий мотор — копія');await page.locator('#myBlockName').fill('Правий мотор');await page.locator('[data-save]').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mandrivnyk-usb-v1')).workspace.myBlocks.map(d=>d.name))).toEqual(['Лівий мотор','Правий мотор']);expect(state.errors).toEqual([]);expect(state.requests.filter(u=>u.includes('/api/'))).toEqual([]);
});

test('built site imports and compiles parameterized commands without a server',async({page})=>{
 const state=await staticSite(page,{stubFlash:true});await page.goto('https://classroom.test/mcar/');await page.locator('#connectionAction').click();
 const p={id:'speed',name:'Швидкість',kind:'number',defaultValue:128};
 const project={format:'mandrivnyk-usb',version:1,name:'Мотор з параметрами',workspace:{myBlocks:[{id:'motor',name:'Мотор',parameters:[{id:'pin',name:'IN',kind:'pin',defaultValue:25},p],body:{type:'usb_pin_pwm',fields:{PIN:'param:pin'},inputs:{DUTY:{block:{type:'my_block_parameter',extraState:{definitionId:'motor',parameterId:'speed',kind:'number',name:'Швидкість'}}}}}}],blocks:{blocks:[{type:'usb_start',next:{block:{type:'my_block_call',extraState:{definitionId:'motor'},inputs:{ARG_pin:{block:{type:'my_block_pin',fields:{PIN:'26'}}},ARG_speed:{block:{type:'math_number',fields:{NUM:200}}}}}}}]}}};
 await page.locator('#projectFile').setInputFiles({name:'motor.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(26,');await expect(page.locator('#codePreview')).toContainText('200.000000f');await page.locator('#closeCode').click();
 await page.locator('#flashProgram').click();await expect(page.locator('#statusTitle')).toHaveText('Готово!');
 expect(state.requests.filter(url=>url.includes('/api/'))).toEqual([]);expect(state.errors).toEqual([]);
});

test('built USB guide returns without navigation and legacy bookmarks resolve under Pages subpaths',async({page})=>{
 const state=await staticSite(page);await page.goto('https://classroom.test/mcar/usb.html?from=old#assembly');
 await expect(page).toHaveURL('https://classroom.test/mcar/?from=old#assembly');await expect(page.locator('#guideCanvas canvas')).toBeVisible();await page.locator('#guideClose').click();await expect(page.locator('#app')).toBeVisible();
 await page.locator('#projectName').fill('Моя збережена схема');await page.locator('#projectName').press('Tab');
 await page.evaluate(()=>window.navigationMarker='same-document');
 await page.locator('#assemblyButton').click();await expect(page.locator('#assemblyGuide')).toBeVisible();await page.locator('#guideClose').click();await expect(page.locator('#projectName')).toHaveValue('Моя збережена схема');expect(await page.evaluate(()=>window.navigationMarker)).toBe('same-document');
 await page.goto('https://classroom.test/mcar/robot.html#assembly');await expect(page).toHaveURL('https://classroom.test/mcar/#assembly');await expect(page.locator('#assemblyGuide')).toBeVisible();await page.locator('#guideClose').click();await expect(page.locator('#createMyBlock')).toBeVisible();
 await expect(page.locator('#sendProgram,#runProgram,#teacherDialog')).toHaveCount(0);
 expect(state.requests.filter(url=>/\/(api\/info|status|stop)(?:[?#]|$)/.test(url))).toEqual([]);expect(state.errors).toEqual([]);
});

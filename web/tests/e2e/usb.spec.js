import {test,expect} from '@playwright/test';

async function stub(page){
 let job=null,submitted=null;
 await page.route('**/api/usb/status',route=>route.fulfill({json:{token:'test-token',ready:true,ports:[{path:'/dev/cu.usbserial-test',label:'ESP32 USB'}],job}}));
 await page.route('**/api/usb/flash',async route=>{submitted=route.request().postDataJSON();job={id:'test-job',phase:'done',finished:true,message:'Прошито! Твоя програма запустилася на ESP32.',log:'MCAR_USB_BLOCKS BOOT'};await route.fulfill({status:202,json:{id:job.id}});});
 return {get submitted(){return submitted}};
}
test('USB page flashes the edited Blockly graph with one click and preserves the project',async({page})=>{
 const state=await stub(page);await page.goto('/usb.html?transport=local');await expect(page.locator('#flashProgram')).toBeEnabled();
 await page.evaluate(()=>{const wait=window.__usbWorkshop.workspace.getAllBlocks().find(b=>b.type==='robot_wait');wait.getInputTargetBlock('TIME').setFieldValue(.2,'NUM');});
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('waitSeconds(0.200000f)');await page.locator('#closeCode').click();
 await page.locator('#flashProgram').click();await expect(page.locator('#usbStatus')).toContainText('Прошито!');expect(state.submitted.port).toBe('/dev/cu.usbserial-test');expect(JSON.stringify(state.submitted.workspace)).toContain('0.2');
 await page.screenshot({path:'../validation/usb-workshop-desktop.png'});
 await page.reload();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('waitSeconds(0.200000f)');
});
test('disconnected USB disables flash and invalid blocks do not reach the server',async({page})=>{
 const state=await stub(page);await page.goto('/usb.html?transport=local');await expect(page.locator('#flashProgram')).toBeEnabled();
 await page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().find(b=>b.type==='robot_wait').getInputTargetBlock('TIME').dispose());
 await page.locator('#flashProgram').click();await expect(page.locator('#notice')).toContainText('порожнє');expect(state.submitted).toBeNull();
 await page.route('**/api/usb/status',route=>route.fulfill({json:{ready:true,token:'test-token',ports:[],job:null}}));await page.locator('.usb-connection summary').click();await page.locator('#refreshUsb').click();await expect(page.locator('#flashProgram')).toBeDisabled();
});
test('USB page keeps the flash control and workspace usable on a narrow screen',async({page})=>{
 await stub(page);await page.setViewportSize({width:390,height:844});await page.goto('/usb.html?transport=local');await expect(page.locator('.blocklySvg').first()).toBeVisible();await page.locator('#flashProgram').scrollIntoViewIfNeeded();await expect(page.locator('#flashProgram')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'../validation/usb-workshop-mobile.png',fullPage:true});
});

test('long jobs stay vivid, show real stages and distinguish changed blocks and connection loss',async({page})=>{
 let job=null;
 await page.route('**/api/usb/status',route=>route.fulfill({json:{token:'test',ready:true,ports:[{path:'/dev/cu.usbserial-test',label:'ESP32 USB'}],job}}));
 await page.route('**/api/usb/flash',route=>{job={id:'progress',phase:'compiling',startedAt:Date.now()-21000,finished:false,log:''};return route.fulfill({status:202,json:{id:job.id}});});
 await page.goto('/usb.html?transport=local');await page.locator('#flashProgram').click();
 await expect(page.locator('#flashCard')).toHaveAttribute('data-state','working');
 await expect(page.locator('#flashProgram')).toBeDisabled();
 await expect(page.locator('#flashProgram')).toHaveCSS('opacity','1');
 await expect(page.locator('#elapsed')).toContainText('с');
 await expect(page.locator('#activityHint')).toContainText('Компіляція ще триває');
 await expect(page.locator('#activityTrack')).not.toHaveAttribute('aria-valuenow');
 await page.screenshot({path:'../validation/usb-workshop-compiling.png'});
 job={...job,phase:'uploading',uploadImage:4,uploadPercent:42};
 await expect(page.locator('#activityTrack')).toHaveAttribute('aria-valuenow','42');
 await expect(page.locator('#activityHint')).toContainText('Образ 4 · 42%');
 await page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().find(b=>b.type==='robot_wait').getInputTargetBlock('TIME').setFieldValue(3,'NUM'));
 await expect(page.locator('#changedNote')).toBeVisible();
 await page.screenshot({path:'../validation/usb-workshop-uploading.png'});
 job={...job,phase:'verifying'};await expect(page.locator('#statusTitle')).toHaveText('Перевіряємо запуск');
 await expect(page.locator('#activityTrack')).not.toHaveAttribute('aria-valuenow');
 job={...job,phase:'done',finished:true,finishedAt:Date.now(),message:'Прошито! Твоя програма запустилася на ESP32.'};
 await expect(page.locator('#flashCard')).toHaveAttribute('data-state','done');await expect(page.locator('#flashLabel')).toHaveText('Прошити зміни');
 await expect(page.locator('#activityTrack')).toBeHidden();
 await page.locator('#fitProgram').click();
 const fits=await page.evaluate(()=>{const area=document.querySelector('#blocklyDiv').getBoundingClientRect();return [...document.querySelectorAll('.blocklyBlockCanvas > .blocklyDraggable')].every(b=>{const r=b.getBoundingClientRect();return r.top>=area.top-1&&r.bottom<=area.bottom+1&&r.right<=area.right+1;});});expect(fits).toBe(true);
 await page.route('**/api/usb/status',route=>route.abort());
 await expect(page.locator('#statusTitle')).toHaveText('Зв’язок перервано');await expect(page.locator('#flashProgram')).toBeDisabled();
});

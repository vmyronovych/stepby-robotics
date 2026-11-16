import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';

test('USB is the root editor and guide returns to the exact program and connection',async({page})=>{
 const errors=[],legacy=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(api\/info|api\/program|api\/run|status|stop)(?:[?#]|$)/.test(r.url()))legacy.push(r.url());});
 await installSerial(page,{granted:true});await page.goto('/');await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#flashProgram')).toBeEnabled();
 await page.evaluate(()=>{const app=window.__usbWorkshop;const p={format:'mandrivnyk-usb',version:1,...app.examples.pulses};p.name='Мій USB-проєкт';p.workspace.myBlocks=[{id:'keep',name:'Збережена команда',body:{type:'usb_pin_write',fields:{PIN:'25',STATE:'ON'}}}];app.load(p);window.savedWorkspace=app.workspace;});
 const before=await page.evaluate(()=>JSON.stringify(window.__usbWorkshop.project())),commands=await page.evaluate(()=>window.serialFixture.commands.length);
 await page.locator('#assemblyButton').click();await expect(page).toHaveURL(/\/#assembly$/);await expect(page.locator('#guideCanvas canvas')).toBeVisible();await page.locator('#guideNext').click();await page.locator('#guideClose').click();
 await expect(page).toHaveURL(/\/$/);await expect(page.locator('#flashProgram')).toBeEnabled();expect(await page.evaluate(()=>JSON.stringify(window.__usbWorkshop.project()))).toBe(before);expect(await page.evaluate(()=>window.savedWorkspace===window.__usbWorkshop.workspace)).toBe(true);expect(await page.evaluate(()=>window.serialFixture.commands.length)).toBe(commands);
 await page.locator('#assemblyButton').click();await expect(page.locator('#assemblyGuide')).toBeVisible();await page.goBack();await expect(page.locator('#assemblyGuide')).not.toBeVisible();await page.goForward();await expect(page.locator('#assemblyGuide')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#assemblyGuide')).not.toBeVisible();
 await page.locator('#assemblyButton').click();await page.evaluate(()=>window.__assembly.show(window.__assembly.steps.length-1));await page.locator('#guideNext').click();await expect(page.locator('#assemblyGuide')).not.toBeVisible();await expect(page.locator('#projectName')).toHaveValue('Мій USB-проєкт');
 expect(await page.locator('#sendProgram,#runProgram,#teacherDialog').count()).toBe(0);expect(legacy).toEqual([]);expect(errors).toEqual([]);
});

test('legacy bookmarks preserve query and guide hash and always return to USB',async({page})=>{
 await installSerial(page,{granted:true});
 for(const route of ['/usb.html?from=bookmark','/robot.html?from=bookmark#assembly','/index.html#assembly']){
  await page.goto(route);await expect(page.locator('#flashProgram')).toBeAttached();
  if(route.includes('#assembly')){await expect(page.locator('#assemblyGuide')).toBeVisible();await page.locator('#guideClose').click();}
  await expect(page.locator('#app')).toBeVisible();expect(await page.evaluate(()=>!!window.__workshop)).toBe(false);
  if(route.includes('from='))expect(new URL(page.url()).searchParams.get('from')).toBe('bookmark');
 }
});

test('a guide deep link needs no board and its return reveals the USB editor',async({page})=>{
 await installSerial(page);await page.goto('/#assembly');await expect(page.locator('#guideCanvas canvas')).toBeVisible();await page.locator('#guideClose').click();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#connectionScreen')).toBeHidden();await expect(page.locator('#createMyBlock')).toBeVisible();
});

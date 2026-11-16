import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';

test('development server loads the real browser flasher before any board write',async({page})=>{
 const failures=[];
 page.on('requestfailed',request=>failures.push(`${request.url()}: ${request.failure()?.errorText}`));
 page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
 await installSerial(page,{unsupported:true});
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  try{const module=await import('/src/browser-flasher.js');return {loaded:typeof module.flashBrowserProgram==='function'};}
  catch(error){return {loaded:false,error:error.message};}
 });
 expect(result,JSON.stringify({result,failures},null,2)).toEqual({loaded:true});
 expect(await page.evaluate(()=>window.serialFixture.commands)).toEqual([]);
});
test('failed flasher import explains recovery without blaming BOOT or writing to the board',async({page})=>{
 await installSerial(page,{granted:true,legacy:true});
 await page.route(/\/src\/browser-flasher\.js(?:\?.*)?$/,route=>route.fulfill({status:504,body:'Outdated Optimize Dep'}));
 await page.goto('/');
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:10000});
 await page.locator('#connectionRecovery summary').click();await page.locator('#connectionInstall').click();
 await expect(page.locator('#setupGuide')).toBeVisible();
 await page.locator('#flashProgram').click();
 await expect(page.locator('#usbStatus')).toContainText('Запис на плату не розпочався');
 await expect(page.locator('#usbStatus')).toContainText('Відпусти BOOT');
 await expect(page.locator('#statusTitle')).toHaveText('Не завантажився прошивач');
 expect(await page.evaluate(()=>window.serialFixture.commands.every(command=>command.includes(' HELLO ')))).toBe(true);
 await expect(page.locator('#flashLabel')).toHaveText('Оновити сторінку');
 await page.locator('#flashProgram').click();
 await expect(page.locator('#connectionTitle')).toHaveText('Відновімо зв’язок',{timeout:10000});
 expect(await page.evaluate(()=>window.serialFixture.commands.every(command=>command.includes(' HELLO ')))).toBe(true);
});

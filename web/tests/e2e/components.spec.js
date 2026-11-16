import {test,expect} from '@playwright/test';
import {serveBuiltSite} from './static-site.js';
test.beforeEach(async({page},testInfo)=>serveBuiltSite(page,testInfo));
async function open(page){await page.route('**/api/info',r=>r.fulfill({status:503,body:'offline'}));await page.goto('/#assembly');await expect(page.locator('#guideCanvas canvas')).toBeVisible();}

test('clicking the D1 badge opens its pinout; orbit dragging does not',async({page},testInfo)=>{
 test.skip(!!testInfo.config.metadata.staticPreview,'Pixel target uses development projection diagnostics');
 await open(page);await page.locator('#guideTop').click();
 const point=await page.evaluate(()=>window.__assembly.componentPoint('D1'));expect(point).toBeTruthy();
 const canvas=page.locator('#guideCanvas canvas');await canvas.click({position:point});
 await expect(page.locator('.component-panel')).toHaveAttribute('data-component','D1');
 await expect(page.locator('.component-pin-detail')).toContainText('Торкнися контакту');
 await page.locator('.component-panel [data-back]').click();
 const rect=await canvas.boundingBox();await page.mouse.move(rect.x+point.x,rect.y+point.y);await page.mouse.down();await page.mouse.move(rect.x+point.x+60,rect.y+point.y+30,{steps:6});await page.mouse.up();await expect(page.locator('.component-panel')).toBeHidden();
});

test('D1 pin drill-down, related components and step changes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.locator('#guideComponentSelect').selectOption('D1');
 await expect(page.locator('#componentTitle')).toContainText('D1');
 await page.locator('[data-pin="FAULT"]').click();await expect(page.locator('.component-pin-detail')).toContainText('ESP32');
 await page.locator('[data-pin="VCC"]').click();await expect(page.locator('.component-pin-detail')).toContainText('Батареї +');
 await page.locator('[data-related="D2"]').click();await expect(page.locator('#componentTitle')).toContainText('D2');await expect(page.locator('.component-pin-detail')).toContainText('Торкнися контакту');
 await page.screenshot({path:'../validation/component-d2-desktop.png'});
 await page.locator('#guideNext').click();await expect(page.locator('.component-panel')).toBeHidden();await expect(page.locator('#guideTitle')).toHaveText('Знайди нижню платформу');
 await expect(page.locator('#guideComponentSelect option[value="D1"]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('mobile component card works inside presentation and Escape returns to model first',async({page})=>{
 await page.addInitScript(()=>{Element.prototype.requestFullscreen=undefined});await page.setViewportSize({width:390,height:844});await open(page);
 await page.locator('#guideFullscreen').click();await page.locator('#guideComponentSelect').selectOption('D1');
 await expect(page.locator('.component-panel [data-back]')).toBeInViewport();await page.locator('[data-pin="IN2"]').click();
 await expect(page.locator('.component-pin-detail')).toContainText('ESP32');
 expect(await page.locator('.component-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'../validation/component-d1-mobile.png'});
 await page.keyboard.press('Escape');await expect(page.locator('.component-panel')).toBeHidden();await expect(page.locator('#guideFullscreen')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(page.locator('#guideFullscreen')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#assemblyGuide')).toBeVisible();
});

test('reviewed chassis has body and battery component details',async({page})=>{
 await page.goto('/chassis-review.html');await expect(page.locator('#chassis3d')).toHaveAttribute('data-ready','true');
 await page.locator('#chassisComponentSelect').selectOption('BT1');await expect(page.locator('#componentTitle')).toContainText('BT1');await page.locator('[data-pin="+"]').click();await expect(page.locator('.component-pin-detail')).toContainText('F1');
 await page.locator('.component-panel [data-back]').click();await page.locator('#chassisComponentSelect').selectOption('chassis');await page.locator('.component-teacher summary').click();await expect(page.locator('.component-facts')).toContainText('255 × 150');
});

 test('photo models and their physical pins work without a robot',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page);
 for(const [id,pin]of [['D1','IN1'],['ESP32','L3'],['30P','top-S-0'],['M1','red']]){
  await page.locator('#guideComponentSelect').selectOption(id);
  await expect(page.locator('.module-stage')).toHaveAttribute('data-render-mode','3d');
  await page.locator('[data-module-view="front"]').click();
  await page.locator(`[data-pin="${pin}"]`).click();
  await expect(page.locator('.pin-route')).toBeVisible();
  await expect(page.locator('.component-teacher')).not.toHaveAttribute('open','');
  await page.screenshot({path:`../validation/module-${id}.png`});
  if(id==='D1'){await page.locator('#guideFullscreen').click();await page.locator('.component-body').evaluate(el=>el.scrollTop=0);await expect(page.locator('.pin-route')).toBeVisible();await page.screenshot({path:'../validation/module-D1-fullscreen.png'});await page.locator('#guideFullscreen').click();}
  await page.locator('[data-module-view="back"]').click();
  await page.locator('.component-panel [data-back]').click();
 }
 await page.screenshot({path:'../validation/assembly-photo-modules.png'});
 expect(errors).toEqual([]);
});

test('WebGL unavailable keeps a labelled 2D contact map',async({page})=>{
 await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:getContext.call(this,type,...args);};});
 await page.goto('/#assembly');await page.locator('#guideComponentSelect').selectOption('D1');
 await expect(page.locator('.module-stage')).toHaveAttribute('data-render-mode','2d');
 await expect(page.locator('[data-module-view="back"]')).toBeDisabled();
 await page.locator('[data-pin="VCC"]').click();await expect(page.locator('.pin-route')).toContainText('Батареї +');
});

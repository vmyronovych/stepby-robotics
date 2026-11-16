import {test,expect} from '@playwright/test';
import {serveBuiltSite} from './static-site.js';
test.beforeEach(async({page},testInfo)=>serveBuiltSite(page,testInfo));

const surfaces=[
 {name:'assembly',url:'/#assembly',target:'#guidePresentation',button:'#guideFullscreen',canvas:'#guideCanvas canvas',control:'#guideTop'},
 {name:'chassis',url:'/chassis-review.html',target:'#chassisPresentation',button:'#chassisFullscreen',canvas:'#chassis3d canvas',control:'[data-chassis-view="top"]'},
];
for(const surface of surfaces)for(const mode of ['native','unsupported','rejected']){
 test(`${surface.name} fullscreen: ${mode}, controls, exit and retained state`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(mode==='unsupported')await page.addInitScript(()=>{Element.prototype.requestFullscreen=undefined});
  if(mode==='rejected')await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Fullscreen denied'))});
  await page.route('**/api/info',r=>r.fulfill({status:503,body:'offline'}));
  await page.goto(surface.url);
  const target=page.locator(surface.target),button=page.locator(surface.button),canvas=page.locator(surface.canvas);
  await expect(canvas).toBeVisible();await expect(button).toBeEnabled();
  if(surface.name==='assembly'){
   await page.locator('#guideStepList button').nth(10).click();await page.locator('#guideLift').click();
  }else await page.locator('#hideUpper').check();
  const sizes=mode==='unsupported'?[[1440,950],[390,844],[844,390]]:[[1440,950]];
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await button.scrollIntoViewIfNeeded();
   const before=surface.name==='assembly'?await page.locator('#guideStageBadge').textContent():null;
   await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
   if(mode==='native')await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe(surface.target.slice(1));
   else expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();
   await expect(target).toHaveClass(/model-fullscreen/);
   await expect.poll(()=>target.evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(await page.evaluate(()=>innerWidth));
   await expect.poll(()=>target.evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(await page.evaluate(()=>innerHeight));
   expect(await target.evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1)).toBe(true);
   if(before){await expect(page.locator('#guideStageBadge')).toHaveText(before);await expect(page.locator('#guideLift')).toHaveAttribute('aria-pressed','true');}
   await page.locator(surface.control).click();await expect(button).toBeInViewport();
   if(surface.name==='assembly')await expect(page.locator('#guideFullscreenStop')).toHaveCount(0);
   else await expect(page.locator('#hideUpper')).toBeChecked();
   await page.screenshot({path:`../validation/fullscreen-${surface.name}-${mode}-${width}.png`});
   const state=before;
   // The browser event and fallback key handler must leave the guide open.
   await page.keyboard.press('Escape');await expect(button).toHaveAttribute('aria-pressed','false');
   await expect(target).not.toHaveClass(/model-fullscreen/);
   await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');
   if(state){await expect(page.locator('#assemblyGuide')).toBeVisible();await expect(page.locator('#guideStageBadge')).toHaveText(state);await expect(page.locator('#guideLift')).toHaveAttribute('aria-pressed','true');}
   await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
   await button.click();await expect(button).toHaveAttribute('aria-pressed','false');
  }
  expect(errors).toEqual([]);
 });
}

test('closing the guide during viewport presentation clears scroll lock',async({page})=>{
 await page.addInitScript(()=>{Element.prototype.requestFullscreen=undefined});
 await page.goto('/#assembly');await page.locator('#guideFullscreen').click();
 await expect(page.locator('#guideFullscreen')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>{location.hash=''});
 await expect(page.locator('#assemblyGuide')).not.toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');
 await page.locator('#assemblyButton').click();await expect(page.locator('#guideFullscreen')).toHaveAttribute('aria-pressed','false');
});

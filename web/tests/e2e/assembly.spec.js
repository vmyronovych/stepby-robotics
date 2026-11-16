import {test,expect}from'@playwright/test';
async function openGuide(page){await page.route('**/api/info',r=>r.fulfill({status:503,body:'offline'}));await page.goto('/#assembly');await expect(page.locator('#guideCanvas canvas')).toBeVisible();await expect(page.locator('#guideFallback')).toBeHidden();}
test('3D guide preserves the program, selects parts, rotates and saves current step',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await openGuide(page);
 const before=await page.evaluate(()=>window.__usbWorkshop.compile());
 const camera=await page.evaluate(()=>window.__assembly.snapshot.camera);await page.locator('#guideRotateRight').click();expect(await page.evaluate(()=>window.__assembly.snapshot.camera)).not.toEqual(camera);
 await page.locator('#guideNext').click();expect(await page.evaluate(()=>window.__assembly.snapshot.visible)).toHaveLength(1);
 const canvas=page.locator('#guideCanvas canvas');const r=await canvas.boundingBox();await canvas.click({position:{x:r.width/2,y:r.height/2}});await expect(page.locator('#guideSelection')).toContainText('Нижня акрилова');
 await page.locator('#guideNext').click();await expect(page.locator('#guideTitle')).toHaveText('Перший мотор');
 await page.locator('#guideAnimate').click();await page.waitForTimeout(1450);expect((await page.evaluate(()=>window.__assembly.snapshot.positions)).every(p=>p.position.every(v=>v===0))).toBe(true);
 await page.reload();await expect(page.locator('#guideTitle')).toHaveText('Перший мотор');await page.locator('#guideClose').click();await expect(page.locator('#assemblyGuide')).not.toBeVisible();expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toBe(before);expect(errors).toEqual([]);
});
test('all steps, service lift and backwards navigation remain mechanically consistent',async({page})=>{
 await openGuide(page);const steps=await page.evaluate(()=>window.__assembly.steps);
 for(let i=0;i<steps.length;i++){
  await page.evaluate(i=>window.__assembly.show(i),i);await expect(page.locator('#guideTitle')).toHaveText(steps[i].title);await expect(page.locator('[aria-current=step]')).toHaveCount(1);
  const snap=await page.evaluate(()=>window.__assembly.snapshot);expect(snap.lift).toBe(steps[i].lift||0);
  if(steps[i].stage<18)expect(snap.visible.some(k=>k.startsWith('cell'))).toBe(false);
 }
 await page.evaluate(()=>window.__assembly.show(9));await page.locator('#guideLift').click();expect(await page.evaluate(()=>window.__assembly.snapshot.lift)).toBe(82);
 await page.locator('#guidePrev').click();expect(await page.evaluate(()=>window.__assembly.snapshot.lift)).toBe(0);await expect(page.locator('#guideLift')).toBeDisabled();
 await page.locator('#guideBottom').click();await page.screenshot({path:'../validation/assembly-guide-sensor.png',fullPage:true});
});
test('guide remains usable on phone and sends no robot motion commands',async({page})=>{
 await page.setViewportSize({width:390,height:844});const commands=[];page.on('request',r=>{if(r.method()==='POST')commands.push(r.url())});await openGuide(page);
 await expect(page.locator('#guideStepSelect')).toBeVisible();await page.locator('#guideStepSelect').selectOption('19');await expect(page.locator('#guideTitle')).toHaveText('Встав чотири AA');
 expect(await page.evaluate(()=>window.__assembly.snapshot.lift)).toBe(0);expect(await page.evaluate(()=>window.__assembly.snapshot.camera[2])).toBeLessThan(0);expect(await page.evaluate(()=>document.querySelector('#assemblyGuide').scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('.guide-instruction').evaluate(e=>e.scrollIntoView({block:'start'}));await expect(page.locator('#guideAction')).toBeInViewport();await page.screenshot({path:'../validation/assembly-guide-mobile.png',fullPage:false});expect(commands).toEqual([]);
});
test('without WebGL, text instructions and step navigation still work',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return original.call(this,type,...rest)}});
 await page.goto('/#assembly');await expect(page.locator('#guideFallback')).toContainText('не зміг увімкнути 3D');await page.locator('#guideNext').click();await expect(page.locator('#guideTitle')).toHaveText('Знайди нижню платформу');await expect(page.locator('#guideCheck')).toContainText('без тріщин');
});
test('loaded guide continues offline without legacy robot APIs',async({page})=>{
 const requests=[];page.on('request',r=>{if(/\/(api\/info|status|stop)(?:[?#]|$)/.test(r.url()))requests.push(r.url());});
 await openGuide(page);await expect(page.locator('#guideStop')).toHaveCount(0);
 await page.context().setOffline(true);await page.locator('#guideNext').click();await expect(page.locator('#guideTitle')).toHaveText('Знайди нижню платформу');await page.locator('#guideTop').click();await expect(page.locator('#guideFallback')).toBeHidden();expect(requests).toEqual([]);
});

test('reviewed chassis and underside battery steps remain usable on desktop and phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await openGuide(page);
 await expect(page.locator('.guide-accuracy')).toContainText('255 × 150 мм, 72 отвори');
 for(const [name,width,height] of [['desktop',1440,950],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  for(const index of [0,1,6,9,19,20]){
   await page.evaluate(i=>window.__assembly.show(i),index);
   await page.locator('.guide-visual').evaluate(el=>el.scrollIntoView({block:'start'}));
   if([6,19,20].includes(index)){
    expect(await page.evaluate(()=>window.__assembly.snapshot.camera[2])).toBeLessThan(0);
    expect(await page.evaluate(()=>window.__assembly.snapshot.lift)).toBe(0);
   }
   expect(await page.evaluate(()=>document.querySelector('#assemblyGuide').scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`../validation/rebuilt-${name}-${index}.png`});
  }
  await page.locator('.guide-instruction').evaluate(el=>el.scrollIntoView({block:'start'}));
  await expect(page.locator('#guideCheck')).toContainText('3–4 мм');
  await page.screenshot({path:`../validation/rebuilt-${name}-check.png`});
 }
 expect(errors).toEqual([]);
});

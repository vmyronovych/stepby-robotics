import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
const origin = process.env.MCAR_PREVIEW_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({channel:'chrome',headless:true});
const errors=[], external=[];
try {
  for (const [name,viewport] of [['desktop',{width:1440,height:950}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url())});
    await page.goto(origin);
    await page.locator('#connectionSkip').click();
    await page.locator('.blocklySvg').waitFor();
    await page.locator('#codeButton').click();
    if(!(await page.locator('#codePreview').innerText()).includes('void setup()'))throw Error('Compiler failed');
    await page.locator('#closeCode').click();
    if(await page.evaluate(()=>!!window.__usbWorkshop||!!window.__assembly))throw Error('Development interface in production');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Horizontal page overflow');
    await page.screenshot({path:`../validation/workshop-production-${name}.png`,fullPage:true});
    await page.locator('#assemblyButton').click();
    await page.locator('#guideCanvas canvas').waitFor();
    if(await page.locator('#guideFallback').isVisible())throw Error('3D context failed');
    await page.screenshot({path:`../validation/assembly-guide-${name}.png`,fullPage:false});
    if(name==='desktop'){
      mkdirSync('../validation/assembly-steps',{recursive:true});
      const buttons=page.locator('#guideStepList button');
      for(let i=0;i<await buttons.count();i++){
        await buttons.nth(i).click();
        await page.locator('#guideCanvas').screenshot({path:`../validation/assembly-steps/step-${String(i+1).padStart(2,'0')}.png`});
        if(i===10)await page.screenshot({path:'../validation/assembly-expansion-30p.png',fullPage:false});
      }
      await buttons.nth(10).click();await page.locator('#guideTop').click();
      await page.screenshot({path:'../validation/assembly-expansion-top.png',fullPage:false});
    }else{
      await page.locator('#guideStepSelect').selectOption('10');
      await page.locator('.guide-instruction').evaluate(e=>e.scrollIntoView({block:'start'}));
      await page.screenshot({path:'../validation/assembly-expansion-mobile.png',fullPage:false});
    }
    await page.locator('#guideClose').click();
    await context.close();
  }
  if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));
  const result={production:true,compiler:true,assembly3D:true,developmentInterface:false,externalRequests:external,errors,hardwareConnected:false};
  writeFileSync('../validation/workshop-production.json',JSON.stringify(result,null,2)+'\n');
  writeFileSync('../validation/assembly-production.json',JSON.stringify({steps:23,errors,external,webgl:true,developmentInterface:false,hardwareTested:false,hardware:'ESP32 38-pin + ESP32S 38P'},null,2)+'\n');
  console.log(result);
} finally {await browser.close()}

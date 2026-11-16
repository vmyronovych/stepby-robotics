// Explicit physical-board acceptance test. Never part of the normal test suite.
// Running this script replaces the selected ESP32's firmware with the blink example.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/usb.html?transport=local');await page.locator('#flashProgram').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.getElementById('flashProgram').disabled,{timeout:10000});
 await page.locator('#flashProgram').click();
 let phase='';const deadline=Date.now()+300000;let result;
 while(Date.now()<deadline){
  const state=await page.evaluate(()=>fetch('/api/usb/status').then(r=>r.json()));
  if(state.job?.phase!==phase){phase=state.job?.phase;console.log(phase,state.job?.message);}
  if(state.job?.finished){result=state.job;break;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!result)throw Error('Hardware test timed out');
 await writeFile('../validation/usb-blocks-hardware.json',JSON.stringify({phase:result.phase,message:result.message,log:result.log,pageErrors:errors},null,2));
 await page.waitForFunction(()=>document.getElementById('usbStatus').textContent.includes('Прошито!'),{timeout:10000});
 await page.screenshot({path:'../validation/usb-workshop-hardware.png'});
 if(result.phase!=='done'||errors.length)throw Error(JSON.stringify({phase:result.phase,errors}));
 console.log(result.log.slice(-2200));
 console.log('PASS: browser button -> block compilation -> USB flash -> real ESP32 boot');
}finally{await browser.close();}

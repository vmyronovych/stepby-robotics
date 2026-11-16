// Explicit hardware acceptance check. Not run by npm test or CI.
// Writes the default blink program to the connected ESP32 via REAL Chrome Web Serial.
import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
if(!process.argv.includes('--flash-connected-esp32'))throw Error('Use --flash-connected-esp32 to authorize replacing the connected board program.');
const root=path.resolve(import.meta.dirname,'../dist'),evidence=path.resolve(import.meta.dirname,'../../validation');
const server=http.createServer(async(req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname;if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();const data=await fs.readFile(file);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),session=await page.context().newCDPSession(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
let selected=false;
try{
 await session.send('DeviceAccess.enable');
 session.on('DeviceAccess.deviceRequestPrompted',async event=>{
  if(selected)return;const matching=event.devices.filter(d=>/CP210|usbserial-0001/i.test(d.name));
  if(matching.length===1){selected=true;console.log('Selecting connected CP210 ESP32 in Chrome chooser');await session.send('DeviceAccess.selectPrompt',{id:event.id,deviceId:matching[0].id});}
  else console.log('Serial chooser: no unique known CP210 board',event.devices.map(d=>d.name));
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#flashProgram').click();
 await page.waitForFunction(()=>['done','warning','error'].includes(document.getElementById('flashCard').dataset.state),{},{timeout:210000});
 const result={state:await page.locator('#flashCard').getAttribute('data-state'),message:await page.locator('#usbStatus').innerText(),log:await page.locator('#usbLog').innerText(),errors,selected,transport:'Chrome Web Serial; static HTTP server, no local compile/flash API'};
 await fs.writeFile(path.join(evidence,'browser-usb-hardware.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(evidence,'browser-usb-hardware.png')});
 console.log(JSON.stringify({state:result.state,message:result.message,selected,errors,serial:result.log.split('\n').filter(l=>/MCAR_BROWSER|LED2=|PROGRAM_ERROR|Hash of data/.test(l))},null,2));
 if(result.state!=='done'||errors.length)process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

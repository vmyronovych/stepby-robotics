import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {driverBreadboard} from '../driver-breadboard-fixture.mjs';
const pin=(page,key)=>page.locator(`.wire-pin[data-endpoint="${key}"]`);
test('insert all driver legs, wire through strips, carry, rotate, undo, save and detach',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 const wiring=driverBreadboard();wiring.components[1].x-=210;wiring.components[1].y-=150;wiring.components.push({id:'esp',kind:'esp32',name:'ESP32',x:20,y:20});
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Драйвер у breadboard',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),wiring);await page.locator('#openWiring').click();
 const component=id=>page.locator(`.wiring-component[data-component="${id}"]`),driver=component('drv');
 await driver.click();await expect(page.locator('.wiring-side')).toContainText('всі 12 отворів');
 const a=await pin(page,'drv:SLEEP').boundingBox(),b=await pin(page,'bb:B10').boundingBox(),h=await driver.boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+b.x+b.width/2-a.x-a.width/2,y+b.y+b.height/2-a.y-a.height/2,{steps:12});await expect(page.locator('.mount-preview')).toHaveCount(12);await page.mouse.up();
 await expect(driver).toHaveAttribute('data-inserted','true');await expect(page.locator('.wiring-mount-status')).toContainText('IN1 → F5');await expect(page.locator('.wire-hit')).toHaveCount(0);
 async function aligned(){for(const [name,hole]of Object.entries({SLEEP:'B10',OUT1:'B9',OUT2:'B8',OUT3:'B7',OUT4:'B6',FAULT:'B5',IN4:'F10',IN3:'F9',GND:'F8',VCC:'F7',IN2:'F6',IN1:'F5'})){const a=await pin(page,`drv:${name}`).boundingBox(),b=await pin(page,`bb:${hole}`).boundingBox();expect(Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2)).toBeLessThan(1);}}
 await aligned();await page.locator('[data-undo]').click();await expect(driver).toHaveAttribute('data-inserted','false');await page.locator('[data-redo]').click();await aligned();
 await pin(page,'esp:right-11').click();await page.getByRole('button',{name:'Під’єднати провід',exact:true}).click();await pin(page,'bb:J5').click();await expect(page.locator('.wire-hit')).toHaveCount(1);await pin(page,'drv:IN1').click();await expect(page.locator('.wiring-side')).toContainText('GPIO16');await page.keyboard.press('Escape');
 const header=component('bb');await header.click({position:{x:12,y:12}});const r=await header.boundingBox();await page.mouse.move(r.x+12,r.y+12);await page.mouse.down();await page.mouse.move(r.x+47,r.y+37,{steps:5});await page.mouse.up();await aligned();
 await page.keyboard.press('KeyR');await expect(component('bb')).toHaveAttribute('data-rotation','90');await aligned();await page.locator('[data-undo]').click();await aligned();
 await driver.locator('.wiring-part-grip rect').click();await page.screenshot({path:'../validation/driver-breadboard.png'});await page.locator('[data-apply]').click();const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(Object.keys(saved.workspace.wiring.components.find(c=>c.id==='drv').breadboardMount.holes)).toHaveLength(12);
 await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);await page.locator('#openWiring').click();await aligned();await driver.locator('.wiring-part-grip rect').click();await page.keyboard.press('KeyR');await expect(driver).toHaveAttribute('data-inserted','false');await page.locator('[data-undo]').click();await aligned();
 await driver.locator('.wiring-part-grip rect').click();await page.getByRole('button',{name:'Витягнути з breadboard',exact:true}).click();await expect(driver).toHaveAttribute('data-inserted','false');await page.locator('[data-undo]').click();await aligned();
 await header.click({position:{x:12,y:12}});await page.keyboard.press('Delete');await expect(component('bb')).toHaveCount(0);await expect(driver).toHaveAttribute('data-inserted','false');await page.locator('[data-undo]').click();await aligned();expect(errors).toEqual([]);
});

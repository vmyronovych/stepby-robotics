import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
test('physical expansion contacts show GPIO modes, power docs and jumper navigation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 await page.evaluate(()=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Розпіновка',workspace:{blocks:{languageVersion:0,blocks:[]},wiring:{version:1,components:[{id:'esp',kind:'esp32',name:'ESP32',x:30,y:30,expansion:'esp32s-38p'}],wires:[],checked:[]}}}));
 await page.locator('#openWiring').click();
 const doc=page.getByRole('region',{name:'Документація контакту'});
 async function select(id){await page.locator(`.wire-pin[data-endpoint="esp:exp-${id}"]`).click();await expect(doc).toBeVisible();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');}
 await select('bottom-S-3');await expect(doc).toContainText('GPIO34');await expect(doc).toContainText('Лише вхід');await expect(doc.locator('li')).toHaveCount(2);
 await select('top-S-9');await expect(doc).toContainText('GPIO16');await expect(doc).toContainText('ШІМ');await expect(doc.locator('li')).toHaveCount(4);
 await page.screenshot({path:'../validation/expansion-pin-documentation.png'});
 await doc.getByRole('button',{name:'Показати контакт на ESP32'}).click();await expect(page.locator('.wiring-side h3')).toContainText('GPIO16');
 await select('bottom-G-3');await expect(doc).toContainText('Спільний «мінус»');await expect(doc.locator('li')).toHaveCount(0);
 await select('aux-top-2');await expect(doc).toContainText('Напруга VCC на цій гребінці не підтверджена');
 await select('aux-bottom-1');await expect(doc).toContainText('GPIO21');
 await select('top-V-9');await expect(doc).toContainText('На схемі обрано 5 В');await doc.getByRole('button',{name:'Показати перемичку JUMP'}).click();await expect(page.locator('.wiring-side h3')).toHaveText('Перемичка JUMP');
 await page.locator('[data-apply]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.wires.length)).toBe(0);
 expect(errors).toEqual([]);
});

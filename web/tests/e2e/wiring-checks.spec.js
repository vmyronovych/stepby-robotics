import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {expansionBreadboard} from '../expansion-breadboard-fixture.mjs';

test('check summary names missing connections while supported expansion pins work without a checkbox',async({page})=>{
 const wiring=expansionBreadboard();
 wiring.components.push({id:'motor',kind:'motor',name:'Мотор',x:700,y:600},{id:'usb',kind:'usb',name:'USB',x:800,y:80},{id:'bat',kind:'battery',name:'Батареї',x:800,y:300});
 wiring.wires=[['esp:exp-bottom-S-7','bb:A1'],['esp:exp-bottom-S-8','bb:A2'],['esp:exp-bottom-G-9','bb:A3'],['drv:OUT1','motor:B'],['drv:OUT2','motor:A'],['usb:USB','esp:USB'],['bat:PLUS','bb:B4'],['bat:GND','bb:B3']].map(([a,b],i)=>({id:'w'+i,a,b,color:'#328f83'}));
 await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Перевірка',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),wiring);
 await page.locator('#openWiring').click();await page.locator('[data-checks]').click();
 const missing=page.getByRole('region',{name:'Незавершені підключення',exact:true});
 await expect(missing.locator('[data-issue="motor-control"]')).toHaveCount(2);
 await expect(missing).toContainText('IN1');await expect(missing).toContainText('IN2');await expect(missing).toContainText('C6');await expect(missing).toContainText('C5');
 expect(await page.locator('.wiring-side').evaluate(side=>{const status=side.querySelector('.wiring-status');return status.nextElementSibling?.getAttribute('aria-label')==='Незавершені підключення';})).toBe(true);
 await page.screenshot({path:'../validation/wiring-actionable-checks.png'});
 await missing.locator('[data-issue="motor-control"]').filter({hasText:'IN1'}).click();
 await expect(page.locator('.wire-pin[data-endpoint="drv:IN1"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-signals-verification]')).toHaveCount(0);
 await expect(page.locator('.wiring-side')).not.toContainText('звір контакти S/G');
 await page.locator('[data-apply]').click();
 const actual=await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring);expect(actual.wires).toEqual(wiring.wires);expect(actual.components[0].signalsVerified).toBe(false); // Old metadata is harmless.
 await page.getByRole('treeitem',{name:'Підключені піни',exact:true}).click();await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO25');await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO26');
});

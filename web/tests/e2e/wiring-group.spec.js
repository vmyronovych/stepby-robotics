import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {driverBreadboard} from '../driver-breadboard-fixture.mjs';
import {seatComponent,syncMounts} from '../../src/breadboard-mount.js';
test('select battery and breadboard, move their mounted parts and wires, undo and save',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 const wiring=driverBreadboard();seatComponent(wiring,wiring.components[1]);syncMounts(wiring);
 wiring.components.push({id:'bat',kind:'battery',name:'Батарейки',x:60,y:220});
 wiring.wires.push({id:'power',a:'bat:PLUS',b:'bb:J1',color:'#d64545',vertices:[{x:260,y:700},{x:380,y:700}]});
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Група',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),wiring);
 await page.locator('#openWiring').click();
 const component=id=>page.locator(`.wiring-component[data-component="${id}"]`);
 await component('bat').click({position:{x:12,y:12}});await component('bb').click({position:{x:12,y:12},modifiers:['Shift']});
 await expect(page.locator('.wiring-component[data-selected="true"]')).toHaveCount(2);
 await expect(page.locator('.wiring-side')).toContainText('Вибрано компонентів: 2');
 const positions=()=>page.locator('.wiring-component').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.component,[parseFloat(n.style.left),parseFloat(n.style.top)]])));
 const before=await positions(),box=await component('bat').boundingBox();
 await page.mouse.move(box.x+12,box.y+12);await page.mouse.down();await page.mouse.move(box.x+72,box.y+52,{steps:8});await page.mouse.up();
 const after=await positions(),dx=after.bat[0]-before.bat[0],dy=after.bat[1]-before.bat[1];expect(dx).toBeGreaterThan(0);expect(dy).toBeGreaterThan(0);
 for(const id of ['bb','drv']){expect(after[id][0]-before[id][0]).toBeCloseTo(dx);expect(after[id][1]-before[id][1]).toBeCloseTo(dy);}
 await expect(component('drv')).toHaveAttribute('data-inserted','true');
 await page.locator('[data-undo]').click();expect(await positions()).toEqual(before);await page.locator('[data-redo]').click();expect(await positions()).toEqual(after);
 // Touch-friendly selection toggle also adds/removes a component without moving it.
 await page.locator('[data-multi-select]').click();await component('bat').click({position:{x:12,y:12}});await expect(component('bat')).toHaveAttribute('data-selected','false');await component('bat').click({position:{x:12,y:12}});await page.locator('[data-multi-select]').click();
 await expect(page.locator('.wiring-component[data-selected="true"]')).toHaveCount(2);
 await page.locator('[data-apply]').click();
 const saved=await page.evaluate(()=>window.__usbWorkshop.project());const wire=saved.workspace.wiring.wires[0];
 expect(wire.vertices).toEqual(wiring.wires[0].vertices.map(p=>({x:p.x+dx,y:p.y+dy})));expect(saved.workspace.wiring.components.find(c=>c.id==='drv').breadboardMount).toEqual(wiring.components[1].breadboardMount);
 expect(errors).toEqual([]);
});

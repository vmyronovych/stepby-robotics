import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {expansionBreadboard} from '../expansion-breadboard-fixture.mjs';
function circuit(){const state=expansionBreadboard();state.components=state.components.filter(c=>c.id!=='esp');Object.assign(state.components[0],{x:50,y:40});state.components.push({id:'motor',kind:'motor',name:'Мотор',x:780,y:90});state.wires=[{id:'out',a:'drv:OUT2',b:'motor:A',color:'#9270b3',vertices:[{x:700,y:550}]},{id:'other',a:'drv:OUT1',b:'motor:B',color:'#546b80'}];state.checked=['out'];return state;}
const pin=(page,key)=>page.locator(`.wire-pin[data-endpoint="${key}"]`);
async function open(page,state=circuit()){
 await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Перенесення проводів',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),state);
 await page.locator('#openWiring').click();await expect(page.locator('.wire-hit')).toHaveCount(state.wires.length);
}
async function center(locator){const r=await locator.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};}
async function drag(page,from,to,{cancel=false,shift=false,beforeDrop}={}){
 const a=await center(from),b=await center(to);if(shift)await page.keyboard.down('Shift');await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});
 if(beforeDrop)await beforeDrop();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();if(shift)await page.keyboard.up('Shift');
}
const handle=(page,end='a')=>page.locator(`[data-route-handle="endpoint"][data-wire="out"][data-index="${end}"]`);
async function saved(page){await page.locator('[data-apply]').click();return page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring);}
async function selectWire(page){if(!await page.locator('.wiring-wire-list').isVisible())await page.locator('[data-checks]').click();await page.locator('.wiring-wire-list button').filter({hasText:'OUT2'}).filter({hasText:'Провід A'}).click();}

test('drag OUT2 to OUT4 on mounted driver preserves wire, color, bends and supports undo/redo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const original=circuit();await open(page,original);
 await selectWire(page);
 await drag(page,handle(page),pin(page,'drv:OUT4'));
 await expect(page.locator('.wire-hit')).toHaveCount(2);await expect(page.locator('.wiring-side')).toContainText('OUT4 → Мотор · Провід A');
 await expect(page.locator('[data-route-handle="endpoint"][data-wire="out"]')).toHaveCount(2);
 await page.screenshot({path:'../validation/wiring-endpoint-drag.png'});
 await page.locator('[data-undo]').click();await expect(page.locator('.wiring-side')).toContainText('OUT2 → Мотор · Провід A');
 await page.locator('[data-redo]').click();const actual=await saved(page);
 expect(actual.wires).toEqual([{...original.wires[0],a:'drv:OUT4'},original.wires[1]]);expect(actual.checked).toEqual([]);expect(errors).toEqual([]);
 await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);expect((await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring)).wires).toEqual(actual.wires);
});

test('drag the other stored end; invalid targets, same pin, blank canvas and Escape do not change wiring',async({page})=>{
 const original=circuit();original.wires[0]={...original.wires[0],a:'motor:A',b:'drv:OUT2'};await open(page,original);
 await selectWire(page);await drag(page,handle(page,'b'),pin(page,'drv:OUT4'),{cancel:true});await expect(page.locator('#wiringDialog')).toBeVisible();
 await drag(page,handle(page,'b'),pin(page,'motor:A'));await expect(page.locator('.wiring-hint')).toContainText('Обидва кінці');
 const end=page.locator('[data-route-handle="endpoint"][data-wire="out"][data-index="b"]');
 await drag(page,end,end);
 const a=await center(end),viewport=await page.locator('.wiring-scroll').boundingBox();await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(viewport.x+viewport.width-50,viewport.y+viewport.height-50,{steps:8});await page.mouse.up();await expect(page.locator('.wiring-hint')).toContainText('залишено на місці');
 expect((await saved(page)).wires).toEqual(original.wires);
 await page.locator('#openWiring').click();await selectWire(page);await drag(page,handle(page,'b'),pin(page,'drv:OUT4'));
 expect((await saved(page)).wires[0]).toEqual({...original.wires[0],b:'drv:OUT4'});
});

test('shared pins require choosing a wire and endpoint handles move only that wire',async({page})=>{
 const original=circuit();original.wires.push({id:'branch',a:'drv:OUT2',b:'bb:J10',color:'#ff0000'});await open(page,original);
 await pin(page,'drv:OUT2').click();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');await expect(page.locator('.wire-hit')).toHaveCount(3);
 await selectWire(page);const end=page.locator('[data-route-handle="endpoint"][data-wire="out"][data-index="a"]');await drag(page,end,pin(page,'drv:OUT4'));
 expect((await saved(page)).wires).toEqual([{...original.wires[0],a:'drv:OUT4'},...original.wires.slice(1)]);
});

test('endpoint keyboard replacement and Shift drag keep creation available at connected pins',async({page})=>{
 const original=circuit();await open(page,original);await selectWire(page);
 const end=page.locator('[data-route-handle="endpoint"][data-wire="out"][data-index="a"]');
 await end.focus();await page.keyboard.press('Enter');await pin(page,'drv:OUT4').click();
 let actual=await saved(page);expect(actual.wires[0]).toEqual({...original.wires[0],a:'drv:OUT4'});
 await page.locator('#openWiring').click();await drag(page,pin(page,'drv:OUT4'),pin(page,'bb:J10'),{shift:true});actual=await saved(page);expect(actual.wires).toHaveLength(3);expect(actual.wires[0]).toEqual({...original.wires[0],a:'drv:OUT4'});expect(actual.wires[2].a).toBe('drv:OUT4');expect(actual.wires[2].b).toBe('bb:J10');
});

test('a duplicate connection is rejected without altering the existing wire or audit state',async({page})=>{
 const original=circuit();original.wires.push({id:'duplicate',a:'drv:OUT4',b:'motor:A',color:'#328f83'});await open(page,original);
 await selectWire(page);await drag(page,handle(page),pin(page,'drv:OUT4'),{beforeDrop:async()=>{await expect(page.locator('.wiring-hint')).toContainText('вже є провід');await expect(pin(page,'drv:OUT4')).toHaveAttribute('data-drop-target','invalid');}});await expect(page.locator('[data-undo]')).toBeDisabled();
 const actual=await saved(page);expect(actual.wires).toEqual(original.wires);expect(actual.checked).toEqual(original.checked);
});

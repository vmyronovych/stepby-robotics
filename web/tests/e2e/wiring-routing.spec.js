import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {breadboardCircuit} from '../breadboard-fixture.mjs';
async function open(page){await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);const wiring=breadboardCircuit();Object.assign(wiring.components[0],{x:40,y:30,rotation:270});Object.assign(wiring.components[2],{x:40,y:360});await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Акуратні проводи',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),wiring);await page.locator('#openWiring').click();await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','libavoid');}
const settled=page=>expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','libavoid');
const route=page=>page.locator('.wire-hit[data-wire="w2"]');
async function selectWire(page){await page.locator('[data-checks]').click();await page.locator('.wiring-wire-list button').filter({hasText:'F6'}).click();}
test('automatic routes are compact; drag segments, undo, persist, then reset all routes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);const initial=await route(page).getAttribute('data-points');expect(JSON.parse(initial)).toHaveLength(3);
 await selectWire(page);const handles=page.locator('[data-route-handle="segment"][data-wire="w2"]');await expect(handles).toHaveCount(2);
 const horizontal=page.getByRole('button',{name:'Зсунути горизонтальний відрізок проводу',exact:true}),r=await horizontal.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height/2-40,{steps:5});await page.mouse.up();
 await expect(page.locator('[data-auto-route]')).toBeEnabled();await settled(page);expect(await route(page).getAttribute('data-points')).not.toBe(initial);
 await settled(page);const manual=await route(page).getAttribute('data-points');await page.locator('[data-undo]').click();expect(await route(page).getAttribute('data-points')).toBe(initial);await page.locator('[data-redo]').click();expect(await route(page).getAttribute('data-points')).toBe(manual);
 await page.screenshot({path:'../validation/wiring-manual-routing.png'});await page.locator('[data-apply]').click();const saved=await page.evaluate(()=>window.__usbWorkshop.project());const wire=saved.workspace.wiring.wires.find(w=>w.id==='w2');expect(wire.vertices.length).toBeGreaterThan(0);expect([wire.a,wire.b]).toEqual(['bb:F6','esp:left-13']);expect(saved.workspace.wiring.components.filter(c=>c.breadboardMount)).toHaveLength(2);
 await page.evaluate(s=>window.__usbWorkshop.load(s),saved);await page.locator('#openWiring').click();await settled(page);expect(await route(page).getAttribute('data-points')).toBe(manual);
 await page.locator('[data-arrange-wires]').click();await settled(page);expect(await route(page).getAttribute('data-points')).toBe(initial);await page.locator('[data-apply]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.wires.some(w=>w.vertices))).toBe(false);expect(errors).toEqual([]);
});
test('manual bends support keyboard, cancellation and do not alter the project until applied',async({page})=>{
 await open(page);await selectWire(page);const initial=await route(page).getAttribute('data-points');
 const handle=page.getByRole('button',{name:'Зсунути горизонтальний відрізок проводу',exact:true});await handle.focus();await page.keyboard.press('ArrowUp');await expect(page.locator('[data-route-handle="vertex"]')).toHaveCount(2);await settled(page);
 const point=page.locator('[data-route-handle="vertex"]').first(),before=await route(page).getAttribute('data-points'),r=await point.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+24,r.y+r.height/2-24,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();await settled(page);expect(await route(page).getAttribute('data-points')).toBe(before);
 await page.locator('[data-route-handle="vertex"]').first().focus();await page.keyboard.press('Delete');await expect(page.locator('[data-route-handle="vertex"]')).toHaveCount(1);
 await page.locator('[data-auto-route]').click();await settled(page);expect(await route(page).getAttribute('data-points')).toBe(initial);
 await page.locator('.wiring-header [data-close]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.wires.some(w=>w.vertices))).toBe(false);
});

test('double click adds a bend and a missing WASM file retains usable fallback wiring',async({page})=>{
 await open(page);await selectWire(page);
 const click=await route(page).evaluate(path=>{const points=JSON.parse(path.dataset.points),board=document.querySelector('.wiring-board'),r=board.getBoundingClientRect(),scale=r.width/board.offsetWidth;for(let i=0;i<points.length-1;i++)for(const t of [.25,.35,.65,.75]){const a=points[i],b=points[i+1],x=r.x+(a.x+(b.x-a.x)*t)*scale,y=r.y+(a.y+(b.y-a.y)*t)*scale;if(document.elementFromPoint(x,y)?.classList.contains('wire-hit'))return {x,y};}throw Error('No clickable segment');});
 await page.mouse.dblclick(click.x,click.y);await expect(page.locator('[data-route-handle="vertex"]')).not.toHaveCount(0);
 await page.locator('[data-auto-route]').click();await expect(page.locator('[data-route-handle="vertex"]')).toHaveCount(0);
 await page.route('**/libavoid.wasm*',r=>r.abort());await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);await page.locator('#openWiring').click();await expect(page.locator('.wiring-hint')).toContainText('спрощене');await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','fallback');await expect(page.locator('.wire-hit')).toHaveCount(3);
 await page.unroute('**/libavoid.wasm*');await page.locator('.wiring-header [data-close]').click();await page.locator('#openWiring').click();await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','libavoid');
});

test('a stalled router cannot freeze editing and falls back after its deadline',async({page})=>{
 await open(page);await page.locator('.wiring-header [data-close]').click();
 await page.route('**/wiring-router-worker.js*',r=>r.fulfill({contentType:'application/javascript',body:"self.onmessage=({data})=>{if(data.type==='init')self.postMessage({type:'ready'});};"}));
 await page.locator('#openWiring').click();await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','routing');
 await page.locator('[data-checks]').click();await expect(page.locator('.wiring-wire-list')).toBeVisible();
 await expect(page.locator('.wiring-lines')).toHaveAttribute('data-router','fallback');await expect(page.locator('.wire-hit')).toHaveCount(3);
 await page.locator('.wiring-header [data-close]').click();await expect(page.locator('#openWiring')).toBeVisible();
});

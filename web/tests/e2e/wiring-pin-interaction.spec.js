import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {fixture,program} from '../wiring-fixture.mjs';
const pin=(page,key)=>page.locator(`.wire-pin[data-endpoint="${key}"]`);
const connect=page=>page.getByRole('button',{name:'Під’єднати провід',exact:true});
async function open(page){await installSerial(page,{granted:true});await page.goto('/');await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(workspace=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Перегляд контактів',workspace}),program());await page.locator('#openWiring').click();}
async function save(page){await page.locator('[data-apply]').click();return page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring);}
async function drag(page,from,to,{cancel=false,preview}={}){const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});if(preview)await preview();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();}

test('clicking or keyboard-selecting GPIOs only changes documentation, never wires or undo history',async({page})=>{
 await open(page);
 for(const key of ['esp:left-6','esp:left-7','drv:IN1','esp:right-11']){await pin(page,key).click();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');await expect(connect(page)).toBeVisible();}
 await pin(page,'esp:left-7').focus();await page.keyboard.press('Enter');await expect(page.locator('.wiring-side h3')).toHaveText('ESP32 · GPIO33');
 await expect(page.locator('[data-undo]')).toBeDisabled();await expect(page.locator('.wire-hit')).toHaveCount(8);await expect(page.locator('.wiring-lines [stroke-dasharray],.wiring-lines [style*="stroke-dasharray"]')).toHaveCount(0);
 await page.screenshot({path:'../validation/wiring-pin-inspect.png'});
 expect((await save(page)).wires).toEqual(fixture().wires);
});

test('explicit connect supports keyboard, cancellation, one-shot creation and undo',async({page})=>{
 await open(page);await pin(page,'esp:right-1').click();await connect(page).click();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','true');await page.keyboard.press('Escape');await expect(page.locator('#wiringDialog')).toBeVisible();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 await connect(page).click();await page.getByRole('button',{name:'Скасувати підключення',exact:true}).click();await expect(page.locator('.wire-hit')).toHaveCount(8);
 await connect(page).focus();await page.keyboard.press('Enter');await pin(page,'drv:IN3').focus();await page.keyboard.press('Enter');await expect(page.locator('.wire-hit')).toHaveCount(9);await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 await pin(page,'esp:left-6').click();await pin(page,'esp:left-7').click();await expect(page.locator('.wire-hit')).toHaveCount(9);
 await page.locator('[data-undo]').click();await expect(page.locator('.wire-hit')).toHaveCount(8);await page.locator('[data-redo]').click();const result=await save(page);expect(result.wires.slice(0,8)).toEqual(fixture().wires);expect(result.wires[8]).toMatchObject({a:'esp:right-1',b:'drv:IN3'});
});

test('dragging from an already connected pin adds a wire; Escape, blank and duplicate drops leave no pending connection',async({page})=>{
 await open(page);
 await drag(page,pin(page,'esp:right-11'),pin(page,'drv:IN3'),{cancel:true});await expect(page.locator('.wire-hit')).toHaveCount(8);await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 const a=await pin(page,'esp:right-11').boundingBox(),v=await page.locator('.wiring-scroll').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(v.x+v.width-30,v.y+v.height-30,{steps:10});await page.mouse.up();await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 await drag(page,pin(page,'esp:right-11'),pin(page,'drv:IN1'),{preview:async()=>{await expect(pin(page,'drv:IN1')).toHaveAttribute('data-drop-target','invalid');}});await expect(page.locator('.wire-hit')).toHaveCount(8);await expect(page.locator('[data-undo]')).toBeDisabled();
 await drag(page,pin(page,'esp:right-11'),pin(page,'drv:IN3'),{preview:async()=>{await expect(pin(page,'drv:IN3')).toHaveAttribute('data-drop-target','valid');}});await expect(page.locator('.wire-hit')).toHaveCount(9);await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 const result=await save(page);expect(result.wires.slice(0,8)).toEqual(fixture().wires);expect(result.wires[8]).toMatchObject({a:'esp:right-11',b:'drv:IN3'});
});

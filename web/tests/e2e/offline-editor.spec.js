import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';

test('enter without USB, edit a schema, reload, then connect without losing or flashing the project',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSerial(page);await page.goto('/usb.html');
 await expect(page.locator('#connectionTitle')).toHaveText('Підключи свою ESP32');await page.locator('#connectionSkip').click();
 await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#app')).not.toHaveAttribute('inert','');await expect(page.locator('#statusTitle')).toHaveText('Працюємо без плати');await expect(page.locator('#usbBadge')).toHaveText('Без плати');
 await page.locator('#projectName').fill('Без USB');await page.locator('#openWiring').click();await page.locator('[data-catalog="breadboard"]').click();await page.locator('[data-apply]').click();
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('void setup');await page.locator('#closeCode').click();
 const download=page.waitForEvent('download');await page.locator('#saveProject').click();expect((await download).suggestedFilename()).toBe('Без USB.mcar');
 const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(saved.workspace.wiring.components[0].kind).toBe('breadboard');expect(await page.evaluate(()=>window.serialFixture.commands)).toEqual([]);
 await page.reload();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#projectName')).toHaveValue('Без USB');await expect(page.locator('#flashLabel')).toHaveText('Підключити ESP32');
 expect(await page.evaluate(()=>window.__usbWorkshop.project())).toEqual(saved);
 await page.locator('#flashProgram').click();await expect(page.locator('#flashLabel')).toHaveText('Прошити програму');await expect(page.locator('#app')).toBeVisible();
 expect(await page.evaluate(()=>window.serialFixture.commands.every(c=>c.includes(' HELLO ')))).toBe(true);expect(await page.evaluate(()=>window.__usbWorkshop.project())).toEqual(saved);
 expect(errors).toEqual([]);
});

test('USB-unsupported browsers can edit and save with an explanation for disabled flashing',async({page})=>{
 await installSerial(page,{unsupported:true});await page.goto('/usb.html');await expect(page.locator('#connectionScreen')).toHaveAttribute('data-step','unsupported');await page.locator('#connectionSkip').click();
 await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#flashProgram')).toBeDisabled();await expect(page.locator('#activityHint')).toContainText('Chrome або Edge');
 await page.locator('#openPinEditor').click();await page.keyboard.press('Escape');await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Моя команда');await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#app')).toBeVisible();await page.screenshot({path:'../validation/usb-editor-without-board-mobile.png',fullPage:true});
});

test('cancelled late connection returns to a screen with the option to keep editing',async({page})=>{
 await installSerial(page,{cancel:true});await page.goto('/usb.html');await page.locator('#connectionSkip').click();await page.locator('#projectName').fill('Не загубити');await page.locator('#flashProgram').click();
 await expect(page.locator('#connectionSkip')).toBeVisible();await page.locator('#connectionSkip').click();await expect(page.locator('#projectName')).toHaveValue('Не загубити');await expect(page.locator('#app')).toBeVisible();
});

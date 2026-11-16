import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';

async function open(page){await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(()=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,...window.__usbWorkshop.examples.empty}));await page.locator('#openPinEditor').click();await expect(page.locator('#pinDialog')).toBeVisible();await expect(page.locator('#pinStage .module-pin')).toHaveCount(38);}
async function choose(page,pin){await page.locator(`#pinStage .module-pin[data-pin="${pin}"] span`).click();}
test('38-pin board creates connected PWM and input blocks, preserves selection and supports undo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await expect(page.locator('#pinName')).toHaveText('GPIO2');
 await page.locator('[data-action="pwm"]').click();await page.locator('#pinDuty').fill('64');await expect(page.locator('#pinPreview')).toContainText('64');
 await page.screenshot({path:'../validation/usb-pins-desktop.png'});
 await page.locator('#addPinBlock').click();await expect(page.locator('#pinDialog')).not.toBeVisible();
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(2, 64.000000f)');await page.locator('#closeCode').click();
 await page.locator('#openPinEditor').click();await choose(page,'left-5');await expect(page.locator('#pinName')).toHaveText('GPIO35');await expect(page.locator('[data-action="write"]')).toHaveCount(0);await expect(page.locator('[data-action="pullup"]')).toHaveCount(0);
 await page.locator('[data-action="analog"]').click();await page.locator('#addPinBlock').click();
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarAnalog(35)');await page.locator('#closeCode').click();
 await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().find(b=>b.type==='usb_pin_pwm').select());await page.locator('#openPinEditor').click();await expect(page.locator('#pinName')).toHaveText('GPIO2');await expect(page.locator('[data-pin="right-14"]')).toHaveAttribute('aria-pressed','true');
 await choose(page,'left-12');await expect(page.locator('#pinWarning')).toBeVisible();
 await choose(page,'left-15');await expect(page.locator('#pinName')).toHaveText('SD2');await expect(page.locator('#addPinBlock')).toBeHidden();await expect(page.locator('#pinDescription')).toContainText('пам’яттю');
 await choose(page,'right-3');await expect(page.locator('#pinDescription')).toContainText('USB');await expect(page.locator('#addPinBlock')).toBeHidden();
 await choose(page,'left-14');await page.locator('[data-action="pullup"]').click();await expect(page.locator('.pin-wire')).toContainText('GND');await page.locator('#addPinBlock').click();
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarRead(13, true) == 0');await page.locator('#closeCode').click();
 await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));expect(await page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().some(b=>b.type==='usb_pin_button'))).toBe(false);
 expect(errors).toEqual([]);
});
test('pin dialog fits a phone, supports keyboard close and keeps all labels inside the board view',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await expect(page.locator('#pinStage .module-pin')).toHaveCount(38);
 const bounds=await page.evaluate(()=>{const r=document.querySelector('#pinStage').getBoundingClientRect();return [...document.querySelectorAll('#pinStage .module-pin span')].every(el=>{const b=el.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;});});expect(bounds).toBe(true);
 await choose(page,'left-4');await page.locator('[data-action="read"]').scrollIntoViewIfNeeded();await expect(page.locator('#pinName')).toHaveText('GPIO34');
 await page.screenshot({path:'../validation/usb-pins-mobile.png',fullPage:true});
 expect(await page.locator('#pinDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#pinDialog')).not.toBeVisible();await expect(page.locator('#openPinEditor')).toBeFocused();
});

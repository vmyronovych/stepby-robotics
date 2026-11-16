import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {expansionBreadboard} from '../expansion-breadboard-fixture.mjs';
test('connected pins explain blocked expansion inputs instead of pretending nothing is connected',async({page})=>{
 await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Підключення зі знімка',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),expansionBreadboard());
 await page.getByRole('treeitem',{name:'Підключені піни',exact:true}).click();
 await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO34');await expect(page.locator('.blocklyToolboxFlyout')).not.toContainText('Звірити контакти S/G');
 await expect(page.locator('.blocklyToolboxFlyout')).not.toContainText('Підключи світлодіод із резистором або IN драйвера до GPIO');
 await expect(page.locator('.blocklyToolboxFlyout')).toContainText('лише вхід');
 await page.screenshot({path:'../validation/wiring-unavailable-pins.png'});
 await page.locator('.blocklyFlyoutButton').filter({hasText:'Показати DRV8833 · IN4'}).click();await expect(page.locator('.wiring-side')).toContainText('GPIO34 — лише вхід');await page.locator('.wiring-header [data-close]').click();
 const corrected=expansionBreadboard();corrected.wires[0].a='esp:exp-top-S-9';corrected.wires[1].a='esp:exp-top-S-8';
 await page.evaluate(wiring=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Виправлена схема',workspace:{wiring,blocks:{languageVersion:0,blocks:[]}}}),corrected);
 await page.getByRole('treeitem',{name:'Підключені піни',exact:true}).click();await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO16');await expect(page.locator('.blocklyToolboxFlyout')).toContainText('GPIO17');await expect(page.locator('.blocklyToolboxFlyout .blocklyBlockCanvas > .blocklyDraggable')).toHaveCount(4);
});

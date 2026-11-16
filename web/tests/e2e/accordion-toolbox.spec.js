import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
async function open(page){await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(()=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Мотори',workspace:{myBlocks:[{id:'forward',name:'Лівий задній мотор — вперед',body:{type:'usb_pin_write',fields:{PIN:'25',STATE:'ON'}}},{id:'stop',name:'Зупинити мотор',body:{type:'usb_pin_write',fields:{PIN:'25',STATE:'OFF'}}}],blocks:{languageVersion:0,blocks:[{type:'usb_start',id:'start',x:40,y:40}]}}}));}
const category=(page,name,scope='#blocklyDiv')=>page.locator(scope).getByRole('treeitem',{name,exact:true});
test('accordion contains native blocks under category, hover actions and drag stay in sidebar',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);const cat=category(page,'Мої блоки');await cat.click();await expect(cat).toHaveAttribute('aria-expanded','true');
 const flyout=cat.locator('.accordion-flyout');await expect(flyout).toBeVisible();
 const side=await page.locator('#blocklyDiv .accordion-toolbox').boundingBox(),box=await flyout.boundingBox(),header=await cat.locator('.blocklyToolboxCategory').boundingBox();expect(box.x).toBeGreaterThanOrEqual(side.x);expect(box.x+box.width).toBeLessThanOrEqual(side.x+side.width+1);expect(box.y).toBeGreaterThanOrEqual(header.y+header.height);
 const next=await category(page,'Підключені піни').boundingBox();expect(next.y).toBeGreaterThanOrEqual(box.y+box.height);
 const edit=flyout.getByRole('button',{name:'Редагувати: Лівий задній мотор — вперед',exact:true});await expect(edit.locator('xpath=ancestor::*[local-name()="foreignObject"]')).toHaveCSS('opacity','0');
 await flyout.locator('.blocklyText').filter({hasText:'Лівий задній мотор — вперед'}).hover();await expect(edit.locator('xpath=ancestor::*[local-name()="foreignObject"]')).toHaveCSS('opacity','1');
 await page.screenshot({path:'../validation/accordion-my-blocks.png'});
 await edit.click();await expect(page.locator('#myBlockName')).toHaveValue('Лівий задній мотор — вперед');await page.locator('#myBlockDialog footer [data-cancel]').click();
 const copy=cat.getByRole('button',{name:'Дублювати: Лівий задній мотор — вперед',exact:true});await flyout.locator('.blocklyText').filter({hasText:'Лівий задній мотор — вперед'}).hover();await copy.click();await expect(page.locator('#myBlockName')).toHaveValue('Лівий задній мотор — вперед — копія');await page.locator('#myBlockDialog footer [data-cancel]').click();
 const source=await flyout.locator('.blocklyDraggable').first().locator(':scope > .blocklyPath').first().boundingBox();await page.mouse.move(source.x+8,source.y+16);await page.mouse.down();await page.mouse.move(side.x+side.width+200,source.y+80,{steps:20});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().filter(b=>b.type==='my_block_call').length)).toBe(1);
 const placed=await page.locator('#blocklyDiv > .injectionDiv > svg.blocklySvg .blocklyDraggable').last().boundingBox();expect(placed.x).toBeGreaterThan(side.x+side.width);
 await category(page,'Світлодіод').click();await expect(cat).toHaveAttribute('aria-expanded','false');await expect(category(page,'Світлодіод').locator('.accordion-flyout')).toBeVisible();await category(page,'Світлодіод').locator('.blocklyToolboxCategory').click();await expect(category(page,'Світлодіод')).toHaveAttribute('aria-expanded','false');expect(errors).toEqual([]);
});
test('definition accordion has hover controls and quiet group tools; keyboard can reach commands',async({page})=>{
 await open(page);await expect(page.locator('.editor-panel [data-selection-action="copy"]')).toBeHidden();await page.locator('#createMyBlock').click();
 const cat=category(page,'Мої блоки','#myBlockCanvas');await cat.click();await expect(cat.locator('.accordion-flyout')).toBeVisible();
 const edit=cat.getByRole('button',{name:'Редагувати: Зупинити мотор',exact:true});await edit.focus();await expect(edit.locator('xpath=ancestor::*[local-name()="foreignObject"]')).toHaveCSS('opacity','1');
 // An empty current definition must be completed before drill-down; cancellation stays safe.
 await page.locator('#myBlockDialog footer [data-cancel]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks.length)).toBe(2);
});
test('touch palette exposes actions without hover and fits narrow viewports',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await open(page);await category(page,'Мої блоки').click();
 const action=category(page,'Мої блоки').getByRole('button',{name:'Дублювати: Зупинити мотор',exact:true});await expect(action.locator('xpath=ancestor::*[local-name()="foreignObject"]')).toHaveCSS('opacity','1');await action.click();await expect(page.locator('#myBlockName')).toHaveValue('Зупинити мотор — копія');
 expect(await page.locator('#myBlockDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:'../validation/accordion-mobile.png'});await context.close();
});

test('dynamic variables refresh inside the accordion and long lists scroll without covering canvas',async({page})=>{
 await open(page);await category(page,'Змінні').click();
 await category(page,'Змінні').locator('.blocklyFlyoutButton').click();
 await page.getByRole('textbox',{name:'Нова назва змінної:'}).fill('Швидкість');await page.getByRole('button',{name:'Гаразд',exact:true}).click();
 await expect(category(page,'Змінні').locator('.accordion-flyout')).toContainText('Швидкість');
 await page.evaluate(async()=>{const {changeMyBlocks}=await import('/src/my-blocks.js');changeMyBlocks(window.__usbWorkshop.workspace,Array.from({length:15},(_,i)=>({id:'motor'+i,name:'Мотор '+i,body:{type:'usb_pin_write',fields:{PIN:'25',STATE:'ON'}}})));});
 await category(page,'Мої блоки').locator('.blocklyToolboxCategory').click();
 const side=page.locator('#blocklyDiv .accordion-toolbox');await side.hover();await page.mouse.wheel(0,650);await expect.poll(()=>side.evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
 const last=category(page,'Мої блоки').locator('.blocklyText').filter({hasText:/^Мотор\s14$/});await last.scrollIntoViewIfNeeded();
 const source=await last.boundingBox(),columnBefore=await side.boundingBox();await page.mouse.move(source.x+5,source.y+5);await page.mouse.down();await page.mouse.move(columnBefore.x+columnBefore.width+140,columnBefore.y+160,{steps:16});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().filter(b=>b.type==='my_block_call'&&b.definitionId==='motor14').length)).toBe(1);
 await page.setViewportSize({width:650,height:900});
 const fly=await category(page,'Мої блоки').locator('.accordion-flyout').boundingBox(),column=await side.boundingBox();expect(fly.width).toBeLessThanOrEqual(column.width+1);
});

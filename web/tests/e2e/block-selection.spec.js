import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
const pin=(id,n)=>({type:'usb_pin_write',id,fields:{PIN:String(n),STATE:'ON'}});
const chain=(...bs)=>bs.reduceRight((next,b)=>({...b,...next?{next:{block:next}}:{}}),null);
async function open(page){
 await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);
 await page.evaluate(body=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Групові дії',workspace:{blocks:{languageVersion:0,blocks:[{type:'usb_start',id:'start',x:40,y:20,next:{block:body}}]}}}),chain(pin('a',16),pin('b',17),pin('c',18),pin('d',19)));
}
const toolbar=page=>page.locator('.editor-panel .block-selection-tools');
async function clickBlock(page,id,shift=false,canvas='#blocklyDiv'){
 const el=page.locator(`${canvas} [data-id="${id}"] > .blocklyPath:not(.blocklyPathSelected)`).first();await el.click({position:{x:5,y:24},modifiers:shift?['Shift']:[]});
}
const counts=page=>page.evaluate(()=>window.__usbWorkshop.workspace.getAllBlocks().filter(b=>b.type==='usb_pin_write').map(b=>b.getFieldValue('PIN')));
test('Shift selection copies only chosen commands; cut/delete and undo preserve surrounding stack',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await clickBlock(page,'b');await clickBlock(page,'c',true);await expect(toolbar(page)).toContainText('Вибрано: 2');
 await page.screenshot({path:'../validation/block-multiselect.png'});
 await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await expect.poll(()=>counts(page)).toHaveLength(6);
 expect((await counts(page)).filter(p=>p==='19')).toHaveLength(1);
 await expect(toolbar(page)).toContainText('Вибрано: 2');await toolbar(page).getByRole('button',{name:'Видалити вибране',exact:true}).click();await expect.poll(()=>counts(page)).toHaveLength(4);
 await page.waitForTimeout(80);await page.keyboard.press('Meta+z');await expect.poll(()=>counts(page)).toHaveLength(6);
 await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));await expect.poll(()=>counts(page)).toHaveLength(4);
 await clickBlock(page,'b');await clickBlock(page,'c',true);await page.keyboard.press('Control+x');await expect.poll(()=>counts(page)).toHaveLength(2);
 expect(await page.evaluate(()=>window.__usbWorkshop.workspace.getBlockById('a').getNextBlock().id)).toBe('d');
 await page.waitForTimeout(80);await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));expect(await counts(page)).toEqual(['16','17','18','19']);expect(errors).toEqual([]);
});
test('selection mode, marquee, Escape, input shortcuts and main-to-definition clipboard',async({page})=>{
 await open(page);await toolbar(page).getByRole('button',{name:'Вибрати кілька блоків'}).click();await clickBlock(page,'b');await clickBlock(page,'c');await expect(toolbar(page)).toContainText('Вибрано: 2');
 await page.keyboard.press('Escape');await expect(toolbar(page).getByRole('button',{name:'Вибрати кілька блоків'})).toHaveAttribute('aria-pressed','false');
 const b=await page.locator('#blocklyDiv [data-id="b"] > .blocklyPath').boundingBox(),c=await page.locator('#blocklyDiv [data-id="c"] > .blocklyPath').boundingBox();
 await page.keyboard.down('Shift');await page.mouse.move(b.x-8,b.y-1);await page.mouse.down();await page.mouse.move(Math.max(b.x+b.width,c.x+c.width)+5,c.y+c.height+1,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
 await expect(toolbar(page)).toContainText('Вибрано: 2');await toolbar(page).getByRole('button',{name:'Копіювати',exact:true}).click();
 await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Копія складових');
 await page.keyboard.press('Meta+a');await page.keyboard.press('Backspace');await expect(page.locator('#myBlockName')).toHaveValue('');
 await page.locator('#myBlockName').fill('Копія складових');
 await page.locator('#myBlockDialog .block-selection-tools').getByRole('button',{name:'Вставити',exact:true}).click();
 await expect(page.locator('#myBlockDialog .block-selection-status')).toHaveText('Вибрано: 2');
 await page.screenshot({path:'../validation/my-block-multiselect.png'});
 expect(await page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));return w.getAllBlocks().filter(b=>b.type==='usb_pin_write').map(b=>b.getFieldValue('PIN'));})).toEqual(['17','18']);
 // First Escape clears selection; second cancels the definition, leaving main untouched.
 await page.locator('#myBlockCanvas .blocklyMainBackground').click({position:{x:600,y:80}});await page.keyboard.press('Escape');await expect(page.locator('#myBlockDialog')).not.toBeVisible();expect(await counts(page)).toHaveLength(4);
});
test('duplicate definition is independent, cancel is safe, saved copy survives reload and undo',async({page})=>{
 await open(page);await page.evaluate(async()=>{const {changeMyBlocks}=await import('/src/my-blocks.js');changeMyBlocks(window.__usbWorkshop.workspace,[{id:'left',name:'Лівий мотор',body:{type:'usb_pin_write',fields:{PIN:'16',STATE:'ON'}}}]);});
 await page.getByRole('treeitem',{name:'Мої блоки',exact:true}).click();await page.locator('#blocklyDiv .blocklyToolboxFlyout .blocklyText').filter({hasText:'Лівий мотор'}).hover();await page.getByRole('button',{name:'Дублювати: Лівий мотор',exact:true}).click();
 await expect(page.locator('#myBlockName')).toHaveValue('Лівий мотор — копія');await page.locator('#myBlockName').fill('Правий мотор');
 await page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));w.getAllBlocks().find(b=>b.type==='usb_pin_write').setFieldValue('25','PIN');});
 await page.locator('[data-save]').click();const defs=await page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks);expect(defs).toHaveLength(2);expect(defs[0].body.fields.PIN).toBe('16');expect(defs[1].body.fields.PIN).toBe('25');expect(defs[1].id).not.toBe(defs[0].id);
 await page.waitForTimeout(100);await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks)).toHaveLength(1);await page.evaluate(()=>window.__usbWorkshop.workspace.undo(true));
 await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks)).toHaveLength(2);
 await page.getByRole('treeitem',{name:'Мої блоки',exact:true}).click();await page.locator('#blocklyDiv .blocklyToolboxFlyout .blocklyText').filter({hasText:'Правий мотор'}).hover();await page.getByRole('button',{name:'Редагувати: Правий мотор',exact:true}).click();
 await page.locator('[data-duplicate-definition]').click();await expect(page.locator('#myBlockName')).toHaveValue('Правий мотор — копія');await page.locator('#myBlockDialog footer [data-cancel]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks)).toHaveLength(2);
});
test('definition editor supports group context actions and keyboard undo without deleting its hat',async({page})=>{
 await open(page);await page.locator('#createMyBlock').click();await page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));const b=Blockly.serialization.blocks.append({type:'usb_pin_write',id:'m1',fields:{PIN:'16',STATE:'ON'},next:{block:{type:'usb_pin_write',id:'m2',fields:{PIN:'17',STATE:'OFF'}}}},w);w.getTopBlocks().find(b=>b.type==='my_block_body').getInput('DO').connection.connect(b.previousConnection);});
 await clickBlock(page,'m1',false,'#myBlockCanvas');await clickBlock(page,'m2',true,'#myBlockCanvas');
 await expect(page.locator('#myBlockDialog .block-selection-status')).toHaveText('Вибрано: 2');
 await page.locator('#myBlockCanvas [data-id="m1"] > .blocklyPath:not(.blocklyPathSelected)').click({position:{x:5,y:24},button:'right'});
 await page.getByText('Дублювати вибране',{exact:true}).click();
 const count=()=>page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');return Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body')).getAllBlocks().filter(b=>b.type==='usb_pin_write').length;});
 await expect.poll(count).toBe(4);await page.waitForTimeout(80);await page.keyboard.press('Meta+z');await expect.poll(count).toBe(2);
 await page.keyboard.press('Control+a');await page.keyboard.press('Delete');await expect.poll(count).toBe(0);await expect(page.locator('#myBlockCanvas .blocklyText').filter({hasText:'виконати'})).toBeVisible();
 await page.waitForTimeout(80);await page.keyboard.press('Control+z');await expect.poll(count).toBe(2);
});

import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
async function open(page){await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(()=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,...window.__usbWorkshop.examples.empty}));await expect(page.locator('#createMyBlock')).toBeVisible();}
async function body(page,blocks){await page.evaluate(async blocks=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));const hat=w.getTopBlocks().find(b=>b.type==='my_block_body');hat.getInputTargetBlock('DO')?.dispose(false);const chain=blocks.reduceRight((next,b)=>({...b,...next?{next:{block:next}}:{}}),null);const b=Blockly.serialization.blocks.append(chain,w);hat.getInput('DO').connection.connect(b.previousConnection);},blocks);}
const pin=(n,state)=>({type:'usb_pin_write',fields:{PIN:String(n),STATE:state}});
async function insertCall(page,id){await page.evaluate(async id=>{const {Blockly}=await import('/src/blocks.js');const w=window.__usbWorkshop.workspace;let tail=w.getTopBlocks().find(b=>b.type==='usb_start');while(tail.getNextBlock())tail=tail.getNextBlock();if(!tail.nextConnection){tail=tail.getInputTargetBlock('DO');while(tail.getNextBlock())tail=tail.getNextBlock();}const call=Blockly.serialization.blocks.append({type:'my_block_call',extraState:{definitionId:id}},w);tail.nextConnection.connect(call.previousConnection);call.select();},id);}
async function library(page){return page.evaluate(()=>window.__usbWorkshop.project().workspace.myBlocks||[]);}
test('create, nest, rename, save/reload, drill down and undo a user block',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.locator('#createMyBlock').click();await expect(page.locator('#myBlockDialog')).toBeVisible();await page.locator('#myBlockName').fill('Лівий мотор');
 await body(page,[pin(17,'OFF'),pin(16,'ON')]);await page.locator('[data-save]').click();await expect(page.locator('#myBlockDialog')).not.toBeVisible();
 const left=(await library(page))[0].id;
 await page.getByRole('treeitem',{name:'Мої блоки',exact:true}).click();await expect(page.locator('#blocklyDiv .blocklyFlyout .blocklyText').filter({hasText:'Лівий мотор'}).first()).toBeVisible();
 await page.locator('#blocklyDiv .blocklyToolboxFlyout .blocklyText').filter({hasText:'Лівий мотор'}).hover();await page.getByRole('button',{name:'Редагувати: Лівий мотор',exact:true}).click();await expect(page.locator('#myBlockName')).toHaveValue('Лівий мотор');await page.keyboard.press('Escape');
 await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Їхати вперед');await body(page,[{type:'my_block_call',extraState:{definitionId:left}},pin(19,'OFF'),pin(18,'ON')]);
 await page.screenshot({path:'../validation/my-blocks-editor.png'});
 await page.locator('[data-save]').click();const both=(await library(page))[1].id;await insertCall(page,both);
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarWrite(16, true)');await page.locator('#closeCode').click();
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:'Їхати вперед'}).last().dblclick();await expect(page.locator('#myBlockName')).toHaveValue('Їхати вперед');
 await page.locator('#myBlockCanvas .blocklyText').filter({hasText:'Лівий мотор'}).last().dblclick();await expect(page.locator('#myBlockName')).toHaveValue('Лівий мотор');
 await page.locator('#myBlockName').fill('Ліве колесо');await body(page,[pin(23,'ON')]);await page.locator('[data-back]').click();await expect(page.locator('#myBlockName')).toHaveValue('Їхати вперед');await page.locator('[data-save]').click();
 await expect.poll(async()=>(await library(page))[0].name).toBe('Ліве колесо');
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarWrite(23, true)');await page.locator('#closeCode').click();
 await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);expect((await library(page))[0].name).toBe('Ліве колесо');
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:'Їхати вперед'}).last().dblclick();await page.locator('#myBlockName').fill('Перейменовано');await page.locator('[data-save]').click();await page.waitForTimeout(80);
 await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));expect((await library(page))[1].name).toBe('Їхати вперед');
 expect(errors).toEqual([]);
});
test('extraction is atomic, cancel preserves program and recursion is explained',async({page})=>{
 await open(page);await page.evaluate(()=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,...window.__usbWorkshop.examples.blink}));
 const before=await page.evaluate(()=>window.__usbWorkshop.compile());
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:'світлодіод GPIO2'}).last().click({button:'right'});
 await page.getByText('Згорнути цю й наступні команди в мій блок',{exact:true}).click();
 await page.locator('#myBlockName').fill('Спалах');await page.locator('[data-save]').click();await expect(page.locator('#myBlockDialog')).not.toBeVisible();
 expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toBe(before);
 await page.waitForTimeout(80);await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));expect(await library(page)).toEqual([]);expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toBe(before);
 await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Не зберігати');await body(page,[pin(2,'ON')]);await page.keyboard.press('Escape');expect(await library(page)).toEqual([]);
 await page.locator('#createMyBlock').click();await body(page,[pin(2,'ON')]);await page.locator('[data-save]').click();const id=(await library(page))[0].id;await insertCall(page,id);
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:'Моя команда'}).last().dblclick();await body(page,[{type:'my_block_call',extraState:{definitionId:id}}]);await page.locator('[data-save]').click();await expect(page.locator('.my-block-error')).toContainText('сам себе');
});
test('mobile editor fits viewport and field menus stay interactive',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Моя лампа');await body(page,[pin(2,'ON')]);
 await page.locator('[data-fit]').click();
 await page.locator('#myBlockDialog').getByRole('button',{name:'dropdown: GPIO2',exact:true}).click();await page.locator('.blocklyMenuItemContent').filter({hasText:/^GPIO4$/}).click();
 expect(await page.locator('#myBlockDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'../validation/my-blocks-mobile.png'});
 await page.keyboard.press('Escape');await expect(page.locator('#myBlockDialog')).not.toBeVisible();
});

test('parameter editor, GPIO menu, reusable calls, duplicate and undo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Мотор');
 await page.locator('.my-block-parameters summary').click();
 await page.getByRole('button',{name:'Додати параметр'}).click();
 let row=page.locator('.my-block-parameter-row').nth(0);
 await row.getByRole('textbox',{name:'Назва параметра'}).fill('IN');await row.getByRole('combobox',{name:'Тип параметра'}).selectOption('pin');await row.getByRole('combobox',{name:'Початкове значення'}).selectOption('25');
 await page.getByRole('button',{name:'Додати параметр'}).click();row=page.locator('.my-block-parameter-row').nth(1);
 await row.getByRole('textbox',{name:'Назва параметра'}).fill('Швидкість');await row.getByRole('spinbutton',{name:'Початкове значення'}).fill('128');await row.getByRole('spinbutton').press('Tab');
 await body(page,[{type:'usb_pin_pwm',fields:{PIN:'2'},inputs:{DUTY:{shadow:{type:'math_number',fields:{NUM:128}}}}}]);
 await page.locator('#myBlockCanvas').getByRole('button',{name:'dropdown: GPIO2',exact:true}).click();await page.getByText('Параметр: IN',{exact:true}).click();
 await page.locator('#myBlockCanvas').getByRole('treeitem',{name:'Параметри',exact:true}).click();
 const reporter=page.locator('#myBlockCanvas .blocklyToolboxFlyout .blocklyText').filter({hasText:'Швидкість'});await expect(reporter).toBeVisible();
 const source=await reporter.boundingBox(),target=await page.locator('#myBlockCanvas').getByRole('button',{name:'Edit number: 128',exact:true}).boundingBox();
 await page.mouse.move(source.x+5,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+5,target.y+target.height/2,{steps:25});
 const delta=await page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));const dragged=w.getAllBlocks().find(b=>b.type==='my_block_parameter'),connection=w.getAllBlocks().find(b=>b.type==='usb_pin_pwm').getInput('DUTY').connection;
 const point=c=>{const a=c.getSourceBlock().getRelativeToSurfaceXY(),b=c.getOffsetInBlock();return Blockly.utils.svgMath.wsToScreenCoordinates(w,new Blockly.utils.Coordinate(a.x+b.x,a.y+b.y));};const a=point(dragged.outputConnection),b=point(connection);return {x:b.x-a.x,y:b.y-a.y};});
 await page.mouse.move(target.x+5+delta.x,target.y+target.height/2+delta.y,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(async()=>{const {Blockly}=await import('/src/blocks.js');const w=Blockly.common.getAllWorkspaces().find(w=>w.getTopBlocks().some(b=>b.type==='my_block_body'));return w.getAllBlocks().find(b=>b.type==='usb_pin_pwm').getInputTargetBlock('DUTY')?.type;})).toBe('my_block_parameter');
 await page.screenshot({path:'../validation/parameterized-block-editor.png'});
 await page.locator('[data-save]').click();await expect(page.locator('#myBlockDialog')).not.toBeVisible();
 const def=(await library(page))[0];expect(def.parameters.map(p=>p.name)).toEqual(['IN','Швидкість']);
 await insertCall(page,def.id);await insertCall(page,def.id);
 await page.evaluate(d=>{const w=window.__usbWorkshop.workspace,calls=w.getAllBlocks().filter(b=>b.type==='my_block_call');calls[1].getInputTargetBlock(`ARG_${d.parameters[0].id}`).setFieldValue('26','PIN');calls[1].getInputTargetBlock(`ARG_${d.parameters[1].id}`).setFieldValue(200,'NUM');},def);
 const code=await page.evaluate(()=>window.__usbWorkshop.compile());expect(code).toContain('mcarPwm(25,');expect(code).toContain('mcarPwm(26,');expect(code).toContain('200.000000f');
 await page.screenshot({path:'../validation/parameterized-block-calls.png'});
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:/^Мотор$/}).last().dblclick();
 await page.locator('.my-block-parameter-row').nth(1).getByRole('textbox').fill('Потужність');await page.locator('#myBlockName').click();
 await page.getByRole('button',{name:'Додати параметр'}).click();await page.locator('[data-save]').click();
 await page.waitForTimeout(100);await page.evaluate(()=>window.__usbWorkshop.workspace.undo(false));
 expect((await library(page))[0].parameters.map(p=>p.name)).toEqual(['IN','Швидкість']);expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toBe(code);
 await page.evaluate(()=>window.__usbWorkshop.workspace.undo(true));expect((await library(page))[0].parameters).toHaveLength(3);
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:/^Мотор$/}).last().dblclick();
 await page.getByRole('button',{name:'Дублювати команду',exact:false}).click();await page.locator('[data-save]').click();
 const copy=(await library(page))[1];expect(copy.parameters).toHaveLength(3);expect(copy.body.inputs.DUTY.block.extraState.definitionId).toBe(copy.id);
 await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);expect((await library(page))).toHaveLength(2);expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toContain('mcarPwm(26,');expect(errors).toEqual([]);
});

test('parameter settings fit mobile and used parameters cannot be silently deleted',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#createMyBlock').click();await page.locator('.my-block-parameters summary').click();
 await page.getByRole('button',{name:'Додати параметр'}).click();await page.getByRole('combobox',{name:'Тип параметра'}).selectOption('pin');
 const id=await page.locator('.my-block-parameter-row').getAttribute('data-parameter-id');
 await body(page,[{type:'usb_pin_write',fields:{PIN:`param:${id}`,STATE:'ON'}}]);
 await page.getByRole('button',{name:'Видалити параметр Значення',exact:true}).click();await expect(page.locator('.my-block-error')).toContainText('Параметр використовується');await expect(page.locator('.my-block-parameter-row')).toHaveCount(1);
 await page.locator('[data-fit]').click();await page.locator('#myBlockCanvas').getByRole('button',{name:'dropdown: Параметр: Значення',exact:true}).click();await page.locator('#myBlockCanvas').getByRole('option',{name:'GPIO2',exact:true}).click();
 expect(await page.locator('#myBlockDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'../validation/parameterized-block-mobile.png'});
 await page.getByRole('button',{name:'Видалити параметр Значення',exact:true}).click();await expect(page.locator('.my-block-parameter-row')).toHaveCount(0);
 await page.keyboard.press('Escape');expect(await library(page)).toEqual([]);expect(errors).toEqual([]);
});

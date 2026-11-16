import {test,expect} from '@playwright/test';
import {installSerial} from './serial-fixture.js';
import {fixture,program} from '../wiring-fixture.mjs';
async function open(page,state){await installSerial(page,{granted:true});await page.goto('/usb.html');await page.waitForFunction(()=>window.__usbWorkshop);await page.evaluate(state=>window.__usbWorkshop.load({format:'mandrivnyk-usb',version:1,name:'Моя схема',workspace:state||window.__usbWorkshop.examples.empty.workspace}),state);await page.locator('#openWiring').click();await expect(page.locator('#wiringDialog')).toBeVisible();}
const startWire=page=>page.getByRole('button',{name:'Під’єднати провід',exact:true}).click();
const pin=(page,key)=>page.locator(`.wire-pin[data-endpoint="${key}"]`);
test('graphical wires, validation, undo, colors and physical checklist persist with project',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,program());
 await expect(page.locator('.wiring-status')).toHaveText('Відомих помилок з’єднань не знайдено');
 await pin(page,'drv:IN1').click();await expect(page.locator('.wiring-side')).toContainText('Лівий мотор · IN1 → GPIO16');
 await page.locator('[data-audit]').click();await expect(page.locator('.wiring-side')).toContainText('Звіряння · 1 / 8');await page.getByRole('button',{name:'Цей провід збігається ✓'}).click();await expect(page.locator('.wiring-side')).toContainText('Звіряння · 2 / 8');await page.getByRole('button',{name:'Завершити звіряння'}).click();
 await pin(page,'battery:PLUS').click();await startWire(page);await pin(page,'esp:left-13').click();await expect(page.locator('.wiring-side')).toContainText('Живлення з’єднане із землею');
 await page.locator('[data-undo]').click();await expect(page.locator('.wiring-status')).toHaveText('Відомих помилок з’єднань не знайдено');
 await page.locator('[data-apply]').click();await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);
 expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.checked.length)).toBe(1);
 await page.locator('#openWiring').click();await page.locator('[data-wire-fit]').click();await page.waitForTimeout(600);await page.screenshot({path:'../validation/wiring-desktop.png'});
 expect(errors).toEqual([]);
});
test('rewiring previews affected commands, recompiles GPIO and deleted wire explains failure',async({page})=>{
 await open(page,program());await page.locator('[data-checks]').click();await page.locator('.wiring-wire-list button').filter({hasText:'ESP32 · GPIO16 → Драйвер · IN1'}).click();
 await page.getByRole('button',{name:'Замінити: ESP32 · GPIO16',exact:true}).click();await pin(page,'esp:right-1').click();await page.locator('.wiring-impact-menu summary').click();await expect(page.locator('.wiring-impact')).toBeVisible();await expect(page.locator('.wiring-impact')).toContainText('GPIO16 → GPIO23');await page.keyboard.press('Escape');await expect(page.locator('.wiring-impact')).toBeHidden();await expect(page.locator('#wiringDialog')).toBeVisible();
 await page.locator('[data-apply]').click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(23, 180');await page.locator('#closeCode').click();
 await page.locator('#blocklyDiv .blocklyText').filter({hasText:'Лівий мотор · IN1'}).click({button:'right'});await page.getByText('Показати підключення на схемі',{exact:true}).click();await expect(page.locator('.wiring-side h3')).toHaveText('Драйвер · IN1');
 await page.locator('.wiring-wire-list button').filter({hasText:'GPIO23'}).click();await page.getByRole('button',{name:'Видалити провід',exact:true}).click();await expect(page.locator('.wiring-impact')).toContainText('GPIO23 → немає GPIO');await page.locator('[data-apply]').click();
 await page.locator('#codeButton').click();await expect(page.locator('#notice')).toContainText('немає придатного GPIO');
});
test('create wires through the explicit connect action, add a linked command and use it inside My blocks',async({page})=>{
 await open(page);
 for(const name of ['＋ ESP32','＋ DRV8833'])await page.getByRole('button',{name,exact:true}).click();
 const keys=await page.locator('.wiring-component').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.component,kind:n.dataset.kind})));const esp=keys.find(k=>k.kind==='esp32').id,drv=keys.find(k=>k.kind==='driver').id;
 await pin(page,`${esp}:right-11`).click();await startWire(page);await pin(page,`${drv}:IN1`).click();await pin(page,`${drv}:IN1`).click();
 await page.getByRole('button',{name:'＋ Команда ШІМ',exact:true}).click();await expect(page.locator('#wiringDialog')).not.toBeVisible();
 await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(16, 128');await page.locator('#closeCode').click();
 await page.locator('#createMyBlock').click();await page.locator('#myBlockName').fill('Мотор вперед');await page.locator('#myBlockDialog').getByRole('treeitem',{name:'Підключені піни',exact:true}).click();await expect(page.locator('#myBlockCanvas .blocklyToolboxFlyout')).toContainText('DRV8833 · IN1 · GPIO16');
 await page.keyboard.press('Escape');
});
test('mobile component controls fit and an invalid imported schema preserves the current project',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,program());await page.locator('.wiring-component[data-component="drv"]').click();await expect(page.locator('.wiring-side')).toContainText('Контакт');
 expect(await page.locator('#wiringDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:'../validation/wiring-mobile.png'});
 await page.locator('[data-apply]').click();const before=await page.evaluate(()=>window.__usbWorkshop.compile());
 const bad=program();bad.wiring.wires[0].a='bad:USB';await page.locator('#projectFile').setInputFiles({name:'bad.mcar',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mandrivnyk-usb',version:1,name:'Bad',workspace:bad}))});
 await expect(page.locator('#notice')).toContainText('Провід');expect(await page.evaluate(()=>window.__usbWorkshop.compile())).toBe(before);
});
test('drag a wire, move a component, inspect 3D and navigate into a saved custom command',async({page})=>{
 const state=program();state.myBlocks=[{id:'forward',name:'Рух вперед',body:state.blocks.blocks[0].next.block}];state.blocks.blocks[0].next.block={type:'my_block_call',extraState:{definitionId:'forward'}};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,state);
 const a=await pin(page,'esp:right-1').boundingBox(),b=await pin(page,'drv:IN3').boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();await expect(page.locator('.wiring-wire-list button')).toHaveCount(9);
 const header=page.locator('.wiring-component[data-component="drv"]'),box=await header.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+25,{steps:5});await page.mouse.up();
 await header.click();await page.getByRole('button',{name:'Роздивитися в 3D',exact:true}).click();await expect(page.locator('.wiring-viewer-dialog canvas')).toBeVisible();await page.getByRole('button',{name:'Зворотний бік',exact:true}).click();await page.getByRole('button',{name:'Повернутися до схеми',exact:true}).click();
 await pin(page,'drv:IN1').click();await page.getByRole('button',{name:'Знайти команди в програмі',exact:true}).click();await expect(page.locator('#myBlockName')).toHaveValue('Рух вперед');
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.wires.length)).toBe(9);expect(errors).toEqual([]);
});

test('ESP32 3D mesh contact resolves to its diagram endpoint',async({page})=>{
 await open(page,program());await page.locator('.wiring-component[data-component="esp"]').click();
 await page.getByRole('button',{name:'Роздивитися в 3D',exact:true}).click();const marker=page.locator('.wiring-viewer-dialog .module-pin[data-pin="right-11"]');await expect(marker).toBeVisible();await page.waitForTimeout(200);
 await page.screenshot({path:'../validation/wiring-3d.png'});const box=await marker.boundingBox();await page.locator('.wiring-viewer-dialog .module-pins').evaluate(el=>el.style.pointerEvents='none');await page.locator('.wiring-viewer-dialog .module-pin').evaluateAll(nodes=>nodes.forEach(n=>n.style.pointerEvents='none'));
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await expect(page.locator('.wiring-viewer-dialog')).toHaveCount(0);await expect(page.locator('.wiring-side h3')).toHaveText('ESP32 · GPIO16');
});

test('ESP32 expansion is a mounted assembly with physical pin wiring and safe detach',async({page})=>{
 await open(page,program());await page.locator('.wiring-component[data-component="esp"]').click();
 await page.locator('[data-expansion]').selectOption('esp32s-38p');
 await expect(page.locator('.wiring-component[data-mounted="true"]')).toHaveCount(1);await expect(page.locator('.wiring-component[data-kind="expansion"]')).toHaveCount(0);
 await expect(page.locator('[data-signals-verification]')).toHaveCount(0);
 await page.locator('.wiring-wire-list button').filter({hasText:'ESP32 · GPIO16 → Драйвер · IN1'}).click();await page.getByRole('button',{name:'Замінити: ESP32 · GPIO16',exact:true}).click();
 await pin(page,'esp:exp-top-S-9').click();await expect(page.locator('.wiring-side')).toContainText('Лівий мотор · IN1 → GPIO16');
 const position=await pin(page,'esp:exp-top-S-9').evaluate(el=>{const pin=el.getBoundingClientRect(),image=el.closest('article').querySelector('img').getBoundingClientRect();return {x:(pin.x+pin.width/2-image.x)/image.width,y:(pin.y+pin.height/2-image.y)/image.height};});
 expect(position.x).toBeGreaterThan(.35);expect(position.x).toBeLessThan(.5);expect(position.y).toBeGreaterThan(.1);expect(position.y).toBeLessThan(.18);
 await page.locator('.wiring-component[data-component="esp"]').click();await page.locator('[data-expansion]').selectOption('none');await expect(page.locator('[data-expansion]')).toHaveValue('esp32s-38p');await expect(page.locator('.wiring-hint')).toContainText('Спочатку прибери проводи');
 await page.locator('[data-wire-fit]').click();await page.waitForTimeout(400);await page.screenshot({path:'../validation/wiring-mounted.png'});
 await page.locator('[data-apply]').click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(16, 180');await page.locator('#closeCode').click();
 await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__usbWorkshop);await page.locator('#openWiring').click();await expect(page.locator('.wiring-component[data-mounted="true"]')).toHaveCount(1);
});
test('catalog drag, canvas pan, pointer-centered zoom, Delete and Undo follow block editor controls',async({page})=>{
 await open(page);const source=await page.locator('[data-catalog="driver"]').boundingBox(),target=await page.locator('.wiring-scroll').boundingBox();
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+300,target.y+150,{steps:6});await expect(page.locator('.wiring-drag-preview')).toBeVisible();await page.mouse.up();
 await expect(page.locator('.wiring-component')).toHaveCount(1);await expect(page.locator('.wiring-drag-preview')).toHaveCount(0);
 await page.locator('.wiring-component').click();await page.keyboard.press('Delete');await expect(page.locator('.wiring-component')).toHaveCount(0);await page.keyboard.press('ControlOrMeta+z');await expect(page.locator('.wiring-component')).toHaveCount(1);
 await page.locator('[data-in]').click();const zoom=await page.locator('[data-zoom]').innerText();await page.mouse.move(target.x+500,target.y+250);await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');await expect(page.locator('[data-zoom]')).not.toHaveText(zoom);
 await page.locator('.wiring-scroll').evaluate(el=>{el.scrollLeft=200;el.scrollTop=200;});const before=await page.locator('.wiring-scroll').evaluate(el=>el.scrollLeft);
 await page.mouse.move(target.x+target.width-170,target.y+target.height-100);await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(target.x+target.width-100,target.y+target.height-100,{steps:5});await page.mouse.up();await page.keyboard.up('Space');expect(await page.locator('.wiring-scroll').evaluate(el=>el.scrollLeft)).toBeLessThan(before);
});

test('both expansion headers have 17 pins per row and 5V warns about simultaneous USB power',async({page})=>{
 const state=program();state.wiring.components[0].expansion='esp32s-38p';state.wiring.components[0].signalsVerified=true;state.wiring.components.find(c=>c.id==='drv').x=760;state.wiring.components.find(c=>c.id==='motor').x=1140;
 // Give the wider assembly room without changing the circuit.
 for(const c of state.wiring.components)if(c.id!=='esp'&&c.x>160)c.x+=288;
 await open(page,state);
 for(const edge of ['top','bottom'])for(const band of ['S','V','G'])await expect(page.locator(`.wire-pin[data-endpoint^="esp:exp-${edge}-${band}-"]`)).toHaveCount(17);
 await pin(page,'esp:exp-bottom-S-16').click();await expect(page.locator('.wiring-side')).toContainText('Контакт живлення 5 В. Це не програмований вихід.');
 await startWire(page);await pin(page,'battery:PLUS').click();await expect(page.locator('.wiring-side')).toContainText('USB та зовнішнє живлення одночасно');
 await pin(page,'esp:exp-bottom-S-16').click();await page.waitForTimeout(300);await page.screenshot({path:'../validation/wiring-expansion-5v.png'});
 await page.locator('[data-apply]').click();await page.locator('#codeButton').click();await expect(page.locator('#notice')).toContainText('USB та зовнішнє живлення одночасно');
});

test('compact chrome, contextual inspector and collapsible palette reclaim canvas without changing the circuit',async({page})=>{
 await open(page,program());const viewport=page.locator('.wiring-viewport'),side=page.locator('.wiring-side'),palette=page.locator('.wiring-palette');
 await expect(side).toBeHidden();const initial=await viewport.boundingBox();expect(initial.height).toBeGreaterThan(840);expect(initial.width).toBeGreaterThan(1250);
 const scale=await page.locator('[data-zoom]').innerText();await page.locator('[data-palette-toggle]').click();await expect(palette).toBeHidden();expect((await viewport.boundingBox()).width).toBeGreaterThan(initial.width+100);await expect(page.locator('[data-zoom]')).toHaveText(scale);
 await page.locator('.wiring-component[data-component="esp"]').click();await expect(side).toBeVisible();await expect(side.getByLabel('Назва компонента')).toHaveValue('ESP32');
 await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await expect(side).toBeHidden();
 await page.locator('.wiring-component[data-component="esp"]').click();await expect(side).toBeVisible();const r=await viewport.boundingBox();await page.mouse.click(r.x+10,r.y+r.height-70);await expect(side).toBeHidden();
 await page.locator('[data-checks]').click();await expect(side).toBeVisible();await expect(page.locator('.wiring-wire-list button')).toHaveCount(8);await page.locator('[data-checks]').click();await expect(side).toBeHidden();
 await page.locator('[data-wire-fit]').click();await page.waitForTimeout(200);await page.screenshot({path:'../validation/wiring-workspace-expanded.png'});
 await page.locator('[data-palette-toggle]').click();await expect(palette).toBeVisible();await page.locator('[data-apply]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.wires.length)).toBe(8);
});
test('mobile palette and properties can both collapse to a full-width canvas',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,program());await page.locator('[data-palette-toggle]').click();
 await expect(page.locator('.wiring-side')).toBeHidden();await expect(page.locator('.wiring-palette')).toBeHidden();const box=await page.locator('.wiring-viewport').boundingBox();expect(box.width).toBeGreaterThan(385);expect(box.height).toBeGreaterThan(680);
 await page.locator('.wiring-component[data-component="drv"]').click();await expect(page.locator('.wiring-side')).toBeVisible();await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await expect(page.locator('.wiring-side')).toBeHidden();
 await page.locator('[data-wire-fit]').click();expect(await page.locator('#wiringDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);for(const b of await page.locator('.wiring-header button:visible').all()){const r=await b.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(390);}await page.screenshot({path:'../validation/wiring-workspace-mobile.png'});
});

test('header icon actions apply or discard the draft without a footer',async({page})=>{
 await open(page,program());await expect(page.locator('.wiring-footer')).toHaveCount(0);
 const header=page.locator('.wiring-header');await expect(header.getByRole('button',{name:'Застосувати підключення',exact:true})).toBeVisible();
 await page.locator('.wiring-component[data-component="esp"]').click();await page.getByLabel('Назва компонента').fill('Чернетка');await page.getByLabel('Назва компонента').press('Tab');
 await header.getByRole('button',{name:'Скасувати й закрити підключення',exact:true}).click();
 expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.components.find(c=>c.id==='esp').name)).toBe('ESP32');
 await page.locator('#openWiring').click();await page.locator('.wiring-component[data-component="esp"]').click();await page.getByLabel('Назва компонента').fill('Моя плата');await page.getByLabel('Назва компонента').press('Tab');
 await header.locator('[data-apply]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.components.find(c=>c.id==='esp').name)).toBe('Моя плата');
});

test('rotate components and mounted boards with pin wiring, undo and saved orientation',async({page})=>{
 await open(page,program());await expect(page.locator('[data-rotate-right]')).toBeHidden();
 const esp=page.locator('.wiring-component[data-component="esp"]');await esp.click();
 const before=await esp.boundingBox();const wires=await page.locator('.wiring-lines').innerHTML();
 await page.getByRole('button',{name:'Повернути на 90° праворуч',exact:true}).click();await expect(esp).toHaveAttribute('data-rotation','90');
 const after=await esp.boundingBox();expect(after.width).toBeGreaterThan(before.width);expect(after.height).toBeLessThan(before.height);expect(await page.locator('.wiring-lines').innerHTML()).not.toBe(wires);
 await page.locator('[data-undo]').click();await expect(esp).toHaveAttribute('data-rotation','0');await page.locator('[data-redo]').click();await expect(esp).toHaveAttribute('data-rotation','90');
 await page.locator('[data-rotate-left]').click();await expect(esp).toHaveAttribute('data-rotation','0');await page.locator('[data-rotate-left]').click();await expect(esp).toHaveAttribute('data-rotation','270');
 await page.locator('[data-expansion]').selectOption('esp32s-38p');await page.locator('[data-wire-fit]').click();await page.locator('[data-rotate-right]').click();await expect(esp).toHaveAttribute('data-rotation','0');await page.locator('[data-rotate-right]').click();
 await page.locator('[data-apply]').click();const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(saved.workspace.wiring.components.find(c=>c.id==='esp').rotation).toBe(90);expect(saved.workspace.wiring.wires).toEqual(program().wiring.wires);
 await page.evaluate(project=>window.__usbWorkshop.load(project),saved);await page.locator('#openWiring').click();await expect(esp).toHaveAttribute('data-rotation','90');
 await page.locator('[data-wire-fit]').click();await pin(page,'esp:exp-bottom-S-16').click();await expect(page.locator('.wiring-side')).toContainText('5V');await expect(page.locator('.wire-pin[aria-pressed=true]')).toHaveAttribute('data-endpoint','esp:exp-bottom-S-16');
 await page.screenshot({path:'../validation/wiring-rotation.png'});
 await page.setViewportSize({width:390,height:844});for(const b of await page.locator('.wiring-header button:visible').all()){const r=await b.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(390);}
});

test('auxiliary header grounds can be wired and signal pins resolve from the photographed header',async({page})=>{
 const state=program();state.wiring.components[0].expansion='esp32s-38p';state.wiring.components[0].signalsVerified=true;state.wiring.components.find(c=>c.id==='drv').x=760;state.wiring.components.find(c=>c.id==='motor').x=1140;
 await open(page,state);await expect(page.locator('.wire-pin[data-endpoint^="esp:exp-aux-"]')).toHaveCount(8);
 await pin(page,'esp:exp-aux-top-3').click();await expect(page.locator('.wiring-side h3')).toContainText('GND · окрема гребінка');await startWire(page);await pin(page,'drv:GND').click();
 await page.locator('.wiring-wire-list button').filter({hasText:'ESP32 · GPIO16 → Драйвер · IN1'}).click();await page.getByRole('button',{name:'Замінити: ESP32 · GPIO16',exact:true}).click();await pin(page,'esp:exp-aux-bottom-1').click();
 await expect(page.locator('.wiring-side')).toContainText('Лівий мотор · IN1 → GPIO21');
 await pin(page,'esp:exp-aux-top-2').click();await expect(page.locator('.wiring-side h3')).toContainText('VCC · окрема гребінка');await page.keyboard.press('Escape');
 await page.locator('[data-wire-fit]').click();await page.waitForTimeout(300);await page.screenshot({path:'../validation/wiring-aux-header.png'});
 await page.locator('[data-apply]').click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(21, 180');
});

test('expansion power help identifies the photo jumper and separates unused VCC',async({page})=>{
 const state=program();state.wiring.components=[{...state.wiring.components[0],x:30,y:30,expansion:'esp32s-38p'}];state.wiring.wires=[];state.blocks={languageVersion:0,blocks:[]};
 await open(page,state);await page.locator('.wiring-component[data-component="esp"]').click();await page.locator('[data-wire-fit]').click();
 const help=page.locator('[data-issue="expansion-power"]');await expect(help).toContainText('жовту перемичку JUMP');await expect(help).toContainText('середній V і нижній 5V');await expect(help).toContainText('між червоним V і чорним G');await expect(page.locator('[data-issue="expansion-vcc"]')).toHaveCount(0);
 await page.waitForTimeout(400);await page.screenshot({path:'../validation/wiring-jumper-help.png'});
 await pin(page,'esp:exp-aux-top-2').click();await startWire(page);await pin(page,'esp:exp-top-S-0').click();await expect(page.locator('[data-issue="expansion-vcc"]')).toContainText('Положення JUMP саме по собі не підтверджує');
});

test('click photo jumper, change voltage, undo, rotate and persist the choice',async({page})=>{
 const state=program();state.wiring.components=[{...state.wiring.components[0],x:30,y:30,expansion:'esp32s-38p'}];state.wiring.wires=[];state.blocks={languageVersion:0,blocks:[]};
 await open(page,state);const jumper=page.locator('[data-jumper="esp"]'),img=page.locator('.wiring-component[data-component="esp"] img');await expect(img).toHaveAttribute('src',/^data:image/);const initial=await page.locator('.wiring-jumper-art').innerHTML();
 await jumper.click();await expect(page.locator('.wiring-side h3')).toHaveText('Перемичка JUMP');await expect(page.locator('.jumper-legend')).toContainText('Сигнал GPIO · 3,3 В');
 await page.getByRole('button',{name:'3,3 В',exact:true}).click();await expect(jumper).toHaveAttribute('data-voltage','3.3');await expect(img).toHaveAttribute('src',/^data:image/);expect(await page.locator('.wiring-jumper-art').innerHTML()).not.toBe(initial);
 await expect(page.locator('.jumper-legend')).toContainText('Живлення модуля · 3,3 В');
 await page.locator('[data-undo]').click();await expect(jumper).toHaveAttribute('data-voltage','5');await page.locator('[data-redo]').click();await expect(jumper).toHaveAttribute('data-voltage','3.3');
 await page.keyboard.press('Delete');await expect(page.locator('.wiring-component')).toHaveCount(1);
 await page.locator('[data-rotate-right]').click();await page.locator('[data-wire-fit]').click();await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await jumper.click();await expect(page.locator('.wiring-side h3')).toHaveText('Перемичка JUMP');
 await page.locator('[data-apply]').click();const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(saved.workspace.wiring.components[0].jumperVoltage).toBe(3.3);
 await page.evaluate(p=>window.__usbWorkshop.load(p),saved);await page.locator('#openWiring').click();await jumper.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-jumper-value="3.3"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-rotate-left]').click();await page.locator('[data-wire-fit]').click();await page.screenshot({path:'../validation/wiring-jumper-interactive.png'});
 await page.getByRole('button',{name:'5 В',exact:true}).click();await page.locator('.wiring-header [data-close]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.components[0].jumperVoltage)).toBe(3.3);
});

test.describe('sharp jumper at high zoom',()=>{
 test.use({deviceScaleFactor:2});
 test('vector detail stays selectable at 250 percent and rotates with the board',async({page})=>{
  const state=program();state.wiring.components=[{...state.wiring.components[0],x:30,y:30,expansion:'esp32s-38p'}];state.wiring.wires=[];state.blocks={languageVersion:0,blocks:[]};
  await open(page,state);const jumper=page.locator('[data-jumper="esp"]');await jumper.click();await page.getByRole('button',{name:'3,3 В',exact:true}).click();
  for(let i=0;i<6;i++)await page.locator('[data-in]').click();await expect(page.locator('[data-zoom]')).toHaveText('250%');await jumper.scrollIntoViewIfNeeded();await page.locator('.wiring-scroll').evaluate(el=>el.scrollLeft+=150);
  await expect(page.locator('.wiring-jumper-art')).toContainText('3.3V');const b=await jumper.boundingBox();await page.screenshot({path:'../validation/wiring-jumper-sharp-2x.png',clip:{x:b.x-85,y:b.y-15,width:b.width+110,height:b.height+55}});
  await page.locator('[data-rotate-right]').click();await page.locator('[data-wire-fit]').click();await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await jumper.click();await expect(page.locator('.wiring-side h3')).toHaveText('Перемичка JUMP');
 });
});

test('keyboard rotation supports both directions, Ukrainian layout, undo and text editing',async({page})=>{
 await open(page,program());const esp=page.locator('.wiring-component[data-component="esp"]');
 await esp.click();await page.keyboard.press('KeyR');await expect(esp).toHaveAttribute('data-rotation','90');
 await page.keyboard.press('KeyR');await expect(esp).toHaveAttribute('data-rotation','180');await page.keyboard.press('Shift+KeyR');await expect(esp).toHaveAttribute('data-rotation','90');
 await page.keyboard.press('Control+z');await expect(esp).toHaveAttribute('data-rotation','180');await page.keyboard.press('Control+Shift+z');await expect(esp).toHaveAttribute('data-rotation','90');
 await page.locator('.wiring-scroll').dispatchEvent('keydown',{key:'к',code:'KeyR',bubbles:true});await expect(esp).toHaveAttribute('data-rotation','180');
 await page.locator('.wiring-scroll').dispatchEvent('keydown',{key:'r',code:'KeyR',repeat:true,bubbles:true});await expect(esp).toHaveAttribute('data-rotation','180');
 await page.locator('.wiring-scroll').dispatchEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true});await expect(esp).toHaveAttribute('data-rotation','180');
 const name=page.getByLabel('Назва компонента');await name.fill('');await name.press('r');await name.press('Shift+KeyR');await expect(name).toHaveValue('rR');await expect(esp).toHaveAttribute('data-rotation','180');await name.press('Tab');
 await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await page.keyboard.press('KeyR');await expect(esp).toHaveAttribute('data-rotation','180');
 await pin(page,'esp:left-0').click();await page.keyboard.press('Shift+KeyR');await expect(esp).toHaveAttribute('data-rotation','90');
 await page.locator('[data-apply]').click();expect(await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring.components[0].rotation)).toBe(90);
});

test('build a colored LED lesson with resistor bands and a real 170-hole breadboard',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 for(const name of ['＋ ESP32','＋ Світлодіод','＋ Резистор','＋ Mini breadboard','＋ USB комп’ютера'])await page.getByRole('button',{name,exact:true}).click();
 const ids=await page.locator('.wiring-component').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.kind,n.dataset.component])));
 const component=kind=>page.locator(`.wiring-component[data-component="${ids[kind]}"]`),contact=(kind,id)=>pin(page,`${ids[kind]}:${id}`);
 await expect(component('breadboard').locator('.wire-pin')).toHaveCount(170);
 await component('resistor').click();await page.getByLabel('Опір резистора').selectOption('220');await expect(page.locator('.resistor-band-legend')).toContainText('1. Червона');await expect(page.locator('.resistor-band-legend')).toContainText('2. Червона');await expect(page.locator('.resistor-band-legend')).toContainText('3. Коричнева');await page.getByLabel('Опір резистора').selectOption('330');await expect(page.getByLabel('Опір резистора')).toHaveValue('330');
 await component('led').click();const images=[];for(const color of ['red','yellow','green']){await page.getByLabel('Колір світлодіода').selectOption(color);await expect(component('led').locator('img')).toHaveAttribute('src',/^data:image\/svg/);images.push(await component('led').locator('img').getAttribute('src'));}expect(new Set(images).size).toBe(3);
 await contact('breadboard','A1').click();await expect(page.locator('.wire-pin[data-bus="true"]')).toHaveCount(5);await expect(page.locator('.wiring-side')).toContainText('A–E номера 1');await page.keyboard.press('Escape');
 for(const [a,b]of [[['usb','USB'],['esp32','USB']],[['esp32','right-11'],['breadboard','A1']],[['breadboard','E1'],['resistor','A']],[['resistor','B'],['breadboard','A5']],[['breadboard','E5'],['led','A']],[['led','K'],['breadboard','F10']],[['breadboard','J10'],['esp32','left-13']]]){await contact(...a).click();await startWire(page);await contact(...b).click();}
 await component('led').click();await expect(page.locator('.wiring-side')).toContainText('Світлодіод → GPIO16');await expect(page.locator('.wiring-status')).toHaveText('Відомих помилок з’єднань не знайдено');
 await page.locator('[data-wire-fit]').click();await page.screenshot({path:'../validation/wiring-led-breadboard.png'});
 await page.getByRole('button',{name:'＋ Команда ШІМ',exact:true}).click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(16, 128');await page.locator('#closeCode').click();
 const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(saved.workspace.wiring.components.find(c=>c.kind==='led').ledColor).toBe('green');expect(saved.workspace.wiring.components.find(c=>c.kind==='resistor').resistance).toBe(330);expect(saved.workspace.wiring.wires).toHaveLength(7);
 await page.evaluate(s=>window.__usbWorkshop.load(s),saved);await page.locator('#openWiring').click();await contact('breadboard','A1').click();await expect(page.locator('.wire-pin[data-bus="true"]')).toHaveCount(5);await page.keyboard.press('Escape');
 await component('resistor').click();await page.getByLabel('Опір резистора').selectOption('100');await expect(page.locator('[data-issue="led-resistance"]')).toBeVisible();await page.locator('[data-undo]').click();await expect(page.getByLabel('Опір резистора')).toHaveValue('330');
 await component('breadboard').click();await page.keyboard.press('KeyR');await page.locator('[data-wire-fit]').click();await contact('breadboard','F1').click();await expect(page.locator('.wire-pin[data-bus="true"]')).toHaveCount(5);await expect(page.locator('.wiring-side')).toContainText('F–J номера 1');
 expect(errors).toEqual([]);
});

test('insert resistor and LED directly, carry with board, undo, reload, and detach',async({page})=>{
 const {breadboardCircuit}=await import('../breadboard-fixture.mjs');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,{wiring:breadboardCircuit(false),blocks:{languageVersion:0,blocks:[]}});
 const component=id=>page.locator(`.wiring-component[data-component="${id}"]`);
 async function insert(id,hole){
  await component(id).click();
  const a=await pin(page,`${id}:A`).boundingBox(),b=await pin(page,`bb:${hole}`).boundingBox(),h=await component(id).boundingBox();
  const x=h.x+h.width/2,y=h.y+h.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+b.x+b.width/2-a.x-a.width/2,y+b.y+b.height/2-a.y-a.height/2,{steps:10});
  await expect(page.locator('.mount-preview')).toHaveCount(2);await page.mouse.up();
  await expect(component(id)).toHaveAttribute('data-inserted','true');
 }
 await insert('r','E5');await insert('led','J5');
 await expect(page.locator('.wiring-mount-status')).toContainText('A → J5, K → J6');
 await expect(page.locator('.wiring-status')).toHaveText('Відомих помилок з’єднань не знайдено');
 await expect(page.locator('.wiring-lines .wire-hit')).toHaveCount(3);
 async function assertAligned(){for(const [id,leg,hole]of [['r','A','E5'],['r','B','F5'],['led','A','J5'],['led','K','J6']]){const a=await pin(page,`${id}:${leg}`).boundingBox(),b=await pin(page,`bb:${hole}`).boundingBox();expect(Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2)).toBeLessThan(1);}}
 await assertAligned();
 await page.locator('[data-undo]').click();await expect(component('led')).toHaveAttribute('data-inserted','false');await page.locator('[data-redo]').click();await expect(component('led')).toHaveAttribute('data-inserted','true');
 await component('bb').click();const h=await component('bb').boundingBox();
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+50,h.y+h.height/2+35,{steps:5});await page.mouse.up();await assertAligned();
 await page.keyboard.press('KeyR');await expect(component('bb')).toHaveAttribute('data-rotation','90');await assertAligned();await page.locator('[data-undo]').click();await assertAligned();
 await page.getByRole('button',{name:'Закрити властивості',exact:true}).click();await page.locator('[data-wire-fit]').click();await page.mouse.move(10,10);await page.screenshot({path:'../validation/wiring-inserted-breadboard.png'});
 await component('led').locator('.wiring-part-grip rect').click();await page.getByRole('button',{name:'＋ Команда ШІМ',exact:true}).click();await page.locator('#codeButton').click();await expect(page.locator('#codePreview')).toContainText('mcarPwm(16, 128');await page.locator('#closeCode').click();
 const saved=await page.evaluate(()=>window.__usbWorkshop.project());expect(saved.workspace.wiring.wires).toHaveLength(3);expect(saved.workspace.wiring.components.filter(c=>c.breadboardMount)).toHaveLength(2);
 await page.evaluate(s=>window.__usbWorkshop.load(s),saved);await page.locator('#openWiring').click();await assertAligned();
 await component('led').locator('.wiring-part-grip rect').click();await page.getByRole('button',{name:'Витягнути з breadboard',exact:true}).click();await expect(component('led')).toHaveAttribute('data-inserted','false');await expect(page.locator('[data-issue="led-circuit"]')).toBeVisible();
 await page.locator('[data-undo]').click();await expect(component('led')).toHaveAttribute('data-inserted','true');
 // Pull an inserted part away with the same gesture used to place it.
 await component('r').locator('.wiring-part-grip rect').click();const body=await component('r').locator('.wiring-part-grip rect').boundingBox();
 await page.mouse.move(body.x+body.width/2,body.y+body.height/2);await page.mouse.down();await page.mouse.move(body.x+body.width/2+360,body.y+body.height/2-230,{steps:10});await page.mouse.up();await expect(component('r')).toHaveAttribute('data-inserted','false');await page.locator('[data-undo]').click();await expect(component('r')).toHaveAttribute('data-inserted','true');await assertAligned();
 await component('bb').click();await page.keyboard.press('Delete');await expect(component('bb')).toHaveCount(0);await expect(page.locator('[data-inserted="true"]')).toHaveCount(0);await page.locator('[data-undo]').click();await assertAligned();
 expect(errors).toEqual([]);
});

test('GND connects to a free breadboard hole beside an inserted LED',async({page})=>{
 const {breadboardCircuit}=await import('../breadboard-fixture.mjs');
 const wiring=breadboardCircuit();wiring.wires=wiring.wires.filter(w=>w.id!=='w2');
 await open(page,{wiring,blocks:{languageVersion:0,blocks:[]}});
 await pin(page,'esp:left-13').click();await startWire(page);
 const hole=await pin(page,'bb:F6').boundingBox();
 await page.mouse.click(hole.x+hole.width/2,hole.y+hole.height/2);
 await expect(page.locator('.wiring-lines .wire-hit')).toHaveCount(3);
 await expect(page.locator('.wiring-status')).toHaveText('Відомих помилок з’єднань не знайдено');
});

test('free LED-strip holes support reverse wiring, dragged wires, rotation and cancel',async({page})=>{
 const {breadboardCircuit}=await import('../breadboard-fixture.mjs');
 const wiring=breadboardCircuit();wiring.wires=wiring.wires.filter(w=>w.id!=='w2');
 await open(page,{wiring,blocks:{languageVersion:0,blocks:[]}});
 // The transparent margin must also allow starting a wire at the breadboard.
 await pin(page,'bb:F6').click();await startWire(page);await pin(page,'esp:left-13').click();await expect(page.locator('.wire-hit')).toHaveCount(3);
 await page.locator('[data-undo]').click();
 await page.locator('[data-component="bb"]').click();await page.keyboard.press('KeyR');
 await expect(page.locator('[data-component="bb"]')).toHaveAttribute('data-rotation','90');
 // H6 lies underneath the painted body, so wiring mode must expose it as well.
 const start=await pin(page,'esp:left-13').boundingBox(),end=await pin(page,'bb:H6').boundingBox();
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});await page.mouse.up();
 await expect(page.locator('.wire-hit')).toHaveCount(3);await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 await page.locator('[data-undo]').click();await pin(page,'esp:left-13').click();await startWire(page);await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','true');
 await page.keyboard.press('Escape');await expect(page.locator('.wiring-board')).toHaveAttribute('data-wiring','false');
 await page.locator('[data-component="led"] .wiring-part-grip rect').click();await expect(page.locator('.wiring-side')).toContainText('Витягнути з breadboard');
 await pin(page,'esp:left-13').click();await startWire(page);await pin(page,'bb:H6').click();await expect(page.locator('.wire-hit')).toHaveCount(3);
 await page.locator('[data-apply]').click();const saved=await page.evaluate(()=>window.__usbWorkshop.project().workspace.wiring);
 expect(saved.wires.some(w=>[w.a,w.b].includes('esp:left-13')&&[w.a,w.b].includes('bb:H6'))).toBe(true);
 expect(saved.components.filter(c=>c.breadboardMount)).toHaveLength(2);
});

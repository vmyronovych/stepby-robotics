import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {initModelFullscreen} from '../src/assembly/fullscreen.js';

function setup(t){
 const dom=new JSDOM('<button id="outside">Outside</button><dialog open><section id="model"><canvas tabindex="0"></canvas><button id="view">Top</button><button id="toggle">⛶ На весь екран</button></section></dialog>',{pretendToBeVisual:true});
 globalThis.document=dom.window.document;
 t.after(()=>{dom.window.close();delete globalThis.document});
 const target=document.querySelector('#model'),button=document.querySelector('#toggle'),dialog=document.querySelector('dialog');
 document.body.style.overflow='auto';button.focus();
 return {dom,target,button,dialog,controller:initModelFullscreen(target,button)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('viewport presentation exits with Escape and restores scroll and focus',async t=>{
 const {dom,target,button,controller}=setup(t);
 button.click();await tick();assert.ok(controller.active);assert.ok(target.classList.contains('model-fullscreen'));
 assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(document.body.style.overflow,'hidden');
 const escape=new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});button.dispatchEvent(escape);await tick();
 assert.ok(escape.defaultPrevented);assert.ok(!controller.active);assert.equal(document.body.style.overflow,'auto');assert.equal(document.activeElement,button);
 button.click();await tick();button.click();await tick();assert.ok(!controller.active);
});

test('denied fullscreen requests fall back without losing model controls',async t=>{
 const {target,button,controller}=setup(t);document.fullscreenEnabled=true;
 target.requestFullscreen=async()=>{throw Error('Policy denied')};
 let actions=0;document.querySelector('#view').onclick=()=>actions++;
 button.click();await tick();assert.ok(controller.active);document.querySelector('#view').click();assert.equal(actions,1);
 button.click();await tick();assert.ok(!controller.active);assert.equal(document.body.style.overflow,'auto');
});

test('browser fullscreen changes and dialog cancellation keep presentation state synchronized',async t=>{
 const {dom,target,button,dialog,controller}=setup(t);document.fullscreenEnabled=true;
 target.requestFullscreen=async()=>{document.fullscreenElement=target;document.dispatchEvent(new dom.window.Event('fullscreenchange'))};
 document.exitFullscreen=async()=>{document.fullscreenElement=null;document.dispatchEvent(new dom.window.Event('fullscreenchange'))};
 button.click();await tick();assert.equal(document.fullscreenElement,target);assert.ok(controller.active);
 await document.exitFullscreen();assert.ok(!controller.active);assert.equal(button.getAttribute('aria-pressed'),'false');
 button.click();await tick();const cancel=new dom.window.Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);await tick();
 assert.ok(cancel.defaultPrevented);assert.ok(!controller.active);assert.ok(dialog.open);
});

test('closing the guide cancels a pending request without leaving a fullscreen or scroll lock',async t=>{
 const {dom,target,button,dialog,controller}=setup(t);document.fullscreenEnabled=true;
 let resolve;target.requestFullscreen=()=>new Promise(done=>{resolve=()=>{document.fullscreenElement=target;document.dispatchEvent(new dom.window.Event('fullscreenchange'));done()}});
 document.exitFullscreen=async()=>{document.fullscreenElement=null;document.dispatchEvent(new dom.window.Event('fullscreenchange'))};
 button.click();dialog.dispatchEvent(new dom.window.Event('close'));resolve();await tick();
 assert.ok(!controller.active);assert.equal(document.fullscreenElement,null);assert.equal(document.body.style.overflow,'auto');
});

test('keyboard focus stays with the model while presenting',async t=>{
 const {dom,target,button}=setup(t);
 for(const control of target.querySelectorAll('canvas,button'))control.getClientRects=()=>[{}];
 button.click();await tick();button.focus();
 button.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(document.activeElement.tagName,'CANVAS');
 document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(document.activeElement,button);
});

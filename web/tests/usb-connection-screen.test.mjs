import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {initConnectionScreen} from '../src/usb-connection-screen.js';
import {usbConnectionIssue} from '../src/usb-connection-issue.js';
import {withSerialConnection} from '../src/serial-session.js';

test('connection screen explains port failures and retry never invokes installation',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};
 globalThis.document=dom.window.document;globalThis.requestAnimationFrame=fn=>fn();
 try{
  let retries=0,installs=0;
  const render=initConnectionScreen({choose(){},retry(){retries++;},skip(){},resized(){},install(){installs++;}});
  const $=id=>document.getElementById(id);
  for(const [name,title] of [['NetworkError','USB-порт недоступний'],['InvalidStateError','USB-порт уже відкритий']]){
   const error=await withSerialConnection({async open(){throw new DOMException('busy',name);}},()=>assert.fail('must not send commands')).catch(error=>error);
   assert.equal(error.stage,'open');
   const issue=usbConnectionIssue(error);
   render({state:'error',message:issue.message,errorTitle:issue.title});
   assert.equal($('connectionTitle').textContent,title);
   assert.equal($('connectionRecovery').hidden,false);
   assert.match(document.querySelector('#connectionRecovery li').textContent,/localhost/);
   assert.match($('connectionDescription').textContent,/інша вкладка/);
   $('connectionAction').click();
  }
  const issue=usbConnectionIssue();render({state:'error',message:issue.message,errorTitle:issue.title});
  assert.equal($('connectionTitle').textContent,'Перевір інші вкладки');
  assert.match($('connectionDescription').textContent,/Можливо/);
  assert.match($('connectionDescription').textContent,/не означає/);
  $('connectionAction').click();assert.equal(retries,3);assert.equal(installs,0);
  render({state:'editor'});assert.equal($('connectionScreen').hidden,true);assert.equal($('app').hidden,false);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('write failures and USB timeouts are not presented as a port already open',async()=>{
 const error=Object.assign(new DOMException('write failed','NetworkError'),{stage:'write'});
 assert.equal(usbConnectionIssue(error).title,'Відновімо зв’язок');
 const timeout=Object.assign(Error('Перепідключи USB та онови сторінку.'),{code:'USB_TIMEOUT',stage:'open'});
 assert.deepEqual(usbConnectionIssue(timeout),{title:'USB-з’єднання зависло',message:timeout.message});
});

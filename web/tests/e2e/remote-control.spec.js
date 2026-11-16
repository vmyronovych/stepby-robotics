import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const header=readFileSync(new URL('../../../firmware/browser/remote_page.h',import.meta.url),'utf8');
const html=header.split('R"HTML(')[1].split(')HTML"')[0];
test('mobile remote generates buttons, sends ordered press/release and revokes on STOP',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const requests=[];
 await page.route('http://192.168.4.1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
  if(url.pathname==='/remote/info')return route.fulfill({json:{name:'Mandrivnyk-test',commands:[{id:1,name:'Вперед',hold:true},{id:5,name:'Блимнути',hold:false}]}});
  requests.push({path:url.pathname,body:Object.fromEntries(new URLSearchParams(route.request().postData()))});
  await route.fulfill({body:url.pathname==='/remote/claim'?'42':'OK'});
 });
 await page.goto('http://192.168.4.1/');
 const forward=page.getByRole('button',{name:'Вперед ↕'});
 await expect(forward).toBeDisabled();await page.getByRole('button',{name:'Підключити пульт'}).click();await expect(forward).toBeEnabled();
 await forward.hover();await page.mouse.down();await page.mouse.up();
 await expect.poll(()=>requests.filter(request=>request.path==='/remote/event').length).toBe(2);
 expect(requests.filter(request=>request.path==='/remote/event').map(request=>request.body.event)).toEqual(['1','9']);
 await page.getByRole('button',{name:'Блимнути'}).click();
 await expect.poll(()=>requests.filter(request=>request.path==='/remote/event').length).toBe(3);
 await page.getByRole('button',{name:'СТОП',exact:true}).click();await expect(forward).toBeDisabled();
 await expect.poll(()=>requests.some(request=>request.path==='/remote/stop')).toBe(true);
 const sequences=requests.filter(request=>request.body.seq).map(request=>Number(request.body.seq));expect(sequences).toEqual([...sequences].sort((left,right)=>left-right));
});
test('phone locks controls on heartbeat failure and page focus loss',async({page})=>{
 let failHeartbeat=false,stops=0;
 await page.route('http://192.168.4.1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:html});
  if(path==='/remote/info')return route.fulfill({json:{name:'Test',commands:[{id:5,name:'Блимнути',hold:false}]}});
  if(path==='/remote/stop')stops++;
  if(path==='/remote/heartbeat'&&failHeartbeat)return route.fulfill({status:409,body:'Session expired'});
  return route.fulfill({body:path==='/remote/claim'?'42':'OK'});
 });
 await page.goto('http://192.168.4.1/');await expect(page.getByRole('status')).toContainText('Натисни');
 await page.getByRole('button',{name:'Підключити пульт'}).click();
 await expect(page.getByRole('button',{name:'Блимнути'})).toBeEnabled();
 failHeartbeat=true;await expect(page.getByRole('button',{name:'Блимнути'})).toBeDisabled();
 await expect.poll(()=>stops).toBe(1);
 failHeartbeat=false;await page.getByRole('button',{name:'Підключити пульт'}).click();
 await expect(page.getByRole('button',{name:'Блимнути'})).toBeEnabled();
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.getByRole('button',{name:'Блимнути'})).toBeDisabled();
 await expect.poll(()=>stops).toBe(2);
});

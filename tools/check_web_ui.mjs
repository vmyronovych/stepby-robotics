// Parses the actual inline browser code and exercises its real program encoder.
// No DOM/browser/hardware emulation is claimed.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=new URL('../firmware/src/web_ui.h',import.meta.url);
const header=fs.readFileSync(file,'utf8');
const script=header.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script,{filename:'robot-web-ui.js'});
const encode=script.match(/function encode\(\)\{[^\n]+/)[0];
const context=vm.createContext({steps:[{op:'S',value:80},{op:'F',value:2},{op:'K',value:25},{op:'A',value:5},{op:'X',value:0}]});
vm.runInContext(encode,context);
assert.equal(vm.runInContext('encode()',context),'S,80\nF,2000\nK,250\nA,5000\nX,0\n');
assert(script.includes("'/drive?dir='+held+'&epoch='+manualEpoch"));
console.log('PASS: full browser JavaScript syntax; actual encoder seconds/ms and Kp/tenths; manual epoch included. Browser interaction and Wi-Fi remain untested.');

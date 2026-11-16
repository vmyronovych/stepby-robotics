import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),dist=path.join(root,'web/dist');
fs.writeFileSync(path.join(dist,'licenses.txt'), 'Blockly 13.3.0\n'+fs.readFileSync(path.join(root,'web/node_modules/blockly/LICENSE'),'utf8')+'\n\nThree.js 0.186.1\n'+fs.readFileSync(path.join(root,'web/node_modules/three/LICENSE'),'utf8'));
fs.copyFileSync(path.join(root,'web/node_modules/three/LICENSE'),path.join(root,'web/THREE-LICENSE.txt'));
for(const [label,folder]of [['libavoid-js 0.4.5 (LGPL-2.1-or-later; corresponding source: third-party/libavoid/)','libavoid-js'],['esptool-js','esptool-js'],['Noble hashes','@noble/hashes'],['pako','pako'],['atob-lite','atob-lite']]){const dir=path.join(root,'web/node_modules',folder);const license=fs.readdirSync(dir).find(name=>/^license/i.test(name));if(license)fs.appendFileSync(path.join(dist,'licenses.txt'),'\n\n'+label+'\n'+fs.readFileSync(path.join(dir,license),'utf8'));}
fs.writeFileSync(path.join(dist,'.nojekyll'),'');
console.log('USB workshop ready in web/dist (root page, compatible bookmarks, no local API required).');

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),build=path.join(root,'firmware/browser/build'),out=path.join(root,'web/public/firmware/esp32-gpio-v2');fs.mkdirSync(out,{recursive:true});
const files=[['bootloader.bin','browser.ino.bootloader.bin',0x1000],['partitions.bin','browser.ino.partitions.bin',0x8000],['runtime.bin','browser.ino.bin',0x10000]].map(([file,source,address])=>{
 const data=fs.readFileSync(path.join(build,source));fs.writeFileSync(path.join(out,file),data);return {file,address,size:data.length,sha256:createHash('sha256').update(data).digest('hex')};
});
const sources=['firmware/browser/browser.ino','firmware/browser/remote_wifi.h','firmware/browser/remote_control.h','firmware/browser/remote_page.h','firmware/browser/usb_vm.h','firmware/browser/program_store.h','firmware/browser/usb_receiver.h','firmware/browser/partitions.csv','firmware/browser/gpio_runtime.h','web/src/usb-gpio-source.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({format:1,version:'esp32-gpio-v2',chip:'ESP32',flashBytes:4194304,programAddress:0x310000,programSize:0x10000,baudRate:115200,core:'3.3.0',sources,files},null,2)+'\n');
console.log('Packaged browser firmware:',files.map(f=>f.file+': '+f.size).join(', '));

// Non-flashing diagnostic: connect to the ROM bootloader, identify the chip,
// then reset back into the existing application. No BOOT button or flash writes.
import {ESPLoader,Transport} from 'esptool-js';
import {TestSerialPort} from './serial-test-port.mjs';
const trials=Number(process.argv[2]||3);
const signalMode=process.argv[3]||'atomic';
const resetMode=process.argv[4]||'default';
if(!['default','release-first','long'].includes(resetMode))throw Error('Unknown reset probe.');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
if(!Number.isInteger(trials)||trials<1||trials>5)throw Error('Use 1..5 trials.');
for(let trial=1;trial<=trials;trial++){
 const port=new TestSerialPort(signalMode),transport=new Transport(port,false);
 const resetConstructors=resetMode==='default'?undefined:{classicReset:(_transport,delay)=>({async reset(){
  await port.setSignals({dataTerminalReady:false,requestToSend:true});await sleep(resetMode==='long'?500:100);
  if(resetMode==='release-first'){
   await port.setSignals({requestToSend:false});await port.setSignals({dataTerminalReady:true});
  }else await port.setSignals({dataTerminalReady:true,requestToSend:false});
  await sleep(delay);await port.setSignals({dataTerminalReady:false,requestToSend:false});
 }})};
 const loader=new ESPLoader({transport,baudrate:115200,romBaudrate:115200,resetConstructors,terminal:{clean(){},write(){},writeLine:text=>console.log(text)}});
 let timeout;
 try{
  await Promise.race([loader.connect('default_reset',2),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('auto-boot timed out')),30000);})]);
  if(loader.chip?.CHIP_NAME!=='ESP32')throw Error('Unexpected chip');
  console.log(`PASS ${trial}/${trials}: ESP32 ROM connected without BOOT; no flash written`);
 }catch(error){console.error(`FAIL ${trial}/${trials}: ${error.message}`);process.exitCode=1;}
 finally{
  clearTimeout(timeout);
  try{await transport.setDTR(false);await transport.setRTS(true);await new Promise(r=>setTimeout(r,100));await transport.setRTS(false);}catch{}
  await transport.disconnect();
 }
}

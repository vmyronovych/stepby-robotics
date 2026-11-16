import {AvoidLib} from 'libavoid-js';
import {createAvoidRouter} from './wiring-avoid-core.js';
let route;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){await AvoidLib.load(data.wasmUrl);route=createAvoidRouter(AvoidLib.getInstance());self.postMessage({type:'ready'});}
  else if(data.type==='route')self.postMessage({type:'result',id:data.id,result:route(data.state)});
 }catch(error){self.postMessage({type:'error',message:String(error?.message||error)});}
};

import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Verify the built site even in environments that cannot bind a local port.
export async function serveBuiltSite(page,testInfo){
 if(!testInfo.config.metadata.staticPreview)return;
 const root=path.resolve(import.meta.dirname,'../../dist');
 await page.route('http://127.0.0.1:5173/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){await route.fulfill({status:403,body:''});return;}
  try{
   const contentType={'.wasm':'application/wasm','.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.txt':'text/plain'}[path.extname(file)]||'application/octet-stream';
   await route.fulfill({contentType,body:await readFile(file)});
  }catch{await route.fulfill({status:404,body:''});}
 });
}

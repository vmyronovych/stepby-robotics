import {defineConfig} from 'vite';
import {usbWorkshopPlugin} from './server/usb-workshop.js';
export default defineConfig({
  base:'./',
  plugins:[usbWorkshopPlugin()],
  optimizeDeps:{include:['esptool-js','@noble/hashes/legacy.js','@noble/hashes/utils.js']},
  server:{port:5173,strictPort:true},
  build:{manifest:true,target:'es2020',cssCodeSplit:true,rollupOptions:{input:{usb:'index.html',chassis:'chassis-review.html',usbRedirect:'usb.html',robotRedirect:'robot.html'},output:{entryFileNames:'[name].js',assetFileNames:'[name][extname]'}},chunkSizeWarningLimit:1700}
});

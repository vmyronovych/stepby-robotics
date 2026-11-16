import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:'**/usb-pins.spec.js',use:{...base.use,channel:process.env.CI?undefined:'chrome'},reporter:[['list'],['json',{outputFile:'../validation/usb-pins-e2e.json'}]]});

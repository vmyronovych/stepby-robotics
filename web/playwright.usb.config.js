import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:'**/usb.spec.js',reporter:[['list'],['json',{outputFile:'../validation/usb-workshop-e2e.json'}]]});

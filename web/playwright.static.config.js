import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,webServer:undefined,testMatch:'**/fullscreen.spec.js',metadata:{staticPreview:true},reporter:[['list'],['json',{outputFile:'../validation/fullscreen-e2e.json'}]]});

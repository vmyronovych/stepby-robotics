import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,webServer:undefined,testMatch:'**/components.spec.js',metadata:{staticPreview:true},reporter:[['list'],['json',{outputFile:'../validation/modules-e2e.json'}]]});

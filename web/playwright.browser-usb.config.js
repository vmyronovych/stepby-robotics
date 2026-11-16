import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'**/browser-usb.spec.js',timeout:30000,fullyParallel:false,use:{viewport:{width:1440,height:950},channel:process.env.CI?undefined:'chrome',headless:true},reporter:[['list'],['json',{outputFile:'../validation/browser-usb-e2e.json'}]]});

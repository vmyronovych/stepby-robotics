import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:'**/components.spec.js',reporter:[['list'],['json',{outputFile:'../validation/components-e2e.json'}]]});

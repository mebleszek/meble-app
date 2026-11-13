'use strict';
// Full application in a disposable Chromium profile; Firebase replies synthetic.
const {main}=require('./helpers/android-startup-full-browser');
(async()=>{await main({delayMs:0,roomStartup:true});await main({delayMs:0,roomStartup:'draft'});})().catch(error=>{console.error(error.message.slice(0,1800));process.exitCode=1;});

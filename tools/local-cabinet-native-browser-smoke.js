'use strict';
// Discoverable CI entry; retains the shared genuine authority/modal fixture.
const {execFileSync}=require('node:child_process');
execFileSync(process.execPath,[require.resolve('./android-local-first-browser-smoke'),'--cabinet-variants-only'],{stdio:'inherit'});

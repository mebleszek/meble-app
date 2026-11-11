'use strict';
require('node:child_process').execFileSync(process.execPath,[require.resolve('./android-local-first-browser-smoke'),'--quote-final-only'],{stdio:'inherit'});

#!/usr/bin/env node
'use strict';
// Run every registered WYCENA contract, not just the small APP API subset.
const assert=require('node:assert/strict');
const {makeLoadedSandbox}=require('./app-dev-smoke');
(async()=>{
 const sandbox=makeLoadedSandbox(),report=await sandbox.FC.wycenaDevTests.runAll();
 for(const group of report.groups || []){
  console.log(`${group.name}: ${group.passed}/${group.total} PASS`);
  for(const test of group.results || [])if(!test.ok)console.error('FAIL '+test.name+': '+test.message);
 }
 console.log(`WYCENA full contracts: ${report.passed}/${report.total} PASS, ${report.failed} FAIL`);
 assert.equal(report.total,113,'All existing WYCENA contracts must execute');
 assert.equal(report.failed,0);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

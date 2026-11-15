#!/usr/bin/env node
'use strict';
// The real actions registry must return the asynchronous navigation result so
// the production application boundary keeps protected writes inside its transaction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sandbox={console};
sandbox.window=sandbox;
sandbox.FC={};
vm.createContext(sandbox);
for(const file of ['js/core/actions.js','js/app/ui/actions-register.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
}

async function main(){
  let running=false,settle;
  sandbox.FC.applicationLifecycle={
    async dispatch(action,operation){
      assert.equal(action,'open-furniture-hub');
      assert.equal(running,false);
      running=true;
      try{const result=await operation();return result;}finally{running=false;}
    }
  };
  sandbox.FC.views={
    openModeHub(mode){
      assert.equal(mode,'furnitureProjects');
      return new Promise(resolve=>{settle=()=>{assert.equal(running,true,'Navigation must finish before boundary release');resolve(true);};});
    }
  };
  const pending=sandbox.FC.actions.dispatch('open-furniture-hub',{});
  assert.equal(running,true);
  assert.equal(typeof pending?.then,'function','Registry must return navigation promise');
  settle();
  assert.equal(await pending,true);
  assert.equal(running,false);

  sandbox.FC.views.openModeHub=async()=>false;
  assert.equal(await sandbox.FC.actions.dispatch('open-furniture-hub',{}),false,'Denied navigation must not report success');
  delete sandbox.FC.views.openModeHub;
  assert.equal(await sandbox.FC.actions.dispatch('open-furniture-hub',{}),false,'Missing view must fail closed');
  console.log('PASS async mode-hub navigation retains transaction until completion and propagates refusal');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

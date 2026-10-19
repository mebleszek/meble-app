const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function createSandbox(){
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame:(fn)=> setTimeout(fn, 0),
    Date, Math, JSON,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    Storage: SmokeStorage,
    document: makeMiniDocument(),
    structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
    crypto: require('crypto').webcrypto,
    __DEV_ASSETS__: {
      'index.html': fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'),
      'dev_tests.html': fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8'),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  return sandbox;
}

function loadSmokeFiles(sandbox){
  vm.createContext(sandbox);
  APP_DEV_SMOKE_FILES.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function assert(condition, message, details){
  if(!condition){
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

// The former automatic repair contract is intentionally replaced by read-only
// refusal. All legacy data remain available for explicit project recovery.
function run(){
 const s=loadSmokeFiles(createSandbox()),F=s.FC,raw=()=>Object.fromEntries(Object.keys(s.localStorage).map(k=>[k,s.localStorage.getItem(k)]));
 const investor={id:'inv_readonly',name:'Synthetic',source:'quote-snapshot',rooms:[{id:'room_A',baseType:'kuchnia',label:'A'}]};
 const data={meta:{assignedInvestorId:investor.id,productionPcvMode:'project',roomOrder:['room_A'],roomDefs:{room_A:{id:'room_A',baseType:'kuchnia',label:'A'}}},room_A:{cabinets:[{id:'one',width:60}],fronts:[],sets:[],settings:{}}};
 s.localStorage.setItem('fc_investors_v1',JSON.stringify([investor]));
 s.localStorage.setItem('fc_current_investor_v1',investor.id);
 s.localStorage.setItem('fc_projects_v1',JSON.stringify([{id:'project_A',investorId:investor.id,projectData:data}]));
 s.localStorage.setItem('fc_current_project_id_v1','foreign_project');
 s.localStorage.setItem('fc_project_v1',JSON.stringify({meta:{assignedInvestorId:'foreign'},room_old:{cabinets:[{id:'legacy'}]}}));
 s.localStorage.setItem('fc_quote_offer_drafts_v1',JSON.stringify([{projectId:'project_A',investorId:investor.id,selection:{selectedRooms:['room_old']}}]));
 s.localStorage.setItem('fc_quote_snapshots_v1',JSON.stringify([{id:'accepted',version:7,project:{id:'old_project',investorId:investor.id},investor:{id:investor.id},scope:{selectedRooms:['room_A']},commercial:{preliminary:false},meta:{storageSchema:"quote-snapshot-slim-v1",acceptedAt:1,selectedByClient:true},totals:{grand:123},lines:{materials:[{total:123}]}}]));
 s.projectData=clone(data);let before=raw();
 const refused=F.wycenaContextRepair.repairActiveQuoteContext({reason:'legacy'});
 assert(!refused.ok && refused.code==='PROJECT_CONTEXT_MISMATCH','Wrong owner must be refused without activation',refused);assert(JSON.stringify(raw())===JSON.stringify(before),'Read changed legacy data');
 // Explicit activation belongs to the existing project path, not quote rendering.
 F.projectStore.setCurrentProjectId('project_A');s.projectData=F.project.load();before=raw();
 const valid=F.wycenaContextRepair.readActiveQuoteContext();assert(valid.ok,'Canonical active context must remain readable',valid);assert(valid.projectData===s.projectData,'Reader returned a detached project');
 assert(valid.selectedRooms[0]==='room_old','Reader silently discarded an invalid draft scope',valid);assert(JSON.stringify(raw())===JSON.stringify(before),'Valid read changed storage');
 const relink=F.wycenaContextRepair.relinkInvestorSnapshotsToProject(investor.id,'project_A',['room_A']);assert(!relink.changed && relink.code==='HISTORY_RELINK_REQUIRES_REVIEW','Legacy associations must require review');assert(JSON.stringify(raw())===JSON.stringify(before),'History or investor source was rewritten');
 const frozen=s.localStorage.getItem('fc_quote_snapshots_v1');assert(F.quoteSnapshotStore.getById('accepted').project.id==='old_project','Accepted historical owner changed');assert(s.localStorage.getItem('fc_quote_snapshots_v1')===frozen,'History read modified original bytes');
 console.log('[wycena-local-storage-context-repair-smoke] read-only refusal, legacy RAW, invalid draft, accepted history and owner isolation PASS');
}
try{run();}catch(e){console.error(e.stack);process.exitCode=1;}

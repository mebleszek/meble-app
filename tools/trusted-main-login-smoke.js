'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const idb=require('./helpers/profile-indexeddb-fixture');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,1));}assert.fail('main-login did not reach expected state');}
function world(shared={},inherited=null){
 class Storage{constructor(rows){this.rows=rows||new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}}
 const local=new Storage(shared.rows),session=new Storage(),databases=shared.databases||new Map(),listeners={},nodes={};
 const node=id=>nodes[id]||=( {id,hidden:true,disabled:id==='auth-google',checked:false,dataset:{},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn;},contains:()=>false,
   content:{cloneNode:()=>({children:[],querySelectorAll:()=>[]})}});
 const timers=new Map();let time=1000,serial=0,authCreates=0,logins=0,authListener,watch,cloudUser=inherited;
 const clock=class extends Date{static now(){return time;}};
 const document={body:{dataset:{},classList:{toggle(){}},appendChild(){}},documentElement:{classList:{toggle(){}}},getElementById:node,
   addEventListener(type,fn){listeners['doc:'+type]=fn;},dispatchEvent(){w.__APP_STARTED__=true;},baseURI:'https://synthetic.invalid/'};
 const w={FC:{},crypto:webcrypto,location:{origin:'https://synthetic.invalid'},localStorage:local,indexedDB:{open(name){if(!databases.has(name))databases.set(name,idb());return databases.get(name).open();}},
   navigator:{locks:{request:async(_name,options,fn)=>(fn||options)()}},document,addEventListener(type,fn){(listeners[type]||=[]).push(fn);}};
 const set=(fn,ms)=>{const n=++serial;timers.set(n,{fn,at:time+ms});return n;},clear=n=>timers.delete(n);
 const load=file=>new Function('window','document','Storage','localStorage','sessionStorage','navigator','performance','setTimeout','clearTimeout','Date','Event',fs.readFileSync(file,'utf8'))(
   w,document,Storage,local,session,w.navigator,{now:()=>time},set,clear,clock,Event);
 for(const name of ['auth-access-gate','local-access-profile','local-device-access'])load('js/app/cloud/'+name+'.js');
 w.FC.cloudAuth={create:async options=>{assert.equal(options.sessionOnly,true);authCreates++;return {
   identity:()=>{if(!cloudUser)throw Error('No Google identity');return {uid:cloudUser,epoch:1};},state:()=>({uid:cloudUser}),subscribe(fn){authListener=fn;fn(cloudUser?{status:'authenticated',uid:cloudUser,epoch:1}:{status:'unauthenticated'});return()=>{};},
   signInGoogle:async()=>{logins++;cloudUser='owner';authListener?.({status:'authenticated',uid:'owner',epoch:1});return {ok:true};},signOut:async()=>{cloudUser=null;}
 };}};
 w.FC.cloudAccessVerifier={create:()=>({verify:async({uid})=>({ok:true,uid,validUntil:time+45000}),watch(_id,fn){watch=fn;return()=>{watch=null;};}})};
 w.FC.mainBusinessLoader={create:check=>({start:async()=>check(),abort(){throw Error('Unexpected abort');}})};
 w.FC.offlineShell={prepare:async()=>({complete:true})};
 load('js/main-login.js');
 const event=target=>({target,isTrusted:true,preventDefault(){},stopImmediatePropagation(){}});
 return {w,nodes,shared:{rows:local.rows,databases},get authCreates(){return authCreates;},get logins(){return logins;},
  ready:()=>document.body.dataset.businessState==='ready'&&w.__FC_MAIN_ACCESS__.isValid(),
  async login(){await until(()=>!node('auth-google').disabled);const target=node('auth-google');target.closest=()=>target;
   for(const fn of listeners.click)fn(event(target));try{await until(()=>this.ready());}catch(e){throw Error(JSON.stringify({state:document.body.dataset,status:node('auth-status').textContent,error:node('auth-error').textContent}),{cause:e});}},
  async trust(){node('main-trust-phone').checked=true;await node('main-trust-phone').change(event(node('main-trust-phone')));assert.equal(node('main-trust-phone').checked,true);},
  async logout(){const target=node('main-signout');target.closest=()=>target;for(const fn of listeners.click)fn(event(target));await tick();},
  deny(){watch?.({ok:false,denied:true});},offline(){watch?.({ok:false});},
  advance(ms){time+=ms;for(const [key,t]of [...timers])if(t.at<=time){timers.delete(key);t.fn();}},
  visible(){listeners['doc:visibilitychange']?.();},restore(){for(const fn of listeners.pageshow||[])fn({persisted:true});},
  close(){timers.clear();}
 };
}
async function main(){
 const d=world({},'owner');await until(()=>d.authCreates===1);assert.equal(d.ready(),false);await d.login();assert.equal(d.logins,1);
 d.w.projectData={unsaved:'EXACT-RAM'};const before=d.shared.rows.get('fc_projects_v1');d.advance(300000);
 assert.equal(d.ready(),false);assert.deepEqual(d.w.projectData,{unsaved:'EXACT-RAM'});assert.equal(d.shared.rows.get('fc_projects_v1'),before);
 await d.login();assert.equal(d.logins,2);d.restore();assert.equal(d.ready(),false);d.close();
 console.log('PASS main desktop: conscious login, idle/bfcache lock, reauthentication and exact RAM protection');
 const phone=world();await phone.login();await phone.trust();phone.offline();phone.visible();phone.advance(86400000);assert.equal(phone.ready(),true);
 const boot=world(phone.shared);await until(()=>boot.ready());assert.equal(boot.authCreates,0,'Trusted restart must not initialize Google/Firestore');assert.equal(boot.logins,0);
 await boot.logout();assert.equal(boot.ready(),false);const loggedOut=world(boot.shared);await until(()=>loggedOut.authCreates===1);assert.equal(loggedOut.ready(),false);
 phone.close();boot.close();loggedOut.close();
 console.log('PASS main phone: explicit trust, notification/visibility/offline/long use, full offline restart without Auth, offline logout veto');
 const revoked=world();await revoked.login();await revoked.trust();revoked.deny();assert.equal(revoked.ready(),false);
 const afterDenial=world(revoked.shared);await until(()=>afterDenial.authCreates===1);assert.equal(afterDenial.ready(),false);revoked.close();afterDenial.close();
 console.log('PASS main revocation: confirmed denial destroys offline admission; network uncertainty alone does not');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

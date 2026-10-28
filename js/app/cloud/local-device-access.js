// Local-only access, never a Google identity or Firebase authorization lease.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},caps=new WeakSet(),FENCE='meble_device_trust_fence_v1',DB='meble-device-trust-v1';
  const fail=code=>{throw Object.assign(Error(code),{code});};
  function createTrust({indexedDB=window.indexedDB,crypto=window.crypto,storage=window.localStorage,origin=window.location.origin}={}){
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    let generation=0;
    const fence=()=>get.call(storage,FENCE);
    const write=value=>{set.call(storage,FENCE,value);if(fence()!==value)fail('DEVICE_TRUST_STORAGE_UNCONFIRMED');};
    async function transaction(mode,action,initialize=false){
      if(!indexedDB||!crypto?.subtle)fail('DEVICE_TRUST_UNAVAILABLE');
      const db=await new Promise((resolve,reject)=>{
        const q=indexedDB.open(DB,1);let abandoned=false;
        q.onupgradeneeded=()=>{if(initialize)q.result.createObjectStore('proof');else q.transaction.abort();};
        q.onerror=()=>reject(Error('DEVICE_TRUST_MISSING'));q.onblocked=()=>{abandoned=true;reject(Error('DEVICE_TRUST_BLOCKED'));};
        q.onsuccess=()=>{if(abandoned){q.result.close();return;}resolve(q.result);};
      });
      try{return await new Promise((resolve,reject)=>{
        let result,error;const tx=db.transaction('proof',mode,mode==='readwrite'?{durability:'strict'}:undefined);
        tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||Error('DEVICE_TRUST_STORAGE_UNCONFIRMED'));tx.onerror=()=>{};
        const q=tx.objectStore('proof').get('active');q.onsuccess=()=>{try{
          const next=action(q.result);result=next===undefined?q.result:next;
          if(next!==undefined)tx.objectStore('proof').put(next,'active');
        }catch(e){error=e;tx.abort();}};
      });}finally{db.close();}
    }
    const encode=value=>new TextEncoder().encode(JSON.stringify(value));
    async function validate(record,expectedFence){
      const s=record?.statement;
      if(record?.version!==1||!s||s.domain!=='MEBLE_LOCAL_PHONE_v1'||s.origin!==origin||s.projectId!=='mebleszek-meble-app'
        ||typeof s.uid!=='string'||!s.uid||typeof s.profileAttemptId!=='string'||typeof s.installationId!=='string'
        ||expectedFence!=='active:'+s.installationId||fence()!==expectedFence
        ||record.privateKey?.extractable!==false||record.privateKey?.type!=='private'||record.publicKey?.type!=='public'
        ||!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},record.publicKey,record.signature,encode(s)))fail('DEVICE_TRUST_INVALID');
      // Prove that this IDB still holds the matching, non-exportable private key.
      const challenge=crypto.getRandomValues(new Uint8Array(32));
      const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},record.privateKey,challenge);
      if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},record.publicKey,signature,challenge)||fence()!==expectedFence)fail('DEVICE_TRUST_INVALID');
      const cap=Object.freeze({uid:s.uid,profileAttemptId:s.profileAttemptId,assert(){if(fence()!==expectedFence)fail('DEVICE_TRUST_REVOKED');}});
      caps.add(cap);return cap;
    }
    return Object.freeze({key:FENCE,
      async restore(){const value=fence();if(!value?.startsWith('active:'))return null;return validate(await transaction('readonly',()=>{}),value);},
      async enroll({uid,profileAttemptId,check,consent}){
        if(consent!==true||typeof check!=='function')fail('DEVICE_TRUST_CONSENT_REQUIRED');
        let expectedFence=null;const turn=++generation,assert=()=>{if(turn!==generation||(expectedFence!==null&&fence()!==expectedFence))fail('DEVICE_TRUST_REVOKED');const v=check();if(v?.then)fail('DEVICE_TRUST_UNCONFIRMED');};
        assert();if(typeof uid!=='string'||!uid||typeof profileAttemptId!=='string'||!profileAttemptId)fail('DEVICE_TRUST_INVALID');
        expectedFence='pending:'+crypto.randomUUID();write(expectedFence);
        const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);assert();
        const statement={domain:'MEBLE_LOCAL_PHONE_v1',projectId:'mebleszek-meble-app',origin,uid,profileAttemptId,installationId:crypto.randomUUID()};
        const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,encode(statement));assert();
        await transaction('readwrite',current=>{assert();const owner=current?.statement?.uid||current?.ownerUid;if(owner&&owner!==uid)fail('DEVICE_TRUST_OTHER_ACCOUNT');return {version:1,statement,...keys,signature};},true);assert();
        write('active:'+statement.installationId);expectedFence='active:'+statement.installationId;
        const cap=await validate(await transaction('readonly',()=>{}),'active:'+statement.installationId);assert();return cap;
      },
      // Synchronous veto comes first; IDB is a second durable revocation path.
      // A persistence failure is reported, never presented as confirmed logout.
      revoke(){generation++;let veto=false;try{write('revoked');veto=true;}catch(_){}
        return transaction('readwrite',current=>({version:1,revoked:true,ownerUid:current?.statement?.uid||current?.ownerUid||null}),true).then(()=>true,error=>{if(!veto)throw error;return true;});}
    });
  }
  function createSession({onLock=()=>{},now=()=>Date.now(),mono=()=>performance.now(),timer=setTimeout,cancel=clearTimeout}={}){
    let uid=null,mode='locked',wall=0,ticks=0,timeout,cap=null,epoch=0;
    function lock(code='LOCAL_SESSION_LOCKED'){cancel(timeout);uid=null;mode='locked';cap=null;epoch++;onLock(code);}
    function valid(){
      if(!uid)return false;
      if(mode==='trusted'){try{cap.assert();return true;}catch(_){lock('DEVICE_TRUST_REVOKED');return false;}}
      if(now()<wall||Math.max(now()-wall,mono()-ticks)>=300000){lock('LOCAL_SESSION_IDLE');return false;}return true;
    }
    function arm(){cancel(timeout);timeout=timer(()=>{if(valid())arm();},Math.max(1,300000-Math.max(now()-wall,mono()-ticks)));}
    return Object.freeze({lock,isValid:valid,mode:()=>mode,identity(){if(!valid())fail('LOCAL_SESSION_LOCKED');return {uid,epoch};},
      desktop(owner){if(typeof owner!=='string'||!owner)fail('LOCAL_SESSION_OWNER_REQUIRED');cancel(timeout);uid=owner;epoch++;mode='desktop';cap=null;wall=now();ticks=mono();arm();},
      trusted(value){if(!caps.has(value))fail('DEVICE_TRUST_INVALID');value.assert();cancel(timeout);uid=value.uid;epoch++;cap=value;mode='trusted';wall=now();},
      activity(event){if(!valid()||mode!=='desktop'||event?.isTrusted!==true)return;wall=now();ticks=mono();arm();},
      assert(owner){if(!valid()||owner!==uid)fail('LOCAL_SESSION_LOCKED');}
    });
  }
  FC.localDeviceAccess={createTrust,createSession};
})();

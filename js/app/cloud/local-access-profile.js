// Local access receipt. Existing data requires a separate, explicit admission.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},KEY='meble_access_profile_v1',PENDING='meble_access_profile_pending_v1';
  const legacy=new Set(['hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes']);
  const businessKey=key=>String(key).startsWith('fc_')||legacy.has(String(key));
  const attemptPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const fail=code=>{const e=Error(code);e.code=code;throw e;};
  const DATABASE='meble-access-profile-v1',STORE='ownership',OWNER='owner';
  function create(local,session,{indexedDB=window.indexedDB,authorize=()=>{}}={}){
    const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem,key=proto.key;
    const admissions=new WeakMap(),transactions=new Set();
    let database=null,opening=null,verified=null,generation=0;
    function revoke(){generation++;verified=null;for(const tx of transactions){try{tx.abort();}catch(_){}}}
    function operation(uid){
      if(typeof uid!=='string'||!uid)fail('LOCAL_ACCESS_UNCONFIRMED');
      const turn=generation,epoch=authorize(uid);
      return ()=>{if(turn!==generation||authorize(uid)!==epoch)fail('LOCAL_ACCESS_UNCONFIRMED');return epoch;};
    }
    function owner(value,uid){
      if(value===undefined)return null;
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='attemptId,state,uid,version'||value.version!==1
        ||typeof value.uid!=='string'||!value.uid||!['pending','active'].includes(value.state)
        ||typeof value.attemptId!=='string'||!attemptPattern.test(value.attemptId))fail('LOCAL_ACCESS_COORDINATION_INVALID');
      if(value.uid!==uid)fail('LOCAL_ACCESS_OTHER_ACCOUNT');return value;
    }
    function open(){
      if(database)return Promise.resolve(database);
      if(opening)return opening;
      opening=new Promise((resolve,reject)=>{
        let request,settled=false;
        const no=()=>{if(!settled){settled=true;reject(Object.assign(Error('LOCAL_ACCESS_COORDINATION_UNAVAILABLE'),{code:'LOCAL_ACCESS_COORDINATION_UNAVAILABLE'}));}};
        try{
          if(!indexedDB)throw Error();
          request=indexedDB.open(DATABASE,1);
          request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
          request.onerror=no;request.onblocked=no;
          request.onsuccess=()=>{
            const db=request.result;if(settled){db.close();return;}
            if(!db.objectStoreNames.contains(STORE)){db.close();no();return;}
            settled=true;database=db;db.onversionchange=()=>{revoke();db.close();database=null;opening=null;};resolve(db);
          };
        }catch(_){no();}
      }).catch(error=>{opening=null;throw error;});
      return opening;
    }
    async function transact(uid,check,mode,change,verifyReadback=()=>{}){
      check();const db=await open();check();
      return new Promise((resolve,reject)=>{
        let tx,result,error;
        const abort=e=>{error=typeof e?.code==='string'&&e.code.startsWith('LOCAL_')?e:Object.assign(Error('LOCAL_ACCESS_UNCONFIRMED'),{code:'LOCAL_ACCESS_UNCONFIRMED'});try{tx.abort();}catch(_){}};
        try{
          tx=db.transaction(STORE,mode,mode==='readwrite'?{durability:'strict'}:undefined);transactions.add(tx);
          tx.onabort=()=>{verified=null;transactions.delete(tx);reject(error||Object.assign(Error('LOCAL_ACCESS_UNCONFIRMED'),{code:'LOCAL_ACCESS_UNCONFIRMED'}));};
          tx.onerror=()=>{}; // Request success is NOT transaction confirmation.
          tx.oncomplete=()=>{transactions.delete(tx);resolve(result);};
          const store=tx.objectStore(STORE),request=store.get(OWNER);
          request.onerror=()=>abort(Object.assign(Error('LOCAL_ACCESS_UNCONFIRMED'),{code:'LOCAL_ACCESS_UNCONFIRMED'}));
          request.onsuccess=()=>{
            try{
              check();const current=owner(request.result,uid),next=change(current);
              if(next===undefined){result=current;return;}
              const write=store.put(next,OWNER);
              write.onerror=()=>abort(Object.assign(Error('LOCAL_ACCESS_UNCONFIRMED'),{code:'LOCAL_ACCESS_UNCONFIRMED'}));
              write.onsuccess=()=>{
                try{const readback=store.get(OWNER);
                readback.onerror=()=>abort(Object.assign(Error('LOCAL_ACCESS_UNCONFIRMED'),{code:'LOCAL_ACCESS_UNCONFIRMED'}));
                readback.onsuccess=()=>{try{check();if(JSON.stringify(readback.result)!==JSON.stringify(next))fail('LOCAL_ACCESS_UNCONFIRMED');result=owner(readback.result,uid);verifyReadback(result);}catch(e){abort(e);}};
                }catch(e){abort(e);}
              };
            }catch(e){abort(e);}
          };
        }catch(e){if(tx)abort(e);else reject(Object.assign(Error('LOCAL_ACCESS_COORDINATION_UNAVAILABLE'),{code:'LOCAL_ACCESS_COORDINATION_UNAVAILABLE'}));}
      });
    }
    const read=()=>get.call(local,KEY);
    function parse(raw,uid,pending=false){
      if(raw===null)return null;
      let value;try{value=JSON.parse(raw);}catch(_){fail('LOCAL_ACCESS_INVALID');}
      if(!value||typeof value.uid!=='string'||!value.uid)fail('LOCAL_ACCESS_INVALID');
      const fields=Object.keys(value).sort().join(',');
      const old=!pending&&value.version===1&&fields==='uid,version';
      if(!old&&(!(pending?value.version===1:[2,3].includes(value.version))||fields!=='attemptId,uid,version'
        ||typeof value.attemptId!=='string'||!attemptPattern.test(value.attemptId)))fail('LOCAL_ACCESS_INVALID');
      if(value.uid!==uid)fail('LOCAL_ACCESS_OTHER_ACCOUNT');return value;
    }
    function receipt(uid){
      const pending=parse(get.call(local,PENDING),uid,true),value=parse(read(),uid);
      // Version 1 cannot distinguish an acknowledged admission from the old
      // failed attempt. It is never silently upgraded or trusted on restart.
      return {trusted:!pending&&value?.version===2,unconfirmed:!!pending||value?.version===1||value?.version===3,pending:!!pending,value};
    }
    function empty(){
      for(const store of [local,session])for(let i=0;i<store.length;i++)if(businessKey(key.call(store,i)))return false;
      return true;
    }
    // Ephemeral evidence only: never persists or exposes the business values.
    function evidence(){
      return JSON.stringify([local,session].map(store=>{
        const names=[];for(let i=0;i<store.length;i++){const name=key.call(store,i);if(businessKey(name))names.push(name);}
        return names.sort().map(name=>[name,get.call(store,name)]);
      }));
    }
    function writeLegacy(uid,verify,attemptId){
      if(typeof attemptId!=='string'||!attemptPattern.test(attemptId))fail('LOCAL_ACCESS_UNCONFIRMED');
      const previous=read(),pending=JSON.stringify({version:1,uid,attemptId}),active=JSON.stringify({version:3,uid,attemptId});
      try{
        // A durable veto precedes every candidate write. Failed attempts never
        // clear it; reload therefore requires fresh authorization AND consent.
        set.call(local,PENDING,pending);
        if(get.call(local,PENDING)!==pending||read()!==previous)fail('LOCAL_ACCESS_UNCONFIRMED');
        verify();
        set.call(local,KEY,active);
        if(read()!==active||get.call(local,PENDING)!==pending)fail('LOCAL_ACCESS_UNCONFIRMED');
        verify();
        // v3 is deliberately untrusted by pre-IDB releases; rollback must fail closed.
        // Legacy seal only: the authoritative IDB reservation remains pending.
        // Any later read-back or transaction failure still refuses on restart.
        // Only completion of the surrounding IDB transaction activates access.
        remove.call(local,PENDING);
      }catch(error){fail(error?.code==='LOCAL_ACCESS_DATA_CHANGED'?error.code:'LOCAL_ACCESS_UNCONFIRMED');}
    }
    function validateActive(uid,value){
      const legacy=receipt(uid);
      if(value?.state!=='active'||legacy.pending||legacy.value?.version===1)fail('LOCAL_DATA_UNCLAIMED');
      if(legacy.value&&legacy.value.attemptId!==value.attemptId)fail('LOCAL_ACCESS_UNCONFIRMED');
    }
    function accept(value,epoch){verified={...value,epoch};}
    async function bind(uid,check,verify){
      const proposedId=window.crypto?.randomUUID?.();
      if(typeof proposedId!=='string'||!attemptPattern.test(proposedId))fail('LOCAL_ACCESS_UNCONFIRMED');
      const reserved=await transact(uid,check,'readwrite',current=>{
        verify();receipt(uid);
        if(current?.state==='active'){validateActive(uid,current);return;}
        if(current)return; // Same UID shares its immutable reservation; no competing nonce replacement.
        return {version:1,uid,state:'pending',attemptId:proposedId};
      });
      check();
      if(reserved.state==='active'){accept(reserved,check());return;}
      const attemptId=reserved.attemptId;
      // The durable reservation survives every failed legacy write or abort.
      // UID cannot be replaced, including when another tab has stale localStorage.
      const active=await transact(uid,check,'readwrite',current=>{
        if(current?.state==='active'){validateActive(uid,current);return;}
        if(!current||current.attemptId!==attemptId)fail('LOCAL_ACCESS_UNCONFIRMED');
        verify();check();writeLegacy(uid,()=>{verify();check();},attemptId);
        return {...current,state:'active'};
      },value=>{verify();validateActive(uid,value);});
      // All fallible read-back/data validation took place BEFORE tx commit.
      // A lost page after commit restores this exact acknowledged owner; before
      // commit the reservation stays pending and requires fresh owner consent.
      check();accept(active,check());
    }
    return {
      async confirm(uid){
        verified=null;
        const check=operation(uid),legacy=receipt(uid),current=await transact(uid,check,'readonly',()=>{});check();
        if(current?.state==='active'){validateActive(uid,current);accept(current,check());return;}
        if(current?.state==='pending')fail('LOCAL_DATA_UNCLAIMED');
        if(legacy.trusted){
          // Existing acknowledged v2 receipt: atomic, non-destructive transition.
          // No legacy/source write and no new owner consent on an existing Android profile.
          const migrated=await transact(uid,check,'readwrite',value=>{
            const now=receipt(uid);if(!now.trusted||now.value.attemptId!==legacy.value.attemptId)fail('LOCAL_ACCESS_UNCONFIRMED');
            if(value){validateActive(uid,value);return;}
            return {version:1,uid,state:'active',attemptId:now.value.attemptId};
          },value=>validateActive(uid,value));check();accept(migrated,check());return;
        }
        if(legacy.unconfirmed||!empty())fail('LOCAL_DATA_UNCLAIMED');
        await bind(uid,check,()=>{if(!empty())fail('LOCAL_ACCESS_DATA_CHANGED');});
      },
      async prepareAdmission(uid){
        const check=operation(uid),current=await transact(uid,check,'readonly',()=>{});check();
        const state=receipt(uid);
        if(current?.state==='active'||(!current&&state.trusted)||(!current&&!state.unconfirmed&&empty()))fail('LOCAL_ACCESS_UNCONFIRMED');
        const ticket=Object.freeze({});admissions.set(ticket,{uid,epoch:check(),evidence:evidence()});return ticket;
      },
      async admitExisting(uid,ticket,{backupConfirmed,ownerConfirmed}={}){
        if(backupConfirmed!==true||ownerConfirmed!==true)fail('LOCAL_ACCESS_CONSENT_REQUIRED');
        const pending=ticket&&admissions.get(ticket);
        if(!pending||pending.uid!==uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        admissions.delete(ticket);
        const check=operation(uid);if(check()!==pending.epoch)fail('LOCAL_ACCESS_UNCONFIRMED');
        const verify=()=>{if(evidence()!==pending.evidence)fail('LOCAL_ACCESS_DATA_CHANGED');};
        verify();receipt(uid);await bind(uid,check,verify);
      },
      assert(uid){
        const epoch=authorize(uid);
        if(!verified||verified.uid!==uid||verified.epoch!==epoch)fail('LOCAL_ACCESS_UNCONFIRMED');
        const legacy=receipt(uid);
        if(legacy.pending||legacy.value?.version===1||(legacy.value&&legacy.value.attemptId!==verified.attemptId))fail('LOCAL_ACCESS_UNCONFIRMED');
      },
      revoke,
      key:KEY,pendingKey:PENDING,isAccessKey:key=>key===KEY||key===PENDING,businessKey
    };
  }
  FC.localAccessProfile={create,DATABASE,STORE,OWNER};
})();

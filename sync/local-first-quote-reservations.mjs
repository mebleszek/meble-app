import {copy,digest,equal,fail,id,json} from './local-first-values.mjs';
import {quoteReservationRequest,releasedQuoteReservation,validateQuoteReservationIntent,validateQuoteReservationMarker,validateQuoteReservationRequest,verifyQuoteReservation} from './quote-reservation-contract.mjs';

const prefix='quote-reservation:';
const grantPrefix='quote-grant:';
const requireCurrent=(current,expected)=>{
  if(!equal(current,expected))fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
};

export function quoteReservationJournal({transaction,ownerUid,deviceId}){
  function validate(row){
    validateQuoteReservationIntent(row?.intent,ownerUid,deviceId);
    if(row.key!==row.intent.key||row.sent!==undefined&&typeof row.sent!=='boolean')fail('LF_QUOTE_RESERVATION_INVALID');
    if(row.phase==='prepared'){
      if(row.receipt!==null)fail('LF_QUOTE_RESERVATION_INVALID');
    }else{
      if(!['held','releasing'].includes(row.phase)||!row.receipt)fail('LF_QUOTE_RESERVATION_INVALID');
      const {status,marker,request}=row.receipt;
      verifyQuoteReservation(row.intent,status,marker,request===null?undefined:request);
    }
    return row;
  }
  async function stageQuoteReservation({intent,image,assertAccess}){
    intent=copy(intent);
    validateQuoteReservationIntent(intent,ownerUid,deviceId);
    if(!image||image.hash!==await digest(json(image.rows))||image.rows.fc_current_investor_v1!==intent.investorId
      ||image.rows.fc_edit_session_v1!=null)fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
    const projects=JSON.parse(image.rows.fc_projects_v1||'[]').filter(project=>project.id===intent.projectId);
    if(projects.length!==1||projects[0].investorId!==intent.investorId||projects[0].meta?.roomProject?.version!==1
      ||projects[0].meta.roomProject.roomId!==intent.projectId||projects[0].meta.roomProject.removed)
      fail('LF_APPLICATION_SCOPE_REFUSED');
    const next={key:intent.key,phase:'prepared',intent,receipt:null,sent:false};
    return transaction('readwrite',(s,done,abort)=>{
      const app=s.control.get('application'),prior=s.control.get(intent.key),registry=s.control.get('p0b-registry');
      const recovery=s.control.get('projectRecovery:'+intent.projectId),release=s.control.get('quote-release:'+intent.projectId);
      const handover=s.control.get('handover:'+intent.projectId),replica=s.replicas.get(intent.projectId),outbox=s.outbox.getAll();
      const grant=s.control.get(grantPrefix+intent.projectId),retired=s.control.get('retired:'+intent.projectId);
      const requests=[app,prior,registry,recovery,release,handover,replica,outbox,grant,retired];
      let waiting=requests.length;
      const finish=()=>{if(--waiting)return;try{
        assertAccess();
        requireCurrent(app.result,image);
        if(registry.result?.registry!=='p0b-rooms-v1'||recovery.result||release.result||handover.result
          ||grant.result||retired.result||replica.result?.dirty||outbox.result.some(row=>row.scope===intent.projectId&&row.phase!=='verified'))
          fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
        if(prior.result){
          validate(prior.result);
          if(!equal(prior.result.intent,intent))fail('LF_QUOTE_RESERVATION_PENDING');
          done(prior.result);return;
        }
        s.control.add(next);done(next);
      }catch(error){abort(error);}};
      for(const request of requests)request.onsuccess=finish;
    },intent.projectId);
  }
  function pendingQuoteReservations(){
    return transaction('readonly',(s,done,abort)=>{
      const cursor=s.control.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff')),records=[];
      cursor.onsuccess=()=>{try{
        if(!cursor.result){done(records);return;}
        records.push(validate(cursor.result.value));cursor.result.continue();
      }catch(error){abort(error);}};
    });
  }
  function update(expected,next,assertAccess,archive){
    return transaction('readwrite',(s,done,abort)=>{
      const prior=s.control.get(expected.key);
      const operations=next.phase==='releasing'?s.outbox.getAll():null;
      let waiting=operations?2:1;
      const finish=()=>{if(--waiting)return;try{
        assertAccess();
        requireCurrent(prior.result,expected);
        if(operations?.result.some(op=>op.phase!=='verified'&&op.reservations?.some(row=>equal(row,expected))))
          fail('LF_QUOTE_RESERVATION_PUBLICATION_PENDING');
        if(archive){s.protected.add(archive);s.control.delete(expected.key);}
        else s.control.put(next);
        done(next);
      }catch(error){abort(error);}};
      prior.onsuccess=finish;
      if(operations)operations.onsuccess=finish;
    },expected.intent.projectId);
  }
  function markQuoteReservationSent(expected,assertAccess){
    validate(expected);
    if(expected.phase!=='prepared')fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
    return update(expected,{...expected,sent:true},assertAccess);
  }
  async function cancelUnsentQuoteReservation(expected,assertAccess){
    validate(expected);
    if(expected.phase!=='prepared'||expected.sent!==false)fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const {intent}=expected,key='quote-reservation-receipt:'+intent.operationId+':'+intent.projectId;
    const encoded=json({version:1,expected,outcome:'cancelled-before-send'});
    return update(expected,{key,localConfirmed:true},assertAccess,
      {key,scope:intent.projectId,json:encoded,hash:await digest(encoded)});
  }
  function confirmQuoteReservation({expected,observed,assertAccess}){
    validate(expected);
    if(expected.phase!=='prepared')fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
    const request=expected.intent.mode==='request'?observed.request:undefined;
    const {status,marker}=verifyQuoteReservation(expected.intent,observed.status,observed.marker,request);
    const next={...expected,phase:'held',receipt:{status,marker,request:copy(request??null)}};
    return update(expected,next,assertAccess);
  }
  function beginQuoteReservationRelease(expected,assertAccess){
    validate(expected);
    if(expected.phase!=='held')fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
    return update(expected,{...expected,phase:'releasing'},assertAccess);
  }
  async function finishQuoteReservation({expected,observed,assertAccess}){
    validate(expected);
    if(expected.phase==='prepared'){
      validateQuoteReservationRequest(observed.request);
      if(!['declined','cancelled'].includes(observed.request.state)||!equal(
        {...observed.request,state:'pending',revision:''},quoteReservationRequest(expected.intent)))
        fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    }else{
      if(expected.phase!=='releasing')fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
      const {status,marker,request}=expected.receipt;
      const released=releasedQuoteReservation(status,marker);
      if(!equal(observed.status,released.status)||!equal(observed.marker,released.marker)
        ||request&&!equal(observed.request,{...request,state:'released'}))fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    }
    const key='quote-reservation-receipt:'+id(expected.intent.operationId)+':'+expected.intent.projectId;
    const encoded=json({version:1,expected,observed}),archive={key,scope:expected.intent.projectId,json:encoded,hash:await digest(encoded)};
    return update(expected,{key,localConfirmed:true},assertAccess,archive);
  }
  async function abandonQuoteReservation({expected,observed,assertAccess}){
    validate(expected);
    const {intent}=expected,previous=intent.expected;
    const current=observed.status;
    if(expected.phase!=='prepared'||current?.editor?.ownerUid!==ownerUid
      ||current.editor.projectId!==intent.projectId||current.editor.investorId!==intent.investorId
      ||!Number.isSafeInteger(current.editor.epoch)||current.editor.epoch<previous.editor.epoch
      ||current.editor.epoch===previous.editor.epoch&&current.revision===previous.revision
        &&!(previous.editor.active&&!current.editor.active)
      ||observed.marker?.token===intent.token||observed.request?.token===intent.token)
      fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const key='quote-reservation-receipt:'+intent.operationId+':'+intent.projectId;
    const encoded=json({version:1,expected,observed,outcome:'superseded'});
    return update(expected,{key,localConfirmed:true},assertAccess,
      {key,scope:intent.projectId,json:encoded,hash:await digest(encoded)});
  }

  function validateGrant(record){
    const request=record?.request;
    validateQuoteReservationRequest(request);
    if(request.state!=='pending'||request.ownerUid!==ownerUid||request.editorDeviceId!==deviceId
      ||record.key!==grantPrefix+request.projectId||record.editor?.deviceId!==deviceId
      ||record.editor.epoch!==request.editorEpoch||record.editor.active!==true
      ||record.editor.ownerUid!==ownerUid||record.editor.investorId!==request.investorId
      ||record.editor.projectId!==request.projectId||!(/^[a-f0-9]{32}$/.test(record.revision||'')))
      fail('LF_QUOTE_RESERVATION_INVALID');
    return record;
  }
  function pendingQuoteGrant(scope){
    return transaction('readonly',(s,done,abort)=>{
      const request=s.control.get(grantPrefix+id(scope));
      request.onsuccess=()=>{try{done(request.result?validateGrant(request.result):null);}catch(error){abort(error);}};
    },scope);
  }
  function pendingQuoteGrants(){
    return transaction('readonly',(s,done,abort)=>{
      const cursor=s.control.openCursor(IDBKeyRange.bound(grantPrefix,grantPrefix+'\uffff')),records=[];
      cursor.onsuccess=()=>{try{
        if(!cursor.result){done(records);return;}
        records.push(validateGrant(cursor.result.value));cursor.result.continue();
      }catch(error){abort(error);}};
    });
  }
  function stageQuoteGrant({request,image,replica,assertAccess}){
    const scope=request.projectId,record=validateGrant({key:grantPrefix+scope,request:copy(request),editor:copy(replica?.editor),
      revision:replica?.base?.currentRevisionId});
    return transaction('readwrite',(s,done,abort)=>{
      const app=s.control.get('application'),local=s.replicas.get(scope),prior=s.control.get(record.key),ops=s.outbox.getAll();
      const requests=[app,local,prior,ops,s.control.get('handover:'+scope),s.control.get('projectRecovery:'+scope),
        s.control.get('quote-reservation:'+scope),s.control.get('quote-release:'+scope),s.control.get('retired:'+scope)];
      let waiting=requests.length;
      const finish=()=>{if(--waiting)return;try{
        assertAccess();
        requireCurrent(app.result,image);requireCurrent(local.result,replica);
        if(app.result.rows.fc_edit_session_v1!=null||prior.result||requests.slice(4).some(row=>row.result)
          ||replica.dirty||ops.result.some(row=>row.scope===scope&&row.phase!=='verified'))
          fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
        // The separate journal fences reopen and ordinary release while the
        // existing editor remains the server holder until the atomic grant.
        s.control.add(record);done(record);
      }catch(error){abort(error);}};
      for(const item of requests)item.onsuccess=finish;
    },scope);
  }
  async function finishQuoteGrant({expected,observed,assertAccess}){
    const {request,revision,editor,key}=validateGrant(expected),scope=request.projectId;
    const {status,marker}=observed,decision=observed.request;
    validateQuoteReservationRequest(decision);
    const sameRequest=equal({...decision,state:'pending',revision:''},request);
    if(!sameRequest)fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const granted=decision.state==='granted'||decision.state==='released';
    if(granted){
      validateQuoteReservationMarker(marker);
      if(decision.revision!==revision||marker.token!==request.token||marker.deviceId!==request.requesterDeviceId
        ||marker.deviceLabel!==request.requesterDeviceLabel||marker.epoch!==editor.epoch+1||marker.revision!==revision||marker.ownerUid!==ownerUid
        ||marker.projectId!==scope||marker.investorId!==request.investorId
        ||marker.active!==(decision.state==='granted'))fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    }else if(decision.state!=='cancelled'&&decision.state!=='declined')fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const archiveKey='quote-grant-receipt:'+request.requestId;
    const encoded=json({version:1,expected,observed}),hash=await digest(encoded);
    return transaction('readwrite',(s,done,abort)=>{
      const prior=s.control.get(key),replica=s.replicas.get(scope),queue=s.outbox.getAll();
      let waiting=3;
      const finish=()=>{if(--waiting)return;try{
        assertAccess();requireCurrent(prior.result,expected);
        if(replica.result?.dirty||queue.result.some(row=>row.scope===scope&&row.phase!=='verified'))
          fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
        if(granted&&equal(replica.result?.editor,editor)){
          s.replicas.put({...replica.result,version:replica.result.version+1,editor:null});
        }
        s.protected.add({key:archiveKey,scope,json:encoded,hash});s.control.delete(key);
        done({granted,status});
      }catch(error){abort(error);}};
      prior.onsuccess=replica.onsuccess=queue.onsuccess=finish;
    },scope);
  }
  return {stageQuoteReservation,pendingQuoteReservations,markQuoteReservationSent,cancelUnsentQuoteReservation,confirmQuoteReservation,beginQuoteReservationRelease,finishQuoteReservation,
    abandonQuoteReservation,pendingQuoteGrant,pendingQuoteGrants,stageQuoteGrant,finishQuoteGrant};
}

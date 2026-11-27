// Explicit DEMO candidate. Request acknowledgement never substitutes for the
// server-observed room revision and editor epoch.
import {copy,equal,fail} from '../../sync/local-first-values.mjs';
import {
  quoteReservationEditor,quoteReservationMarker,quoteReservationRequest,releasedQuoteReservation,
  validateQuoteReservationIntent,validateQuoteReservationMarker,validateQuoteReservationRequest,verifyQuoteReservation,
} from '../../sync/quote-reservation-contract.mjs';

export function createP0BQuoteReservations({uid,deviceId,lockWitness,transaction,read,refs,pin,assertAccess,listen}){
  const refuse=()=>fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
  async function witness(tx,iid,pid){
    const ref=refs(pid,iid);
    const status=await lockWitness(tx,iid,pid);
    const marker=read(await tx.get(ref.marker)),request=read(await tx.get(ref.request));
    if(marker){validateQuoteReservationMarker(marker);if(marker.ownerUid!==uid||marker.investorId!==iid||marker.projectId!==pid)refuse();}
    if(request){validateQuoteReservationRequest(request);if(request.ownerUid!==uid||request.investorId!==iid||request.projectId!==pid)refuse();}
    if(marker?.active&&(status.revision!==marker.revision||status.editor.epoch!==marker.epoch
      ||status.editor.deviceId!==marker.deviceId||status.editor.deviceLabel!==marker.deviceLabel||!status.editor.active))refuse();
    return {status,marker,request};
  }
  const inspect=(iid,pid)=>transaction(tx=>witness(tx,iid,pid));
  function exactGrant(current,request){
    const {marker,status}=current;
    if(!marker?.active||request.state!=='granted'||marker.token!==request.token
      ||marker.deviceId!==request.requesterDeviceId||marker.deviceLabel!==request.requesterDeviceLabel
      ||marker.epoch!==request.editorEpoch+1||marker.revision!==request.revision)refuse();
    return {status,marker};
  }
  async function writeRelease(tx,ref,current,released){
    const investor=read(await tx.get(ref.investor)),request=current.request;
    if(request?.state==='granted'&&request.token===released.marker.token)
      tx.set(ref.request,{...request,state:'released'});
    tx.set(ref.investor,{...investor,generation:investor.generation+1,lastProject:released.marker.projectId,
      projects:{...investor.projects,[released.marker.projectId]:false}});
    tx.set(ref.editor,released.status.editor);
    tx.set(ref.marker,released.marker);
  }
  return Object.freeze({
    inspect,
    watch(investorId,projectId,changed,onError){
      assertAccess();
      const ref=refs(projectId,investorId);
      const receive=snapshot=>{try{
        assertAccess();
        if(!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites)changed();
      }catch(error){onError(error);}};
      const stopRequest=listen(ref.request,receive,onError);
      try{
        const stopMarker=listen(ref.marker,receive,onError);
        return ()=>{stopRequest();stopMarker();};
      }catch(error){stopRequest();throw error;}
    },
    async assertPublication(tx,{investorId,pins,proofs}){
      assertAccess();
      if(!Array.isArray(pins)||!pins.length||!Array.isArray(proofs)||proofs.length!==pins.length
        ||new Set(pins.map(pin=>pin?.projectId)).size!==pins.length)refuse();
      for(const pin of pins){
        const proof=proofs.find(row=>row?.intent?.projectId===pin?.projectId&&pin?.projectId);
        if(!proof)refuse();
        const {intent,receipt}=proof;
        validateQuoteReservationIntent(intent,uid,deviceId);
        if(intent.investorId!==investorId||pin.head?.projectId!==intent.projectId||pin.head.investorId!==investorId
          ||pin.head.ownerUid!==uid||receipt?.status?.revision!==pin.head.currentRevisionId)refuse();
        const current=await witness(tx,investorId,pin.projectId);
        const request=intent.mode==='request'?current.request:undefined;
        const expected=verifyQuoteReservation(intent,current.status,current.marker,request);
        if(!equal(receipt,{...expected,request:request??null}))refuse();
      }
      assertAccess();
    },
    async reserve(intent,pinInput){
      validateQuoteReservationIntent(intent,uid,deviceId);
      const {investorId:iid,projectId:pid}=intent;
      if(intent.mode==='request')refuse();
      const ref=refs(pid,iid);
      await transaction(async tx=>{
        const current=await witness(tx,iid,pid);
        if(current.marker?.token===intent.token){verifyQuoteReservation(intent,current.status,current.marker);return;}
        if(!equal(current.status,intent.expected)||current.marker?.active)refuse();
        if(intent.mode==='pin'&&await pin.verify(pinInput)!==intent.pinRevision)fail('LF_P0B_PIN_CONFLICT');
        if(intent.mode==='pin'&&read(await tx.get(ref.pin))?.revision!==intent.pinRevision)fail('LF_P0B_PIN_CONFLICT');
        if(intent.mode==='free'){
          const investor=read(await tx.get(ref.investor));
          tx.set(ref.investor,{...investor,generation:investor.generation+1,lastProject:pid,projects:{...investor.projects,[pid]:true}});
        }
        tx.set(ref.editor,quoteReservationEditor(intent));
        tx.set(ref.marker,quoteReservationMarker(intent));
      });
      const current=await inspect(iid,pid);
      return verifyQuoteReservation(intent,current.status,current.marker);
    },
    async request(intent){
      validateQuoteReservationIntent(intent,uid,deviceId);
      const {investorId:iid,projectId:pid}=intent,ref=refs(pid,iid),pending=quoteReservationRequest(intent);
      await transaction(async tx=>{
        const current=await witness(tx,iid,pid),old=current.request;
        if(old?.requestId===pending.requestId){
          if(!equal({...old,state:'pending',revision:''},pending))refuse();
          return;
        }
        if(!equal(current.status,intent.expected)||current.marker?.active||['pending','granted'].includes(old?.state))refuse();
        tx.set(ref.request,pending);
      });
      const {request}=await inspect(iid,pid);
      if(!request||!equal({...request,state:'pending',revision:''},pending))refuse();
      return request;
    },
    async decide(pending,decision,publishedRevision){
      validateQuoteReservationRequest(pending);
      if(pending.ownerUid!==uid||pending.state!=='pending'||!['grant','decline','cancel'].includes(decision)
        ||deviceId!==(decision==='cancel'?pending.requesterDeviceId:pending.editorDeviceId))refuse();
      const {investorId:iid,projectId:pid}=pending,ref=refs(pid,iid);
      const state=decision==='grant'?'granted':decision==='cancel'?'cancelled':'declined';
      const result={...copy(pending),state,revision:decision==='grant'?publishedRevision:''};
      validateQuoteReservationRequest(result);
      await transaction(async tx=>{
        const current=await witness(tx,iid,pid),editor=current.status.editor;
        if(equal(current.request,result)){if(decision==='grant')exactGrant(current,result);return;}
        if(!equal(current.request,pending)||current.marker?.active)refuse();
        if(decision!=='cancel'&&(!editor.active||editor.deviceId!==pending.editorDeviceId||editor.epoch!==pending.editorEpoch))refuse();
        if(decision==='grant'){
          if(publishedRevision!==current.status.revision)refuse();
          const next={...editor,deviceId:pending.requesterDeviceId,deviceLabel:pending.requesterDeviceLabel,
            epoch:editor.epoch+1,headRevision:publishedRevision};
          tx.set(ref.editor,next);
          tx.set(ref.marker,{version:1,ownerUid:uid,investorId:iid,projectId:pid,deviceId:next.deviceId,
            deviceLabel:next.deviceLabel,epoch:next.epoch,token:pending.token,revision:publishedRevision,active:true});
        }
        tx.set(ref.request,result);
      });
      const current=await inspect(iid,pid);
      if(!equal(current.request,result))refuse();
      if(decision==='grant')exactGrant(current,result);
      return result;
    },
    async release({status,marker}){
      if(marker?.ownerUid!==uid||marker.deviceId!==deviceId)refuse();
      const {investorId:iid,projectId:pid}=marker,ref=refs(pid,iid);
      const released=releasedQuoteReservation(status,marker);
      await transaction(async tx=>{
        const current=await witness(tx,iid,pid);
        if(equal(current.status,released.status)&&equal(current.marker,released.marker))return;
        if(!equal(current.status,status)||!equal(current.marker,marker))refuse();
        await writeRelease(tx,ref,current,released);
      });
      const current=await inspect(iid,pid);
      if(!equal(current.status,released.status)||!equal(current.marker,released.marker))refuse();
      return released;
    },
    async recover(expected,pinInput,assertCurrent=assertAccess){
      if(expected?.marker?.ownerUid!==uid)refuse();
      const {status,marker,request}=copy(expected);
      const released=releasedQuoteReservation(status,marker),{investorId:iid,projectId:pid}=marker,ref=refs(pid,iid);
      const expectedRequest=request?.token===marker.token?{...request,state:'released'}:request;
      if(request?.token===marker.token&&request.state!=='granted')refuse();
      const after={...released,request:expectedRequest};
      assertCurrent();
      const pinRevision=await pin.verify(pinInput);
      let submitted=false;
      try{
        await transaction(async tx=>{
          const current=await witness(tx,iid,pid);
          if(read(await tx.get(ref.pin))?.revision!==pinRevision)fail('LF_P0B_PIN_CONFLICT');
          assertCurrent();
          if(equal(current,after))return;
          if(!equal(current,{status,marker,request}))refuse();
          await writeRelease(tx,ref,current,released);
          assertCurrent();
          submitted=true;
        });
      }catch(error){
        if(!submitted)throw error;
        // A lost ACK may be resolved only by this exact inactive marker.
        // Never send the release transaction twice.
        let current;
        try{current=await inspect(iid,pid);}catch(_){throw error;}
        if(!equal(current,after))throw error;
        assertCurrent();
        return released;
      }
      const current=await inspect(iid,pid);
      assertCurrent();
      if(!equal(current,after))refuse();
      return released;
    },
  });
}

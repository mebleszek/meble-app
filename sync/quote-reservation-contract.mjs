// Data-only plans and receipt checks. These values never authorize a write;
// the protocol must independently authenticate and read the server witnesses.
import {copy,equal,fail,id,json} from './local-first-values.mjs';
const revision=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const token=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const label=value=>typeof value==='string'&&value.length<=64;
function keys(value,names){return value&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),names.slice().sort());}
function refuse(){fail('LF_QUOTE_RESERVATION_INVALID');}
function editor(value,ownerUid,investorId,projectId){
 const fields=['ownerUid','investorId','projectId','deviceId','deviceLabel','epoch','active','headRevision'];
 if(!keys(value,fields)||value.ownerUid!==ownerUid||value.investorId!==investorId||value.projectId!==projectId
  ||typeof value.active!=='boolean'||!Number.isSafeInteger(value.epoch)||value.epoch<1
  ||!label(value.deviceLabel)||!(value.headRevision===''||revision(value.headRevision)))refuse();
 for(const key of ['ownerUid','investorId','projectId','deviceId'])id(value[key]);
}
export function validateQuoteReservationIntent(row,ownerUid,deviceId){
 json(row);id(row?.investorId);id(row?.projectId);id(ownerUid);id(deviceId);
 if(!keys(row,['key','version','operationId','token','ownerUid','deviceId','deviceLabel','investorId','projectId','mode','pinRevision','expected'])
  ||row.key!=='quote-reservation:'+row.projectId||row.version!==1||row.ownerUid!==ownerUid||row.deviceId!==deviceId
  ||!token(row.operationId)||!token(row.token)||!label(row.deviceLabel)
  ||!keys(row.expected,['editor','revision'])||!revision(row.expected.revision))refuse();
 const e=row.expected.editor;editor(e,ownerUid,row.investorId,row.projectId);
 if(!Number.isSafeInteger(e.epoch+1)||!['free','request','pin'].includes(row.mode)
  ||row.mode==='free'&&(e.active||row.pinRevision!==null)
  ||row.mode!=='free'&&(!e.active||e.deviceId===deviceId)
  ||row.mode==='request'&&row.pinRevision!==null
  ||row.mode==='pin'&&(!Number.isSafeInteger(row.pinRevision)||row.pinRevision<1))refuse();
 return true;
}
export function quoteReservationRequest(intent){
 validateQuoteReservationIntent(intent,intent.ownerUid,intent.deviceId);if(intent.mode!=='request')refuse();
 const e=intent.expected.editor;
 return {ownerUid:intent.ownerUid,investorId:intent.investorId,projectId:intent.projectId,
  requestId:intent.operationId,token:intent.token,requesterDeviceId:intent.deviceId,requesterDeviceLabel:intent.deviceLabel,
  editorDeviceId:e.deviceId,editorEpoch:e.epoch,baseRevision:intent.expected.revision,state:'pending',revision:''};
}
export function validateQuoteReservationRequest(request){
 json(request);
 if(!keys(request,['ownerUid','investorId','projectId','requestId','token','requesterDeviceId','requesterDeviceLabel','editorDeviceId','editorEpoch','baseRevision','state','revision'])
  ||!token(request.requestId)||!token(request.token)||!label(request.requesterDeviceLabel)
  ||!Number.isSafeInteger(request.editorEpoch)||request.editorEpoch<1||!Number.isSafeInteger(request.editorEpoch+1)
  ||request.requesterDeviceId===request.editorDeviceId||!revision(request.baseRevision)
  ||!['pending','declined','cancelled','granted','released'].includes(request.state)
  ||(['granted','released'].includes(request.state)?!revision(request.revision):request.revision!==''))refuse();
 for(const key of ['ownerUid','investorId','projectId','requesterDeviceId','editorDeviceId'])id(request[key]);
 return true;
}
export function quoteReservationEditor(intent,head=intent.expected.revision){
 validateQuoteReservationIntent(intent,intent.ownerUid,intent.deviceId);
 if(!revision(head)||intent.mode!=='request'&&head!==intent.expected.revision)refuse();
 return {...copy(intent.expected.editor),deviceId:intent.deviceId,deviceLabel:intent.deviceLabel,
  epoch:intent.expected.editor.epoch+1,active:true,headRevision:head};
}
export function quoteReservationMarker(intent,head=intent.expected.revision){
 const e=quoteReservationEditor(intent,head);
 return {version:1,ownerUid:e.ownerUid,investorId:e.investorId,projectId:e.projectId,deviceId:e.deviceId,deviceLabel:e.deviceLabel,
  epoch:e.epoch,token:intent.token,revision:head,active:true};
}
export function validateQuoteReservationMarker(marker){
 json(marker);
 if(!keys(marker,['version','ownerUid','investorId','projectId','deviceId','deviceLabel','epoch','token','revision','active'])
  ||marker.version!==1||!Number.isSafeInteger(marker.epoch)||marker.epoch<1||!label(marker.deviceLabel)
  ||!token(marker.token)||!revision(marker.revision)||typeof marker.active!=='boolean')refuse();
 for(const key of ['ownerUid','investorId','projectId','deviceId'])id(marker[key]);return true;
}
export function verifyQuoteReservation(intent,observed,marker,request){
 validateQuoteReservationIntent(intent,intent.ownerUid,intent.deviceId);
 validateQuoteReservationMarker(marker);
 if(!keys(observed,['editor','revision']))refuse();
 let head=intent.expected.revision;
 if(intent.mode==='request'){
  validateQuoteReservationRequest(request);
  const expected=quoteReservationRequest(intent);
  if(request.state!=='granted'||!equal({...request,state:'pending',revision:''},expected))refuse();
  head=request.revision;
 }else if(request!==undefined)refuse();
 const expected={editor:quoteReservationEditor(intent,head),revision:head};
 const expectedMarker=quoteReservationMarker(intent,head);
 if(!equal(observed,expected)||!equal(marker,expectedMarker))fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
 return {status:copy(expected),marker:copy(expectedMarker)};
}
export function releasedQuoteReservation(confirmed,marker){
 const e=confirmed?.editor;
 if(!keys(confirmed,['editor','revision'])||!revision(confirmed.revision)||e?.headRevision!==confirmed.revision)refuse();
 editor(e,e.ownerUid,e.investorId,e.projectId);
 validateQuoteReservationMarker(marker);
 if(!e.active||!marker.active||marker.ownerUid!==e.ownerUid||marker.investorId!==e.investorId||marker.projectId!==e.projectId
  ||marker.deviceId!==e.deviceId||marker.deviceLabel!==e.deviceLabel||marker.epoch!==e.epoch||marker.revision!==confirmed.revision)refuse();
 return {status:{editor:{...copy(e),active:false},revision:confirmed.revision},marker:{...copy(marker),active:false}};
}

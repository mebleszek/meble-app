// Pure administrative plan. No SDK, credentials, logging, IO or writes.
(function(root){
 'use strict';
 const PROJECT='cloud4-project-v1',INVESTOR='cloud4-investor-v1';
 function reject(){throw Error('CLOUD4_ADMIN_STATE_UNEXPECTED');}
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 function plan({uid,grant,appAccess,control}){
  if(typeof uid!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(uid)||!obj(grant)||grant.appEnabled!==true||typeof grant.enabled!=='boolean')reject();
  const keys=['appEnabled','enabled','pilotProjectId','pilotInvestorId','globalDataEnabled','globalSchemaVersion'];
  if(Object.keys(grant).some(k=>!keys.includes(k))||Object.keys(appAccess||{}).join(',')!=='schemaVersion'||appAccess.schemaVersion!==1)reject();
  if(Object.hasOwn(grant,'globalDataEnabled')&&typeof grant.globalDataEnabled!=='boolean')reject();
  if(Object.hasOwn(grant,'globalSchemaVersion')&&grant.globalSchemaVersion!==1)reject();
  for(const [k,v]of [['pilotProjectId',PROJECT],['pilotInvestorId',INVESTOR]])if(Object.hasOwn(grant,k)&&grant[k]!==v)reject();
  const wanted={schemaVersion:1,ownerUid:uid,enabled:true,projectId:PROJECT,investorId:INVESTOR};
  if(control!==null){if(!obj(control)||Object.keys(control).length!==5||Object.keys(wanted).some(k=>k==='enabled'?typeof control[k]!=='boolean':control[k]!==wanted[k]))reject();}
  // Apply only these fields with transaction update/merge and compare the full
  // observed documents again. Never set/replace the existing grant wholesale.
  return {grantPatch:{enabled:true,pilotProjectId:PROJECT,pilotInvestorId:INVESTOR},control:wanted,
   expectedGrant:JSON.parse(JSON.stringify(grant)),expectedControl:control===null?null:JSON.parse(JSON.stringify(control)),
   stopControlPatch:{enabled:false},stopGrantPatch:{enabled:false}};
 }
 const api={plan};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CLOUD4AdminPlan=api;
})(globalThis);

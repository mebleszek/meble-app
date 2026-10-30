'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./project-selective-export-smoke');
const r=fixture();assert.equal(r.FC.session.begin('kuchnia'),true);const durable=r.storage.getItem('fc_edit_session_v1');
// Simulate switching a freshly booted adapter to its IDB image. Only persisted
// bytes may establish proof, never the presence of a matching project in RAM.
const fresh=fixture();fresh.storage.rows.set('fc_edit_session_v1',durable);const before=fresh.rows();
assert.equal(fresh.FC.session.resumeFromStorage(),true);assert.deepEqual(fresh.rows(),before);assert.equal(fresh.FC.session.canSaveProject(),true);
assert.equal(fresh.FC.session.resumeFromStorage(),false,'An active session cannot be replaced');
for(const corrupt of [null,'{',JSON.stringify({...JSON.parse(durable),expectedOwnerKnown:false})]){
 const bad=fixture();if(corrupt!==null)bad.storage.rows.set('fc_edit_session_v1',corrupt);const source=bad.rows();
 assert.equal(bad.FC.session.resumeFromStorage(),false);assert.deepEqual(bad.rows(),source,'Missing proof must never be repaired or deleted');
}
console.log('PASS adapter resume reuses valid durable session proof; missing/corrupt proof and active replacement refuse without writes');

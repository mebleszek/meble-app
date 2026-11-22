import {equal,fail} from './local-first-values.mjs';
// Caller serializes this with opening/closing visits. No project unlock API.
export async function closeIdleApplicationVisits({authority,protocol,deviceId,assertAccess,sessionActive}){
 const rows=authority.rows(),ui=JSON.parse(rows.fc_ui_v1||'null'),draft=JSON.parse(rows.fc_edit_session_v1||'null');
 if(!ui||!['home','modeHub','investorsList'].includes(ui.entry)||draft?.active||sessionActive())return false;
 authority.assertIdle();
 for(const record of await protocol.listInvestors()){
  const own=record.visits?.[deviceId];if(!own||record.deletionId)continue;
  assertAccess();authority.assertIdle();
  if(sessionActive()||!equal(authority.rows(),rows))fail('LF_ACTIVE_RAM_PROTECTED');
  await protocol.closeInvestor(record.investorId,own.token);
 }
 return true;
}

// Candidate adapter for an application image with no synced replicas in the
// removed scopes. The native checkpoint refuses any matching replica/outbox.
import {fail} from '../../sync/local-first-values.mjs';

export async function applyP0BTombstone({protocol,intent,store,planLocal,assertAccess}) {
  const receipt=await protocol.confirmDeletion(intent);
  const ids=receipt.investorIds||[receipt.investorId];
  const tombstones=await Promise.all(ids.map(protocol.investor));
  if(tombstones.some(record=>record?.deletionId!==receipt.operationId))
    fail('LF_P0B_ACK_UNCONFIRMED');
  return store.exclusive(async()=>{
    assertAccess();
    const before=await store.readApplication();
    const rows=before.rows;
    if(rows.fc_edit_session_v1!==null) fail('LF_ACTIVE_RAM_PROTECTED');
    const current=JSON.parse(rows.fc_investors_v1||'[]');
    if(ids.some(iid=>!current.some(record=>record.id===iid))) fail('LF_P0B_LOCAL_INVENTORY_REQUIRED');
    const projects=JSON.parse(rows.fc_projects_v1||'[]').filter(record=>ids.includes(record.investorId));
    const known=new Set(tombstones.flatMap(record=>Object.keys(record.projects)));
    if(projects.some(project=>!Object.hasOwn(tombstones.find(record=>record.investorId===project.investorId).projects,project.id)))
      fail('LF_P0B_LOCAL_INVENTORY_REQUIRED');
    const plan=planLocal(rows,ids);
    // Include all selections in the existing scoped replica and outbox guard.
    await store.checkpointDeletion({before:rows,application:{rows:plan.after,expectedVersion:before.version},
      scopes:[...known],investorIds:ids,assertAccess});
    return receipt;
  });
}

import {fail} from './local-first-values.mjs';

const productionWitness={
 pixelHash:'c73af3f12d2a81fa6007f067079f8f1f808fe1088d9929de24c421fdc90b1429',
 pixelCount:239,
 previousRevision:'584e3db3f8d04eb48445526b6d4f8043',
 previousHash:'2fee1752e2db9cb497b0ed4c5ce4a7799f15ea82a7f464e351eb91e292601714',
 previousCount:171
};

// Temporary first-connection gate. The existing outbox publishes a child
// revision using the verified remote head as CAS base.
export async function planFirstCatalogSync({remote,image,boot,contract,ownerUid},witness=productionWitness){
 const {pixelHash,pixelCount,previousRevision,previousHash,previousCount}=witness;
 if(!remote)fail('LF_FIRST_CATALOG_REMOTE_REQUIRED');
 const head=remote.head;
 if(head.ownerUid!==ownerUid)fail('LF_FIRST_CATALOG_OWNER_CHANGED');
 const parent=remote.parent;
 const published=head.generation===2&&head.directoryHash===pixelHash&&head.recordCount===pixelCount&&
  parent?.generation===1&&parent.revisionId===previousRevision&&parent.directoryHash===previousHash;
 if(boot.fresh&&!boot.restored&&!image){
  if(!published)fail('LF_FIRST_CATALOG_PIXEL_REQUIRED');
  return {action:'receive'};
 }
 if(!boot.restored||!image)fail('LF_FIRST_CATALOG_SOURCE_UNVERIFIED');
 const rows=image.rows;
 const model=contract.capture({getItem:key=>rows[key]??null},Object.keys(contract.schemas)).model;
 contract.validateBundle(model);
 const packed=await contract.pack(ownerUid,model);
 if(packed.directoryHash!==pixelHash||packed.records.length!==pixelCount)fail('LF_FIRST_CATALOG_SOURCE_CHANGED');
 if(published)return {action:'bind'};
 if(head.generation!==1||head.revisionId!==previousRevision||head.directoryHash!==previousHash||head.recordCount!==previousCount)
  fail('LF_FIRST_CATALOG_BASE_CHANGED');
 for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1']){
  const records=JSON.parse(rows[key]??'[]');
  if(!Array.isArray(records)||records.length)fail('LF_FIRST_CATALOG_LOCAL_BUSINESS_DATA');
 }
 if(rows.fc_edit_session_v1!=null)fail('LF_FIRST_CATALOG_ACTIVE_SESSION');
 return {action:'publish',model};
}

import {copy,assertEmulator,fail,id} from './local-first-values.mjs';
export const P0B_REGISTRY='p0b-rooms-v1';
const names={localFirstInvestors:'p0bRoomInvestors',localFirstProjects:'p0bRoomProjects',localFirstEditors:'p0bRoomEditors',p0bDeletionGroups:'p0bRoomGroups',p0bSettings:'p0bSettings'};
export function p0bConnection(connection){
 assertEmulator(connection);
 const f=connection.firestore;
 const path=parts=>parts[0]==='users'&&names[parts[2]]?parts.map((v,i)=>i===2?names[v]:v):parts;
 return {...connection,firestore:{...f,doc:(db,...parts)=>f.doc(db,...path(parts)),collection:(db,...parts)=>f.collection(db,...path(parts))}};
}
export function emptyP0BBusiness(rows){
 const next=copy(rows);
 for(const key of ['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1'])next[key]='[]';
 for(const key of ['fc_project_v1','fc_edit_session_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1'])next[key]=null;
 // Legacy slots stay in the preserved source, not in the new active project image.
 for(const key of Object.keys(next))if(/^fc_project_inv_.+_v1$/.test(key)||/^fc_(?:project|investors)_backup(?:_meta)?_v1$/.test(key))next[key]=null;
 return next;
}
export function p0bContact(value){
 const {rooms,...contact}=copy(value);id(contact.id);
 return contact;
}

import {mapP0BConnection} from './firebase-activation.mjs';
import {copy,fail,id} from './local-first-values.mjs';
export const P0B_REGISTRY='p0b-rooms-v1';
export const p0bConnection=mapP0BConnection;
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

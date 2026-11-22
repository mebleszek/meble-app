// Stable read-only UI subscriptions across replacement of authorized SDK sessions.
const instances=new WeakMap();
const revoked=error=>/^(AUTH_|LF_AUTH_|LF_CLOSED$|LF_SYNC_ACCESS_UNCONFIRMED$|LF_SYNC_ACCESS_DENIED$)/.test(error?.code||error?.message||'');
export function applicationPresence(fc){
 if(instances.has(fc))return instances.get(fc);
 let protocol=null;const subscriptions=new Set();
 function stop(row){row.generation++;row.watch?.close();row.watch=null;}
 function start(row){
  stop(row);const generation=row.generation;
  if(!protocol){row.receive({state:'unconfirmed'});return;}
  try{row.watch=protocol.watchPresence(row.iid,row.online,value=>{
   if(subscriptions.has(row)&&generation===row.generation)row.receive(value);
  });}catch(error){if(!revoked(error))throw error;row.receive({state:'unconfirmed'});}
 }
 const api=Object.freeze({
  bind(next){if(protocol===next)return false;protocol=next;for(const row of subscriptions)start(row);return true;},
  detach(expected){if(protocol!==expected)return;protocol=null;for(const row of subscriptions)start(row);},
  refresh(){for(const row of subscriptions)start(row);},
  watchPresence(iid,online,receive){
   const row={iid,online,receive,generation:0,watch:null};subscriptions.add(row);
   try{start(row);}catch(error){subscriptions.delete(row);stop(row);throw error;}
   return {refresh(){if(!subscriptions.has(row))return;
    if(!row.watch){start(row);return;}
    try{row.watch.refresh();}catch(error){if(!revoked(error))throw error;stop(row);receive({state:'unconfirmed'});}
   },close(){if(!subscriptions.delete(row))return;stop(row);}};
  }
 });
 instances.set(fc,api);return api;
}

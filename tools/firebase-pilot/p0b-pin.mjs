import {equal,fail} from '../../sync/local-first-values.mjs';

// The owner can read this verifier. It is a confirmation in the standard UI.
const format=1, rounds=600000;
const isPin=value=>typeof value==='string'&&/^[0-9]{4}$/.test(value);
const hex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
async function derive(pin,salt){
  if(!isPin(pin))fail('LF_P0B_PIN_INVALID');
  const bytes=new TextEncoder().encode(pin);
  try {
    const key=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveBits']);
    const verifier=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:rounds,salt},key,256);
    return hex(new Uint8Array(verifier));
  }finally{bytes.fill(0);}
}
function valid(record){
  return record?.format===format&&Number.isSafeInteger(record.revision)&&record.revision>0
    &&/^[a-f0-9]{32}$/.test(record.salt)&&/^[a-f0-9]{64}$/.test(record.verifier);
}
async function check(record,pin){
  if(!valid(record))fail('LF_P0B_PIN_RECORD_INVALID');
  const salt=Uint8Array.from(record.salt.match(/../g),byte=>parseInt(byte,16));
  if(await derive(pin,salt)!==record.verifier)fail('LF_P0B_PIN_INCORRECT');
}
export function createP0BPin({ref,readServer,transaction,read}){
  return Object.freeze({
    async status(){
      const record=await readServer(ref);
      if(record&&!valid(record))fail('LF_P0B_PIN_RECORD_INVALID');
      return {configured:!!record,revision:record?.revision||0};
    },
    async verify(pin){
      const record=await readServer(ref);
      if(!record)fail('LF_P0B_PIN_REQUIRED');
      await check(record,pin);
      return record.revision;
    },
    async save({currentPin,newPin,confirmation,expectedRevision}){
      if(!isPin(newPin)||newPin!==confirmation)fail('LF_P0B_PIN_INVALID');
      const before=await readServer(ref);
      if((before?.revision||0)!==expectedRevision)fail('LF_P0B_PIN_CONFLICT');
      if(before)await check(before,currentPin);
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const next={format,revision:expectedRevision+1,salt:hex(salt),verifier:await derive(newPin,salt)};
      await transaction(async tx=>{
        if(!equal(read(await tx.get(ref)),before))fail('LF_P0B_PIN_CONFLICT');
        tx.set(ref,next);
      });
      if(!equal(await readServer(ref),next))fail('LF_P0B_ACK_UNCONFIRMED');
      return {configured:true,revision:next.revision};
    }
  });
}

// Isolated LOCAL-FIRST contracts. No application registration or credentials.
export const copy = value => structuredClone(value);
export function fail(code) { throw Object.assign(Error(code), {code}); }
export const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export const equal = (a, b) => canonical(a) === canonical(b);
export function id(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('LF_ID_INVALID'); return value; }
export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export function json(value) {
  // Refuse unsupported values rather than silently losing fields through JSON.
  const ancestors=new Set();
  function check(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if(v&&typeof v==='object'){if(ancestors.has(v))fail('LF_VALUE_INVALID');ancestors.add(v);}
    if (Array.isArray(v)) { for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('LF_VALUE_INVALID');check(v[i]);}ancestors.delete(v);return; }
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      for (const [key, item] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('LF_VALUE_INVALID');
        check(item);
      }
      ancestors.delete(v);return;
    }
    fail('LF_VALUE_INVALID');
  }
  check(value); return canonical(value);
}
export function assertEmulator(connection) {
  const {db, auth, session} = connection || {}, native = db?._delegate || db;
  if (db?.app?.options?.projectId !== 'demo-meble-app' || native?._databaseId?.projectId !== 'demo-meble-app'
    || native?._databaseId?.database !== '(default)' || native?._settings?.host !== '127.0.0.1:18080'
    || native?._settings?.ssl !== false || auth?.app !== db.app || auth?.emulatorConfig?.host !== '127.0.0.1'
    || auth.emulatorConfig.port !== 19099 || auth.emulatorConfig.protocol !== 'http') fail('LF_EMULATOR_REQUIRED');
  const who = session.identity(); id(who.uid);
  if (auth.currentUser?.uid !== who.uid || !Number.isSafeInteger(who.epoch)
    || !auth.currentUser.providerData?.some(p => p.providerId === 'google.com')) fail('LF_AUTH_INVALID');
  return who;
}
export const safeError = error => {const code=error?.code||error?.message;return {ok:false,code:/^(LF_|GLOBAL_|CLOUD_)[A-Z_]+$/.test(code||'')?code:'LF_REMOTE_UNCONFIRMED'};};

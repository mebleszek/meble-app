// Explicit private credentials only; no ADC, environment fallback or token persistence.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import pilot from './cloud42-package.js';
import contract from './cloud46d-contract.js';
import fixture from '../cloud4-pilot-readiness-smoke.js';
import authority from './cloud46e-authority.js';
const fail = code => { throw Error('CLOUD46E_' + code); };
export function assertContextSet({writer, reader, adminDb, stopVerifierDb}, uid, databases) {
  const clients = [writer, reader], contexts = clients.map(c => c?.authSession?.verificationContext());
  if (new Set([contexts[0]?.app, contexts[1]?.app, adminDb, stopVerifierDb]).size !== 4
    || !adminDb || !stopVerifierDb || contexts.some(ctx => !ctx?.app || ctx.auth?.app !== ctx.app)
    || new Set(contexts.map(ctx => ctx.auth)).size !== 2) fail('FOUR_CONTEXTS_REQUIRED');
  if (!Array.isArray(databases) || databases.length !== 2) fail('FOUR_CONTEXTS_REQUIRED');
  clients.forEach((c, i) => contract.assertLiveSession(c, databases[i], uid, c.authSession.identity()));
  contract.assertAdmin(adminDb); contract.assertAdmin(stopVerifierDb);
}
function checkPrivate(credentials, runtimeDirectory, keys) {
  const repo = path.resolve(new URL('../..', import.meta.url).pathname);
  if (!path.isAbsolute(runtimeDirectory || '') || runtimeDirectory === repo || runtimeDirectory.startsWith(repo + path.sep)
    || !credentials || !keys.every(k => typeof credentials[k] === 'string' && credentials[k].length > 20)
    || !Number.isFinite(credentials.expiresAt) || credentials.expiresAt <= Date.now() + 60000
    || credentials.expiresAt > Date.now() + 3600000) fail('PRIVATE_CREDENTIALS_REQUIRED');
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) fail('LIVE_EMULATORS_REFUSED');
}
export const checkCredentials = (c, directory) => checkPrivate(c, directory,
  ['writerGoogleIdToken', 'readerGoogleIdToken', 'stopAccessToken', 'verifierAccessToken', 'rulesAccessToken']);
export const checkRecoveryCredentials = (c, directory) => checkPrivate(c, directory, ['stopAccessToken', 'verifierAccessToken']);
async function connectRoles({credentials, runtimeDirectory, firebaseConfig, contexts, uid}, recovery) {
  credentials = structuredClone(credentials); firebaseConfig = structuredClone(firebaseConfig); contexts = structuredClone(contexts);
  (recovery ? checkRecoveryCredentials : checkCredentials)(credentials, runtimeDirectory);
  if (firebaseConfig?.projectId !== contract.TARGET.projectId || firebaseConfig?.authDomain !== pilot.PRODUCTION.authDomain
    || firebaseConfig?.appId !== pilot.PRODUCTION.appId || typeof firebaseConfig?.apiKey !== 'string' || !firebaseConfig.apiKey) fail('FIREBASE_CONFIG_MISMATCH');
  const privateRequire = createRequire(path.join(runtimeDirectory, 'operator-runtime.cjs'));
  // These dependencies are installed in the private operator environment, never the app/Pages.
  let Firestore, OAuth2Client;
  try {
    ({Firestore} = privateRequire('@google-cloud/firestore'));
    ({OAuth2Client} = privateRequire('google-auth-library'));
    if (privateRequire('@google-cloud/firestore/package.json').version !== '7.11.0'
      || privateRequire('google-auth-library/package.json').version !== '9.15.1') fail('PRIVATE_RUNTIME_VERSION_MISMATCH');
  } catch (e) { if (e.message === 'CLOUD46E_PRIVATE_RUNTIME_VERSION_MISMATCH') throw e; fail('PRIVATE_BACKEND_SDK_UNAVAILABLE'); }
  let app, auth, firestore;
  try { [app, auth, firestore] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]); }
  catch (_) { fail('FIREBASE_WEB_SDK_UNAVAILABLE'); }
  const resources = [], clients = [], principals = [];
  async function oauth(token, email) {
    const credential = new OAuth2Client();
    credential.setCredentials({access_token: token, expiry_date: credentials.expiresAt});
    // Force authenticated identity in the future authorized environment; never trust a JSON email.
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {redirect: 'error',
      headers: {authorization: 'Bearer ' + token}, signal: AbortSignal.timeout(8000)});
    if (response.status !== 200) fail('OAUTH_IDENTITY_UNCONFIRMED');
    const who = await response.json();
    if (who.email !== email || who.verified_email !== true) fail('OAUTH_IDENTITY_MISMATCH');
    principals.push(credential); return credential;
  }
  async function googleClient(role, access) {
      const r = fixture.source();
      for (const file of ['cloud-pilot-contract', 'firebase-pilot-transport', 'cloud-auth', 'cloud-access-verifier', 'auth-access-gate']) {
        new Function('window', fs.readFileSync(new URL('../../js/app/cloud/' + file + '.js', import.meta.url), 'utf8'))(r.s);
      }
      const session = await r.s.FC.cloudAuth.create({target: 'live-auth', appName: contexts[role].id, firebaseConfig,
        sdk: {app, auth: {...auth, indexedDBLocalPersistence: auth.inMemoryPersistence, browserLocalPersistence: auth.inMemoryPersistence}}});
      resources.push(() => session.close());
      const ctxApp = app.getApp(contexts[role].id), nativeAuth = auth.getAuth(ctxApp);
      await auth.signInWithCredential(nativeAuth, auth.GoogleAuthProvider.credential(credentials[role + 'GoogleIdToken']));
      const user = nativeAuth.currentUser, token = await user.getIdTokenResult(true);
      if (user.uid !== uid || user.email !== contexts[role].email || !user.emailVerified
        || token.claims.aud !== contract.TARGET.projectId || token.claims.iss !== 'https://securetoken.google.com/' + contract.TARGET.projectId
        || token.signInProvider !== 'google.com') fail('GOOGLE_SESSION_MISMATCH');
      if (!access) {
        const db = firestore.initializeFirestore(ctxApp, {localCache: firestore.memoryLocalCache()});
        contract.assertLiveDb(db);
        resources.push(() => firestore.terminate(db)); return {authSession: session, db};
      }
      const verifier = r.s.FC.cloudAccessVerifier.create(session, {sdk: firestore});
      resources.push(() => verifier.close());
      let gate, lease;
      resources.push(() => gate?.close());
      await new Promise((resolve, reject) => {
        gate = r.s.FC.authAccessGate.create(session, {verifyAccess: verifier.verify, watchAccess: verifier.watch,
          onAuthorized: value => { lease = value; resolve(); },
          onState: state => { if (['error', 'unapproved', 'revoked'].includes(state.status)) reject(Error('CLOUD46E_ACCESS_UNCONFIRMED')); }});
      });
      return {authSession: session, lease};
  }
  try {
    const admins = [];
    for (const role of ['stop', 'verifier']) {
      const authClient = await oauth(credentials[role + 'AccessToken'], contexts[role].email);
      const db = new Firestore({projectId: contract.TARGET.projectId, databaseId: '(default)',
        host: 'firestore.googleapis.com', ssl: true, authClient});
      contract.assertAdmin(db); admins.push(db); resources.push(() => db.terminate());
    }
    const rulesCredential = recovery ? null : await oauth(credentials.rulesAccessToken, contexts.stop.email);
    if (!recovery) for (const role of ['writer', 'reader']) clients.push(await googleClient(role, true));
    if (!recovery) assertContextSet({writer: clients[0], reader: clients[1], adminDb: admins[0], stopVerifierDb: admins[1]},
      uid, clients.map(c => firestore.getFirestore(c.authSession.verificationContext().app)));
    const assertCredentials = () => {
      if (Date.now() >= credentials.expiresAt) fail('CREDENTIALS_EXPIRED');
      for (const client of clients) client.lease.assert();
    };
    return {options: {uid, writer: clients[0], reader: clients[1], adminDb: admins[0], stopVerifierDb: admins[1]},
      adminDb: admins[0], stopVerifierDb: admins[1],
      async verifyDenied() {
        if (!recovery) fail('RECOVERY_CONTEXT_REQUIRED');
        // Reader Auth is opened only AFTER the independent administrator has applied STOP.
        const client = await googleClient('reader', false), db = client.db, identity = client.authSession.identity();
        function assertReader() {
          contract.assertLiveDb(db);
          const who = client.authSession.identity(), ctx = client.authSession.verificationContext();
          if (who.uid !== uid || who.epoch !== identity.epoch || ctx.auth.currentUser?.uid !== uid) fail('STOP_READER_IDENTITY_CHANGED');
        }
        assertReader();
        try {
          await firestore.runTransaction(db, tx => tx.get(firestore.doc(db, 'users', uid, 'pilotProjects', 'cloud4-project-v1')), {maxAttempts: 1});
          return false;
        } catch (error) { assertReader(); if (error.code !== 'permission-denied') fail('DENIAL_UNCONFIRMED'); return true; }
      },
      firestore, rulesCredential, assertCredentials,
      async close() { for (const release of resources.reverse()) await release(); }};
  } catch (error) {
    for (const release of resources.reverse()) { try { await release(); } catch (_) {} }
    if (/^CLOUD46[DE]_[A-Z_]+$/.test(error?.message || '')) throw error;
    fail('NATIVE_CONNECTION_UNCONFIRMED'); // Never log SDK errors containing URLs/tokens.
  }
}
export function connectNative(input) {
  const b = authority.assertCapability(input?.capability, 'cycle');
  return connectRoles({...input, contexts: b.contexts, uid: b.intent.uid}, false);
}
export function connectRecoveryNative(input) {
  const b = authority.assertCapability(input?.capability, 'recover-stop');
  return connectRoles({...input, contexts: b.contexts, uid: b.intent.uid}, true);
}

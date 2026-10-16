// OFF by default. Used ONLY by auth-test.html, never by index.html.
// Copy these FOUR public Web config fields from Firebase Console > Project
// settings > General > Your apps > Web app > SDK setup > Config.
// Do not paste service-account JSON, tokens, ORS keys or other credentials.
window.FC_AUTH_TEST_OPTIONS = null;
// Replace null, only in a deliberately configured test environment, with:
// { target: 'live-auth', firebaseConfig: {
//   apiKey: 'COPY_FROM_CONSOLE',
//   authDomain: 'COPY_FROM_CONSOLE',
//   projectId: 'mebleszek-meble-app',
//   appId: 'COPY_FROM_CONSOLE'
// } }
// No Firestore is created; its production deny-all Rules remain unchanged.

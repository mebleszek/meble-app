// Public Web config supplied from Firebase Console, reused by the main login.
// Google sign-in does not grant access without a fresh server authorization.
// To disable new Auth initialization, set FC_AUTH_TEST_OPTIONS to null and bump
// this script's version in index.html. This does not sign out existing users.
// Never add service-account JSON, tokens, ORS keys or private credentials.
window.FC_AUTH_TEST_OPTIONS = {
  target: 'live-auth',
  firebaseConfig: {
    apiKey: 'AIzaSyDv89lIX2ZLUJwwO1dMxvQuNU17zNMxqUQ',
    authDomain: 'mebleszek-meble-app.firebaseapp.com',
    projectId: 'mebleszek-meble-app',
    appId: '1:447820686604:web:6bc0817aa365b1b613d529'
  }
};
// No Firestore is created; its production deny-all Rules remain unchanged.

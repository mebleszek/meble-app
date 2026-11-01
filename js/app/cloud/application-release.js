// Inactive deployment slot. Populate only after a separate owner authorization.
// Public SPKI/signature may be published; never publish a private signing key.
// The fingerprint must be independently confirmed, not copied from an envelope.
window.FC_APPLICATION_RELEASE=Object.freeze({trustedKeySha256:null,envelope:null});

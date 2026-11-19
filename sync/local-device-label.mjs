import {fail,id} from './local-first-values.mjs';

export function createLocalDeviceLabel({storage, deviceId, assertAccess}) {
  const key = 'meble-device-label-v1:' + id(deviceId);
  return Object.freeze({
    read() {
      assertAccess();
      return storage.getItem(key) || '';
    },
    write(value) {
      assertAccess();
      if (typeof value !== 'string' || value.length > 64 || /[\x00-\x1f\x7f]/.test(value))
        fail('LF_DEVICE_LABEL_INVALID');
      const label = value.trim();
      if (label) storage.setItem(key,label);
      else storage.removeItem(key);
      if ((storage.getItem(key) || '') !== label) fail('LF_LOCAL_ACK_UNCONFIRMED');
      return label;
    }
  });
}

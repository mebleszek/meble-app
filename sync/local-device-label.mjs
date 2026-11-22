import {fail,id} from './local-first-values.mjs';

export function defaultDeviceLabel(navigator={}) {
 const ua=String(navigator.userAgent||''),platform=String(navigator.userAgentData?.platform||navigator.platform||'');
 const brands=(navigator.userAgentData?.brands||[]).map(row=>String(row.brand));
 const browser=navigator.brave?.isBrave||brands.includes('Brave')?'Brave':/Edg\//.test(ua)||brands.includes('Microsoft Edge')?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)||brands.includes('Google Chrome')?'Chrome':/Safari\//.test(ua)&&/Version\//.test(ua)?'Safari':brands.includes('Chromium')?'Chromium':'Przeglądarka';
 const android=/Android/i.test(platform+' '+ua),mobile=navigator.userAgentData?.mobile===true||/Mobi|iPhone/i.test(ua);
 const device=android?(mobile?'Telefon Android':'Tablet Android'):/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)||(/Mac/.test(platform)&&navigator.maxTouchPoints>1)?'iPad':/Win/i.test(platform+' '+ua)?'Komputer Windows':/Mac/i.test(platform+' '+ua)?'Komputer macOS':/Linux/i.test(platform+' '+ua)?'Komputer Linux':'Urządzenie';
 return device+' – '+browser;
}
export function createLocalDeviceLabel({storage, deviceId, assertAccess, navigator}) {
  const key = 'meble-device-label-v1:' + id(deviceId);
  return Object.freeze({
    read() {
      assertAccess();
      return storage.getItem(key) || '';
    },
    display() { return this.read() || defaultDeviceLabel(navigator); },
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

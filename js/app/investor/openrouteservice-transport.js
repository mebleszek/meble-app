// js/app/investor/openrouteservice-transport.js
// Darmowe przeliczanie trasy OpenRouteService/OpenStreetMap. Bez klucza zaszytego w kodzie.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const ORS_GEOCODE_URL = 'https://api.openrouteservice.org/geocode/search';
  const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/';
  const PROVIDER = 'openrouteservice';
  const SOURCE_LABEL = 'OpenRouteService';

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function normalizeAddress(value){
    return text(value).replace(/\s+/g, ' ');
  }
  function stableHash(value){
    const str = normalizeAddress(value).toLowerCase();
    let hash = 2166136261;
    for(let i = 0; i < str.length; i += 1){
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }
  function routeAddressHash(origin, destination){
    const o = normalizeAddress(origin);
    const d = normalizeAddress(destination);
    return o && d ? `${stableHash(o)}:${stableHash(d)}` : '';
  }
  function isResultStale(transport, origin, destination){
    const src = transport && typeof transport === 'object' ? transport : {};
    const savedHash = text(src.addressHash || src.routeAddressHash || '');
    const currentHash = routeAddressHash(origin, destination);
    if(!savedHash || !currentHash) return false;
    return savedHash !== currentHash;
  }
  function resultStatusLabel(status, stale){
    if(stale) return 'wynik może być nieaktualny';
    const s = text(status || '');
    if(s === 'success') return 'aktualny';
    if(s === 'manual') return 'ręcznie';
    if(s === 'missing_api_key') return 'brak klucza ORS';
    if(s === 'missing_company_address') return 'brak adresu firmy';
    if(s === 'missing_client_address') return 'brak adresu klienta';
    if(s === 'error') return 'błąd przeliczenia';
    return 'nieprzeliczona';
  }
  function validateRouteInput(opts){
    const input = opts && typeof opts === 'object' ? opts : {};
    const apiKey = text(input.apiKey);
    const origin = normalizeAddress(input.origin);
    const destination = normalizeAddress(input.destination);
    if(!apiKey) return { ok:false, status:'missing_api_key', message:'Wpisz własny darmowy klucz OpenRouteService w trybiku: Dane firmy i transport. Ręczne kilometry nadal możesz wpisać bez klucza.' };
    if(!origin) return { ok:false, status:'missing_company_address', message:'Uzupełnij adres firmy w trybiku: Dane firmy i transport.' };
    if(!destination) return { ok:false, status:'missing_client_address', message:'Uzupełnij adres klienta przy inwestorze.' };
    return { ok:true, status:'ready', apiKey, origin, destination };
  }
  function apiErrorText(prefix, response, json){
    const code = response && response.status ? ` (${response.status})` : '';
    const bodyMessage = text(json && (json.error && (json.error.message || json.error) || json.message));
    return `${prefix}${code}${bodyMessage ? ': ' + bodyMessage : ''}`;
  }
  async function readJson(response){
    try{ return await response.json(); }catch(_){ return null; }
  }
  async function geocode(query, apiKey, options){
    const opts = options || {};
    const fetchImpl = opts.fetchImpl || root.fetch;
    if(typeof fetchImpl !== 'function') throw new Error('Brak połączenia albo fetch API w przeglądarce. Wpisz kilometry ręcznie albo spróbuj później.');
    const url = ORS_GEOCODE_URL + '?' + new URLSearchParams({ text:normalizeAddress(query), size:'1' }).toString();
    let response;
    try{ response = await fetchImpl(url, { headers:{ Authorization:apiKey } }); }
    catch(_){ throw new Error('Nie udało się połączyć z OpenRouteService. Sprawdź internet albo wpisz kilometry ręcznie.'); }
    const json = await readJson(response);
    if(!response || !response.ok) throw new Error(apiErrorText('Nie udało się odczytać adresu', response, json));
    const feature = json && Array.isArray(json.features) ? json.features[0] : null;
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    if(!Array.isArray(coords) || coords.length < 2) throw new Error('OpenRouteService nie znalazł adresu: ' + normalizeAddress(query));
    return [num(coords[0], 0), num(coords[1], 0)];
  }
  async function route(originCoords, destCoords, apiKey, profile, options){
    const opts = options || {};
    const fetchImpl = opts.fetchImpl || root.fetch;
    if(typeof fetchImpl !== 'function') throw new Error('Brak połączenia albo fetch API w przeglądarce. Wpisz kilometry ręcznie albo spróbuj później.');
    let response;
    try{
      response = await fetchImpl(ORS_DIRECTIONS_URL + encodeURIComponent(text(profile) || 'driving-car'), {
        method:'POST',
        headers:{ Authorization:apiKey, 'Content-Type':'application/json' },
        body:JSON.stringify({ coordinates:[originCoords, destCoords] })
      });
    }catch(_){
      throw new Error('Nie udało się połączyć z OpenRouteService. Sprawdź internet albo wpisz kilometry ręcznie.');
    }
    const json = await readJson(response);
    if(!response || !response.ok) throw new Error(apiErrorText('Nie udało się przeliczyć trasy', response, json));
    const summary = json && json.routes && json.routes[0] && json.routes[0].summary;
    if(!summary) throw new Error('OpenRouteService nie zwrócił podsumowania trasy. Wpisz kilometry ręcznie albo spróbuj ponownie.');
    const distanceKm = Math.round((num(summary.distance, 0) / 1000) * 10) / 10;
    const durationMin = Math.round(num(summary.duration, 0) / 60);
    return { distanceKm, durationMin };
  }
  async function calculateRoute(input, options){
    const opts = options || {};
    const validation = validateRouteInput(input || {});
    if(!validation.ok){
      const err = new Error(validation.message);
      err.status = validation.status;
      throw err;
    }
    const profile = text(input.profile || 'driving-car') || 'driving-car';
    const origin = normalizeAddress(validation.origin);
    const destination = normalizeAddress(validation.destination);
    const originCoords = await geocode(origin, validation.apiKey, opts);
    const destinationCoords = await geocode(destination, validation.apiKey, opts);
    const routeResult = await route(originCoords, destinationCoords, validation.apiKey, profile, opts);
    return {
      distanceKm:routeResult.distanceKm,
      durationMin:routeResult.durationMin,
      source:SOURCE_LABEL,
      provider:PROVIDER,
      status:'success',
      calculatedAt:text(opts.now) || new Date().toISOString(),
      origin,
      destination,
      routeProfile:profile,
      originHash:stableHash(origin),
      destinationHash:stableHash(destination),
      addressHash:routeAddressHash(origin, destination),
      lastError:''
    };
  }

  FC.openRouteServiceTransport = {
    ORS_GEOCODE_URL,
    ORS_DIRECTIONS_URL,
    PROVIDER,
    SOURCE_LABEL,
    normalizeAddress,
    stableHash,
    routeAddressHash,
    isResultStale,
    resultStatusLabel,
    validateRouteInput,
    geocode,
    route,
    calculateRoute
  };
})();

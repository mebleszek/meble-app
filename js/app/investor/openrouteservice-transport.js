// js/app/investor/openrouteservice-transport.js
// Darmowe przeliczanie trasy OpenRouteService/OpenStreetMap. Bez klucza zaszytego w kodzie.
// Moduł jest samodzielny i mockowalny: testy nie wykonują realnych zapytań do ORS.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const ORS_GEOCODE_URL = 'https://api.openrouteservice.org/geocode/search';
  const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/';
  const ORS_MAPS_URL = 'https://maps.openrouteservice.org/directions';
  const PROVIDER = 'openrouteservice';
  const SOURCE_LABEL = 'OpenRouteService';

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function normalizeAddress(value){
    return text(value)
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,+/g, ',')
      .replace(/^,|,$/g, '')
      .trim();
  }
  function prepareGeocodeQuery(value){
    // W polskich adresach użytkownik często wpisuje lokal/mieszkanie: "28/88", "28 m 88", "lok. 88".
    // ORS potrafi wtedy złapać słaby punkt albo wynik przybliżony. Do geokodowania używamy wejścia bez lokalu,
    // ale w danych nadal zapisujemy oryginalny adres inwestora i firmy.
    let out = normalizeAddress(value);
    out = out.replace(/\b(ul\.|ulica)\s+/ig, '');
    out = out.replace(/\b(m|m\.|lok|lok\.|lokal|apt|apartment)\s*\d+[a-z]?\b/ig, '');
    out = out.replace(/\b(\d+[a-z]?)\s*\/\s*\d+[a-z]?\b/ig, '$1');
    out = out.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/^,|,$/g, '').trim();
    return normalizeAddress(out || value);
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
  function geocodeMeta(query, feature){
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    const props = feature && feature.properties && typeof feature.properties === 'object' ? feature.properties : {};
    return {
      query:normalizeAddress(query),
      label:text(props.label || props.name || ''),
      name:text(props.name || ''),
      layer:text(props.layer || ''),
      source:text(props.source || ''),
      confidence:props.confidence == null ? '' : String(props.confidence),
      accuracy:text(props.accuracy || props.match_type || ''),
      coordinates:Array.isArray(coords) && coords.length >= 2 ? [num(coords[0], 0), num(coords[1], 0)] : [],
      lon:Array.isArray(coords) && coords.length >= 2 ? String(num(coords[0], 0)) : '',
      lat:Array.isArray(coords) && coords.length >= 2 ? String(num(coords[1], 0)) : ''
    };
  }
  async function geocodeAddress(query, apiKey, options){
    const opts = options || {};
    const fetchImpl = opts.fetchImpl || root.fetch;
    if(typeof fetchImpl !== 'function') throw new Error('Brak połączenia albo fetch API w przeglądarce. Wpisz kilometry ręcznie albo spróbuj później.');
    const normalized = normalizeAddress(query);
    const searchText = prepareGeocodeQuery(normalized);
    const params = new URLSearchParams({ text:searchText, size:'1' });
    // Bezpieczne zawężenie dla typowych polskich danych użytkownika. Jeśli w przyszłości program będzie używany za granicą,
    // wystarczy dodać jawny kraj w ustawieniach zamiast zgadywać po adresie.
    if(/\bpolska\b|\błódź\b|\blodz\b/i.test(normalized)) params.set('boundary.country', 'PL');
    const url = ORS_GEOCODE_URL + '?' + params.toString();
    let response;
    try{ response = await fetchImpl(url, { headers:{ Authorization:apiKey } }); }
    catch(_){ throw new Error('Nie udało się połączyć z OpenRouteService. Sprawdź internet albo wpisz kilometry ręcznie.'); }
    const json = await readJson(response);
    if(!response || !response.ok) throw new Error(apiErrorText('Nie udało się odczytać adresu', response, json));
    const feature = json && Array.isArray(json.features) ? json.features[0] : null;
    const meta = geocodeMeta(searchText, feature);
    if(!Array.isArray(meta.coordinates) || meta.coordinates.length < 2) throw new Error('OpenRouteService nie znalazł adresu: ' + normalized);
    meta.input = normalized;
    return meta;
  }
  async function geocode(query, apiKey, options){
    const meta = await geocodeAddress(query, apiKey, options);
    return meta.coordinates;
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
    const distanceMeters = Math.round(num(summary.distance, 0));
    const durationSeconds = Math.round(num(summary.duration, 0));
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMin = Math.round(durationSeconds / 60);
    return { distanceKm, durationMin, distanceMeters, durationSeconds };
  }
  function mapsClientUrl(transport){
    const t = transport && typeof transport === 'object' ? transport : {};
    const o = t.originGeocode && Array.isArray(t.originGeocode.coordinates) ? t.originGeocode.coordinates : null;
    const d = t.destinationGeocode && Array.isArray(t.destinationGeocode.coordinates) ? t.destinationGeocode.coordinates : null;
    if(!(o && d && o.length >= 2 && d.length >= 2)) return 'https://maps.openrouteservice.org';
    const lat1 = num(o[1], 0); const lon1 = num(o[0], 0);
    const lat2 = num(d[1], 0); const lon2 = num(d[0], 0);
    const centerLat = Math.round(((lat1 + lat2) / 2) * 1000000) / 1000000;
    const centerLon = Math.round(((lon1 + lon2) / 2) * 1000000) / 1000000;
    const params = new URLSearchParams({
      n1:String(centerLat),
      n2:String(centerLon),
      n3:'16',
      a:`${lat1},${lon1},${lat2},${lon2}`,
      b:'0',
      c:'0',
      k1:'pl-PL',
      k2:'km'
    });
    return ORS_MAPS_URL + '?' + params.toString();
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
    const originGeocode = await geocodeAddress(origin, validation.apiKey, opts);
    const destinationGeocode = await geocodeAddress(destination, validation.apiKey, opts);
    const routeResult = await route(originGeocode.coordinates, destinationGeocode.coordinates, validation.apiKey, profile, opts);
    const result = {
      distanceKm:routeResult.distanceKm,
      durationMin:routeResult.durationMin,
      routeDistanceMeters:routeResult.distanceMeters,
      routeDurationSeconds:routeResult.durationSeconds,
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
      originGeocode,
      destinationGeocode,
      lastError:''
    };
    result.orsMapsUrl = mapsClientUrl(result);
    return result;
  }

  FC.openRouteServiceTransport = {
    ORS_GEOCODE_URL,
    ORS_DIRECTIONS_URL,
    ORS_MAPS_URL,
    PROVIDER,
    SOURCE_LABEL,
    normalizeAddress,
    prepareGeocodeQuery,
    stableHash,
    routeAddressHash,
    isResultStale,
    resultStatusLabel,
    validateRouteInput,
    geocodeAddress,
    geocode,
    route,
    mapsClientUrl,
    calculateRoute
  };
})();

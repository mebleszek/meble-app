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
  function compareText(value){
    return normalizeAddress(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function words(value){
    const v = compareText(value);
    return v ? v.split(/\s+/).filter(Boolean) : [];
  }
  function hasExactWordOrPhrase(haystack, needle){
    const h = words(haystack);
    const n = words(needle);
    if(!h.length || !n.length) return false;
    for(let i = 0; i <= h.length - n.length; i += 1){
      let ok = true;
      for(let j = 0; j < n.length; j += 1){
        if(h[i + j] !== n[j]){ ok = false; break; }
      }
      if(ok) return true;
    }
    return false;
  }
  function extractPostalCode(value){
    const m = normalizeAddress(value).match(/\b\d{2}-\d{3}\b/);
    return m ? m[0] : '';
  }
  function extractExpectedLocality(value){
    const normalized = normalizeAddress(value);
    const parts = normalized.split(',').map((x)=> normalizeAddress(x)).filter(Boolean);
    const countryWords = ['polska','poland'];
    for(let i = parts.length - 1; i >= 0; i -= 1){
      let part = parts[i].replace(/\b\d{2}-\d{3}\b/g, '').trim();
      if(!part) continue;
      const cmp = compareText(part);
      if(countryWords.includes(cmp)) continue;
      // Jeżeli segment wygląda jak ulica z numerem, to nie jest miejscowość.
      if(/\b\d+[a-z]?\b/i.test(part) && /\b(ul\.?|ulica|al\.?|aleja|pl\.?|plac|os\.?|osiedle)\b/i.test(part)) continue;
      return part;
    }
    return '';
  }
  function isPolishAddress(value){
    const v = normalizeAddress(value);
    return /\bpolska\b|\bpoland\b|\błódź\b|\blodz\b|\b\d{2}-\d{3}\b/i.test(v);
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
    if(s === 'geocode_mismatch') return 'adres niepewny';
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
  function geocodeMeta(query, feature, expected){
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    const props = feature && feature.properties && typeof feature.properties === 'object' ? feature.properties : {};
    const meta = {
      query:normalizeAddress(query),
      label:text(props.label || props.name || ''),
      name:text(props.name || ''),
      layer:text(props.layer || ''),
      source:text(props.source || ''),
      confidence:props.confidence == null ? '' : String(props.confidence),
      accuracy:text(props.accuracy || props.match_type || ''),
      country:text(props.country || props.country_a || ''),
      region:text(props.region || props.region_a || ''),
      county:text(props.county || ''),
      locality:text(props.locality || ''),
      localadmin:text(props.localadmin || ''),
      borough:text(props.borough || ''),
      postalcode:text(props.postalcode || props.postal_code || ''),
      street:text(props.street || ''),
      housenumber:text(props.housenumber || props.house_number || ''),
      coordinates:Array.isArray(coords) && coords.length >= 2 ? [num(coords[0], 0), num(coords[1], 0)] : [],
      lon:Array.isArray(coords) && coords.length >= 2 ? String(num(coords[0], 0)) : '',
      lat:Array.isArray(coords) && coords.length >= 2 ? String(num(coords[1], 0)) : ''
    };
    const exp = expected && typeof expected === 'object' ? expected : {};
    meta.expectedLocality = text(exp.locality || '');
    meta.expectedPostalCode = text(exp.postalCode || '');
    meta.localityMatch = meta.expectedLocality ? String(localityMatches(meta, meta.expectedLocality)) : '';
    meta.postalCodeMatch = meta.expectedPostalCode && meta.postalcode ? String(compareText(meta.postalcode) === compareText(meta.expectedPostalCode)) : '';
    return meta;
  }
  function localityMatches(meta, expectedLocality){
    const expected = text(expectedLocality);
    if(!expected) return true;
    const m = meta && typeof meta === 'object' ? meta : {};
    const direct = [m.locality, m.localadmin, m.borough].filter(Boolean);
    if(direct.some((value)=> compareText(value) === compareText(expected))) return true;
    // Pelias czasem nie wypełnia locality/localadmin, ale etykieta zawiera miejscowość.
    // Szukamy dokładnego słowa/frazy, żeby „łódzki” nie zaliczyło się jako „Łódź”.
    return hasExactWordOrPhrase(m.label || '', expected);
  }
  function postalCodeCompatible(meta, expectedPostalCode){
    const expected = text(expectedPostalCode);
    if(!expected) return true;
    const actual = text(meta && meta.postalcode);
    if(!actual) return true;
    return compareText(actual) === compareText(expected);
  }
  function layerRank(layer){
    const l = compareText(layer);
    if(l === 'address') return 5;
    if(l === 'venue') return 4;
    if(l === 'street') return 3;
    if(l === 'intersection') return 2;
    return 1;
  }
  function pickSafeGeocodeFeature(features, query, expected){
    const list = Array.isArray(features) ? features : [];
    const metas = list.map((feature)=> geocodeMeta(query, feature, expected));
    const viable = metas.filter((meta)=> {
      if(!Array.isArray(meta.coordinates) || meta.coordinates.length < 2) return false;
      if(expected && expected.locality && !localityMatches(meta, expected.locality)) return false;
      if(expected && expected.postalCode && !postalCodeCompatible(meta, expected.postalCode)) return false;
      return true;
    });
    viable.sort((a, b)=> {
      const cityA = expected && expected.locality && localityMatches(a, expected.locality) ? 100 : 0;
      const cityB = expected && expected.locality && localityMatches(b, expected.locality) ? 100 : 0;
      const postA = expected && expected.postalCode && postalCodeCompatible(a, expected.postalCode) ? 20 : 0;
      const postB = expected && expected.postalCode && postalCodeCompatible(b, expected.postalCode) ? 20 : 0;
      const rankA = layerRank(a.layer) * 10 + num(a.confidence, 0);
      const rankB = layerRank(b.layer) * 10 + num(b.confidence, 0);
      return (cityB + postB + rankB) - (cityA + postA + rankA);
    });
    return { picked:viable[0] || null, candidates:metas };
  }
  function describeGeocodeFailure(normalized, searchText, candidates, expected){
    const expCity = text(expected && expected.locality);
    const expPost = text(expected && expected.postalCode);
    const first = Array.isArray(candidates) && candidates[0] ? candidates[0] : null;
    if(first && expCity && !localityMatches(first, expCity)){
      return `OpenRouteService rozpoznał adres jako „${first.label || first.name || 'bez etykiety'}”, ale w danych jest miejscowość „${expCity}”. Nie zapisano kilometrów. Popraw adres albo wpisz km ręcznie.`;
    }
    if(first && expPost && !postalCodeCompatible(first, expPost)){
      return `OpenRouteService zwrócił adres z innym kodem pocztowym niż „${expPost}”. Nie zapisano kilometrów. Popraw adres albo wpisz km ręcznie.`;
    }
    return `OpenRouteService nie znalazł pewnego wyniku dla adresu: ${normalized || searchText}. Nie zapisano kilometrów. Popraw adres albo wpisz km ręcznie.`;
  }
  async function geocodeAddress(query, apiKey, options){
    const opts = options || {};
    const fetchImpl = opts.fetchImpl || root.fetch;
    if(typeof fetchImpl !== 'function') throw new Error('Brak połączenia albo fetch API w przeglądarce. Wpisz kilometry ręcznie albo spróbuj później.');
    const normalized = normalizeAddress(query);
    const searchText = prepareGeocodeQuery(normalized);
    const expected = {
      locality:text(opts.expectedLocality || extractExpectedLocality(normalized)),
      postalCode:text(opts.expectedPostalCode || extractPostalCode(normalized))
    };
    const params = new URLSearchParams({ text:searchText, size:'5' });
    // Bezpieczne zawężenie dla typowych polskich danych użytkownika. Jeśli w przyszłości program będzie używany za granicą,
    // wystarczy dodać jawny kraj w ustawieniach zamiast zgadywać po adresie.
    if(isPolishAddress(normalized)) params.set('boundary.country', 'PL');
    const url = ORS_GEOCODE_URL + '?' + params.toString();
    let response;
    try{ response = await fetchImpl(url, { headers:{ Authorization:apiKey } }); }
    catch(_){ throw new Error('Nie udało się połączyć z OpenRouteService. Sprawdź internet albo wpisz kilometry ręcznie.'); }
    const json = await readJson(response);
    if(!response || !response.ok) throw new Error(apiErrorText('Nie udało się odczytać adresu', response, json));
    const features = json && Array.isArray(json.features) ? json.features : [];
    const picked = pickSafeGeocodeFeature(features, searchText, expected);
    const meta = picked.picked;
    if(!meta){
      const err = new Error(describeGeocodeFailure(normalized, searchText, picked.candidates, expected));
      err.status = 'geocode_mismatch';
      err.query = searchText;
      err.expectedLocality = expected.locality;
      err.expectedPostalCode = expected.postalCode;
      err.candidates = picked.candidates;
      throw err;
    }
    if(!Array.isArray(meta.coordinates) || meta.coordinates.length < 2) throw new Error('OpenRouteService nie znalazł adresu: ' + normalized);
    meta.input = normalized;
    meta.candidateCount = String(features.length);
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
    compareText,
    extractPostalCode,
    extractExpectedLocality,
    stableHash,
    routeAddressHash,
    isResultStale,
    resultStatusLabel,
    validateRouteInput,
    geocodeAddress,
    geocodeMeta,
    localityMatches,
    pickSafeGeocodeFeature,
    geocode,
    route,
    mapsClientUrl,
    calculateRoute
  };
})();

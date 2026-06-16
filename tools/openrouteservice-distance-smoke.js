#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message, details){ if(!condition){ throw new Error(message + (details ? '\n' + JSON.stringify(details, null, 2) : '')); } }
function assertClose(actual, expected, message){
  if(Math.abs(Number(actual) - Number(expected)) > 1e-9) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

(async function main(){
  const version = '20260616_czynnosci_project_preparation_v1';
  const index = read('index.html');
  const dev = read('dev_tests.html');
  const companyView = read('js/app/ui/data-settings-company-view.js');
  const investorTransportSrc = read('js/app/investor/investor-transport.js');
  const serviceSrc = read('js/app/investor/openrouteservice-transport.js');
  const sources = read('js/app/pricing/work-quantity-sources.js');
  const offerSrc = read('js/app/wycena/wycena-core-offer.js');

  assert(index.includes(`js/app/investor/openrouteservice-transport.js?v=${version}`), 'index.html nie ładuje modułu ORS z aktualnym cache-bustingiem');
  assert(index.indexOf('js/app/investor/openrouteservice-transport.js') < index.indexOf('js/app/investor/investor-transport.js'), 'Moduł ORS musi ładować się przed panelem inwestora');
  assert(dev.includes(`js/app/investor/openrouteservice-transport.js?v=${version}`), 'dev_tests.html nie ładuje modułu ORS');
  assert(companyView.includes('własny darmowy klucz użytkownika') && companyView.includes('Google Maps API nie jest używane'), 'Trybik nie opisuje darmowego klucza ORS i braku Google Maps API');
  assert(investorTransportSrc.includes('saveTransport(investor, next)') && investorTransportSrc.includes('statusLabel') && investorTransportSrc.includes('Wynik liczony dla'), 'Panel inwestora nie zapisuje/nie pokazuje statusu i adresów ostatniego przeliczenia');
  assert(investorTransportSrc.includes('Diagnostyka ORS') && investorTransportSrc.includes('Sprawdź w ORS') && investorTransportSrc.includes('Jak liczono km do wyceny'), 'Panel inwestora musi pokazywać diagnostykę ORS, link ORS i wzór km do wyceny');
  assert(serviceSrc.includes('prepareGeocodeQuery') && serviceSrc.includes('originGeocode') && serviceSrc.includes('destinationGeocode') && serviceSrc.includes('mapsClientUrl'), 'Moduł ORS musi zapisywać diagnostykę geokodowania i link do map ORS');
  assert(!serviceSrc.includes('apiKey:\'') && !serviceSrc.includes('apiKey:"'), 'Nie wolno zaszywać realnego klucza API w kodzie');

  const storage = new Map();
  const sandbox = {
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    window:null,
    globalThis:null,
    localStorage:{
      getItem:(key)=> storage.has(key) ? storage.get(key) : null,
      setItem:(key, value)=> storage.set(key, String(value)),
      removeItem:(key)=> storage.delete(key),
      clear:()=> storage.clear(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    constants:{ STORAGE_KEYS:{ companyProfile:'fc_company_profile_v1' } },
    utils:{ clone:(v)=> JSON.parse(JSON.stringify(v || {})), uid:()=> 'uid_test' },
    wycenaCoreUtils:{ slug:(v)=> String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
  };
  vm.createContext(sandbox);
  vm.runInContext(read('js/app/settings/company-profile-store.js'), sandbox, { filename:'company-profile-store.js' });
  vm.runInContext(serviceSrc, sandbox, { filename:'openrouteservice-transport.js' });

  const ors = sandbox.FC.openRouteServiceTransport;
  assert(ors.validateRouteInput({ apiKey:'', origin:'A', destination:'B' }).status === 'missing_api_key', 'Brak klucza API musi dawać kontrolowany status');
  assert(ors.validateRouteInput({ apiKey:'key', origin:'', destination:'B' }).status === 'missing_company_address', 'Brak adresu firmy musi dawać kontrolowany status');
  assert(ors.validateRouteInput({ apiKey:'key', origin:'A', destination:'' }).status === 'missing_client_address', 'Brak adresu klienta musi dawać kontrolowany status');
  assert(ors.prepareGeocodeQuery('Krzemieniecka 28/88, Łódź').includes('Krzemieniecka 28'), 'Geokodowanie powinno usuwać numer mieszkania zapisany po slashu');
  assert(!ors.prepareGeocodeQuery('Krzemieniecka 28 m 88, Łódź').includes('m 88'), 'Geokodowanie powinno usuwać numer mieszkania zapisany jako m');
  assert(ors.extractExpectedLocality('Krzemieniecka 2 m 88, Łódź') === 'Łódź', 'Moduł ORS musi rozpoznać oczekiwaną miejscowość inwestora');
  assert(ors.extractExpectedLocality('ul. Retkińska 29, 94-012 Łódź, Polska') === 'Łódź', 'Moduł ORS musi rozpoznać miejscowość z adresu firmy z kodem pocztowym');

  const fetchCalls = [];
  const fakeFetch = async (url, opts)=>{
    fetchCalls.push({ url:String(url), opts:opts || {} });
    if(String(url).includes('/geocode/search')){
      const idx = fetchCalls.filter((row)=> String(row.url).includes('/geocode/search')).length;
      const isOrigin = idx === 1;
      return { ok:true, status:200, json:async ()=> ({ features:isOrigin ? [
        { geometry:{ coordinates:[19.45, 51.75] }, properties:{ label:'Retkińska 29, Łódź, Polska', locality:'Łódź', layer:'address', confidence:0.95, postalcode:'94-012' } }
      ] : [
        { geometry:{ coordinates:[19.60, 51.90] }, properties:{ label:'Piotrkowska 1, Koluszki, Polska', locality:'Koluszki', layer:'address', confidence:0.99 } },
        { geometry:{ coordinates:[19.55, 51.85] }, properties:{ label:'Piotrkowska 1, Łódź, Polska', locality:'Łódź', layer:'address', confidence:0.90 } }
      ] }) };
    }
    if(String(url).includes('/v2/directions/')){
      return { ok:true, status:200, json:async ()=> ({ routes:[{ summary:{ distance:12400, duration:2040 } }] }) };
    }
    return { ok:false, status:404, json:async ()=> ({ error:{ message:'not found' } }) };
  };
  const result = await ors.calculateRoute({ apiKey:'fake-key', origin:'ul. Retkińska 29, Łódź, Polska', destination:'Piotrkowska 1, Łódź', profile:'driving-car' }, { fetchImpl:fakeFetch, now:'2026-06-13T12:00:00.000Z' });
  assertClose(result.distanceKm, 12.4, 'ORS route distance should be saved as km');
  assertClose(result.durationMin, 34, 'ORS route duration should be saved as minutes');
  assert(result.source === 'OpenRouteService' && result.provider === 'openrouteservice' && result.status === 'success', 'Wynik ORS musi mieć źródło/provider/status', result);
  assert(result.addressHash && result.originHash && result.destinationHash, 'Wynik ORS musi zapisać hash adresów', result);
  assert(result.originGeocode && result.destinationGeocode && result.destinationGeocode.label.includes('Piotrkowska'), 'Wynik ORS musi zapisać etykiety i współrzędne geokodowania', result);
  assert(result.destinationGeocode.label.includes('Łódź') && !result.destinationGeocode.label.includes('Koluszki'), 'Program nie może brać pierwszego wyniku ORS, jeśli nie zgadza się miejscowość', result.destinationGeocode);
  assert(result.destinationGeocode.candidateCount === '2', 'Diagnostyka ORS musi zapisać liczbę sprawdzonych kandydatów', result.destinationGeocode);
  assert(result.routeDistanceMeters === 12400 && result.routeDurationSeconds === 2040, 'Wynik ORS musi zapisać surowe metry i sekundy z API', result);
  assert(result.orsMapsUrl && result.orsMapsUrl.includes('maps.openrouteservice.org'), 'Wynik ORS musi mieć link kontrolny do map ORS', result);
  assert(fetchCalls.length === 3 && fetchCalls.every((row)=> row.opts && row.opts.headers && row.opts.headers.Authorization === 'fake-key'), 'Test ma używać mocka fetch i własnego klucza z ustawień');
  assert(fetchCalls.filter((row)=> String(row.url).includes('/geocode/search')).every((row)=> String(row.url).includes('size=5')), 'Geokodowanie musi pobierać kilka kandydatów do automatycznej walidacji, bez pokazywania listy użytkownikowi');

  const mismatchCalls = [];
  const mismatchFetch = async (url, opts)=>{
    mismatchCalls.push({ url:String(url), opts:opts || {} });
    if(String(url).includes('/geocode/search')){
      const idx = mismatchCalls.filter((row)=> String(row.url).includes('/geocode/search')).length;
      return { ok:true, status:200, json:async ()=> ({ features:idx === 1 ? [
        { geometry:{ coordinates:[19.45, 51.75] }, properties:{ label:'Retkińska 29, Łódź, Polska', locality:'Łódź', layer:'address', confidence:0.95 } }
      ] : [
        { geometry:{ coordinates:[19.60, 51.90] }, properties:{ label:'Krzemieniecka 2, Koluszki, Polska', locality:'Koluszki', layer:'address', confidence:0.99 } }
      ] }) };
    }
    if(String(url).includes('/v2/directions/')) throw new Error('Nie wolno liczyć trasy po błędnym geokodowaniu miejscowości');
    return { ok:false, status:404, json:async ()=> ({}) };
  };
  let mismatchError = null;
  try{
    await ors.calculateRoute({ apiKey:'fake-key', origin:'ul. Retkińska 29, Łódź, Polska', destination:'Krzemieniecka 2 m 88, Łódź', profile:'driving-car' }, { fetchImpl:mismatchFetch, now:'2026-06-13T12:00:00.000Z' });
  }catch(err){ mismatchError = err; }
  assert(mismatchError && mismatchError.status === 'geocode_mismatch', 'Inna miejscowość z ORS musi odrzucić automatyczne przeliczenie', mismatchError && { status:mismatchError.status, message:mismatchError.message });
  assert(/Koluszki/.test(mismatchError.message) && /Łódź/.test(mismatchError.message), 'Komunikat musi jasno pokazać złą i oczekiwaną miejscowość', mismatchError.message);
  assert(!mismatchCalls.some((row)=> String(row.url).includes('/v2/directions/')), 'Po niepewnym geokodowaniu program nie może wysłać zapytania trasy');

  const profile = sandbox.FC.companyProfile.normalizeProfile(sandbox.FC.companyProfile.DEFAULT_COMPANY_PROFILE);
  profile.transport.billingMode = 'round_trip';
  profile.transport.roundingKm = 5;
  profile.transport.apiKey = 'fake-key';
  sandbox.FC.companyProfile.write(profile);
  assertClose(sandbox.FC.companyProfile.billableDistanceKm(12.4), 25, 'Tryb tam i z powrotem + zaokrąglenie do 5 km ma dać 25 km');

  assert(ors.isResultStale(result, result.origin, result.destination) === false, 'Nie zmienione adresy nie mogą oznaczać wyniku jako nieaktualny');
  assert(ors.isResultStale(result, result.origin, 'Inny adres klienta') === true, 'Zmiana adresu klienta musi oznaczać wynik jako potencjalnie nieaktualny');

  vm.runInContext(read('js/app/investor/investor-transport.js'), sandbox, { filename:'investor-transport.js' });
  const investor = { id:'inv_test', name:'Klient', address:'Piotrkowska 1', city:'Łódź', transport:{ distanceKm:'7.5', source:'ręcznie', status:'manual' } };
  sandbox.FC.investorPersistence = {
    getCurrentInvestorId:()=> 'inv_test',
    getInvestorById:(id)=> id === 'inv_test' ? investor : null,
  };
  profile.transport.billingMode = 'one_way';
  profile.transport.roundingKm = 0;
  sandbox.FC.companyProfile.write(profile);
  let ctx = sandbox.FC.investorTransport.getCurrentTransportContext();
  assertClose(ctx.billableKm, 7.5, 'Ręcznie wpisane km muszą nadal zasilać transport.distance_km');
  assert(ctx.transport.status === 'manual' && ctx.displayValue.includes('7,5'), 'Ręczny transport musi zachować status i widok');
  assert(typeof sandbox.FC.investorTransport.billableBreakdown === 'function' && sandbox.FC.investorTransport.renderPanel(investor, null, false).includes('Jak liczono km do wyceny'), 'Panel musi pokazywać rozbicie trasy i km do wyceny');

  vm.runInContext(read('js/app/pricing/labor-catalog-definitions.js'), sandbox, { filename:'labor-catalog-definitions.js' });
  vm.runInContext(read('js/app/pricing/labor-catalog.js'), sandbox, { filename:'labor-catalog.js' });
  vm.runInContext(offerSrc, sandbox, { filename:'wycena-core-offer.js' });
  investor.transport = { distanceKm:'12.4', source:'OpenRouteService', provider:'openrouteservice', status:'success' };
  profile.transport.billingMode = 'round_trip';
  profile.transport.roundingKm = 5;
  sandbox.FC.companyProfile.write(profile);
  sandbox.FC.catalogSelectors = { getQuoteRates:()=> [{ id:'transport_distance_km', category:'Transport', name:'Transport do klienta', pricingMode:'startPlusUnit', startPrice:50, includedQty:10, price:4, quantitySource:'transport.distance_km', quantityMode:'linear', active:true, internalOnly:false }] };
  sandbox.FC.quoteOfferStore = { getCurrentDraft:()=> ({ rateSelections:[], commercial:{} }) };
  const lines = sandbox.FC.wycenaCoreOffer.collectQuoteRateLines();
  const transportLine = lines.find((row)=> row && row.sourceRole === 'transport-distance');
  assert(transportLine, 'WYCENA musi dostać automatyczną linię transport.distance_km');
  assertClose(transportLine.qty, 25, 'WYCENA musi używać km po trybie tam i z powrotem oraz zaokrągleniu');
  assertClose(transportLine.total, 110, 'Transport ma liczyć start + płatne km');
  assert(transportLine.quantitySource === 'transport.distance_km' && transportLine.sourceType === 'transport', 'Linia transportu musi zachować źródło transport.distance_km');

  assert(sources.includes("code:'transport.distance_km'") && offerSrc.includes('getCurrentTransportContext'), 'Źródło transport.distance_km musi pozostać jednym źródłem dla WYCENY');
  console.log('OpenRouteService distance smoke: OK');
})().catch((err)=>{
  console.error(err && err.stack || err);
  process.exit(1);
});

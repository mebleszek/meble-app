(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const TEST_OWNER = 'dev-tests';

  const KEY_INFO = {
    fc_investors_v1:{ category:'user', label:'Inwestorzy', description:'Lista inwestorów oraz ich dane kontaktowe i pomieszczenia.' },
    fc_projects_v1:{ category:'user', label:'Projekty', description:'Centralny store projektów, pomieszczeń i danych szafek pod inwestorów.' },
    fc_project_v1:{ category:'user', label:'Aktywny projekt', description:'Bieżący projekt używany przez główny ekran aplikacji.' },
    fc_project_backup_v1:{ category:'user', label:'Awaryjna kopia aktywnego projektu', description:'Starszy mechanizm zabezpieczenia aktywnego projektu.' },
    fc_sheet_materials_v1:{ category:'user', label:'Cennik materiałów płytowych', description:'Materiały, kolory i ceny używane w wycenach oraz ROZRYS.' },
    fc_materials_v1:{ category:'user', label:'Cennik materiałów — legacy', description:'Starszy klucz zgodności dla materiałów.' },
    fc_accessories_v1:{ category:'user', label:'Akcesoria', description:'Pozycje akcesoriów używane w wycenach.' },
    fc_quote_rates_v1:{ category:'user', label:'Cennik usług do wycen', description:'Stawki używane przy ofertach meblowych.' },
    fc_services_v1:{ category:'user', label:'Cennik usług — legacy', description:'Starszy klucz zgodności dla usług ofertowych.' },
    fc_workshop_services_v1:{ category:'user', label:'Cennik drobnych usług', description:'Stawki usług stolarskich poza projektami meblowymi.' },
    fc_service_orders_v1:{ category:'user', label:'Zlecenia usługowe', description:'Lista drobnych zleceń stolarskich.' },
    fc_quote_snapshots_v1:{ category:'user', label:'Historia ofert', description:'Zapisane wersje wycen/ofert.' },
    fc_quote_offer_drafts_v1:{ category:'user', label:'Drafty ofert', description:'Robocze ustawienia aktualnie edytowanych wycen.' },
    fc_edge_v1:{ category:'user', label:'Okleiny formatek', description:'Krawędzie/okleiny przypisane do formatek.' },
    fc_material_part_options_v1:{ category:'user', label:'Opcje formatek materiałowych', description:'Dodatkowe ustawienia formatek w zakładce Materiał.' },
    fc_sheets_v1:{ category:'user', label:'Magazyn płyt', description:'Stany płyt i arkuszy magazynowych.' },
    fc_current_investor_v1:{ category:'technical', label:'Aktywny inwestor', description:'Techniczny identyfikator aktualnie otwartego inwestora.' },
    fc_current_project_id_v1:{ category:'technical', label:'Aktywny projekt — ID', description:'Techniczny identyfikator aktualnie otwartego projektu.' },
    fc_ui_v1:{ category:'technical', label:'Stan interfejsu', description:'Ostatni widok, zakładka, wybrane pomieszczenie i ustawienia UI.' },
    fc_investor_removed_ids_v1:{ category:'technical', label:'Usunięci inwestorzy — blokada recovery', description:'Techniczna lista inwestorów usuniętych ręcznie, aby recovery ich nie odtwarzało.' },
    fc_project_backup_meta_v1:{ category:'technical', label:'Meta backupu projektu', description:'Informacja techniczna o starszej kopii aktywnego projektu.' },
    fc_rozrys_grain_state_v1:{ category:'technical', label:'ROZRYS — słoje', description:'Stan przełączników kierunku słojów.' },
    fc_rozrys_overrides_v1:{ category:'technical', label:'ROZRYS — nadpisania', description:'Techniczne wyjątki ustawień elementów dla rozkroju.' },
    fc_rozrys_panel_prefs_v1:{ category:'technical', label:'ROZRYS — preferencje panelu', description:'Preferencje widoku panelu ROZRYS.' },
    fc_rozrys_material_accordion_v1:{ category:'technical', label:'ROZRYS — akordeony materiałów', description:'Zapamiętane rozwinięcia list materiałów w ROZRYS.' },
  };

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function isPlainObject(value){
    return !!(value && typeof value === 'object' && !Array.isArray(value));
  }

  function metaOf(value){
    return value && value.meta && typeof value.meta === 'object' ? value.meta : {};
  }

  function truthyFlag(value){
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  function getTestRunId(value){
    const src = value && typeof value === 'object' ? value : {};
    const meta = metaOf(src);
    return String(src.__testRunId || meta.__testRunId || meta.testRunId || '').trim();
  }

  function isLegacyDevTest(value){
    const meta = metaOf(value);
    const owner = String(meta.testOwner || '').trim();
    return truthyFlag(meta.testData) && (!owner || owner === TEST_OWNER);
  }

  function isTestMarked(value, options){
    const opts = options && typeof options === 'object' ? options : {};
    const src = value && typeof value === 'object' ? value : {};
    const meta = metaOf(src);
    const marked = truthyFlag(src.__test) || truthyFlag(meta.__test) || isLegacyDevTest(src);
    if(!marked) return false;
    const runId = String(opts.runId || '').trim();
    if(!runId) return true;
    return getTestRunId(src) === runId;
  }

  function countMarkedRecords(value, options){
    if(Array.isArray(value)) return value.reduce((sum, item)=> sum + (isTestMarked(item, options) ? 1 : 0), 0);
    if(isPlainObject(value)){
      if(isTestMarked(value, options)) return 1;
      return Object.keys(value).reduce((sum, key)=> sum + (isTestMarked(value[key], options) ? 1 : 0), 0);
    }
    return 0;
  }

  function knownInfo(key){
    const k = String(key || '');
    if(KEY_INFO[k]) return KEY_INFO[k];
    if(/^fc_project_inv_.+_v1$/.test(k)){
      return { category:'user', label:'Projekt inwestora', description:'Osobny slot projektu przypisany do konkretnego inwestora.' };
    }
    if(/^fc_rozrys_/i.test(k)){
      return { category:'technical', label:'ROZRYS — dane pomocnicze', description:'Techniczny stan pomocniczy modułu ROZRYS.' };
    }
    if(/_test|test_/i.test(k)){
      return { category:'test', label:'Dane testowe', description:'Klucz utworzony przez testy lub fixture testowy.' };
    }
    return { category:'user', label:'Dane programu', description:'Klucz aplikacji bez szczegółowego opisu w katalogu danych.' };
  }

  function classifyKey(key, raw){
    const k = String(key || '');
    const parsed = parseJson(raw);
    const info = knownInfo(k);
    const size = String(raw == null ? '' : raw).length;
    const recordCount = Array.isArray(parsed) ? parsed.length : (isPlainObject(parsed) ? Object.keys(parsed).length : (raw ? 1 : 0));
    const testRecords = countMarkedRecords(parsed);
    const baseCategory = info.category || 'user';
    const category = baseCategory === 'test' ? 'test' : baseCategory;
    return {
      key:k,
      category,
      baseCategory,
      label:info.label || k,
      description:info.description || '',
      size,
      recordCount,
      testRecords,
      hasTestData:testRecords > 0 || category === 'test',
    };
  }

  function listKeyEntries(snapshot){
    const snap = snapshot && snapshot.keys ? snapshot : null;
    const keys = snap && snap.keys ? snap.keys : {};
    return Object.keys(keys).sort().map((key)=> classifyKey(key, keys[key]));
  }

  function buildSummary(snapshot){
    const entries = listKeyEntries(snapshot);
    const userEntries = entries.filter((entry)=> entry.baseCategory === 'user');
    const technicalEntries = entries.filter((entry)=> entry.baseCategory === 'technical');
    const testEntries = entries.filter((entry)=> entry.hasTestData);
    const sum = (rows, prop)=> rows.reduce((acc, row)=> acc + (Number(row[prop]) || 0), 0);
    return {
      entries,
      user:{ keys:userEntries.length, bytes:sum(userEntries, 'size'), records:sum(userEntries, 'recordCount') },
      technical:{ keys:technicalEntries.length, bytes:sum(technicalEntries, 'size'), records:sum(technicalEntries, 'recordCount') },
      test:{ keys:testEntries.length, bytes:sum(testEntries, 'size'), records:sum(testEntries, 'testRecords') },
      byCategory:{ user:userEntries, technical:technicalEntries, test:testEntries },
    };
  }

  function formatBytes(chars){
    const n = Math.max(0, Number(chars) || 0);
    if(n < 1024) return `${n} zn.`;
    if(n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
    return `${Math.round(n / 104857.6) / 10} MB`;
  }

  function buildDiagnosticsReport(snapshot, stats){
    const summary = buildSummary(snapshot);
    const s = stats || {};
    const lines = [];
    lines.push('Meble-app — raport danych');
    lines.push('Data: ' + (function(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } })());
    lines.push('');
    lines.push('Dane użytkownika:');
    lines.push('- Klucze: ' + summary.user.keys);
    lines.push('- Rekordy/pozycje w kluczach: ' + summary.user.records);
    lines.push('- Rozmiar: ' + formatBytes(summary.user.bytes));
    lines.push('- Inwestorzy: ' + (s.investors || 0));
    lines.push('- Projekty: ' + (s.projects || 0));
    lines.push('- Snapshoty wycen: ' + (s.quoteSnapshots || 0));
    lines.push('- Drafty ofert: ' + (s.quoteDrafts || 0));
    lines.push('- Zlecenia usługowe: ' + (s.serviceOrders || 0));
    lines.push('- Wpisy oklein: ' + (s.edgeEntries || 0));
    lines.push('');
    lines.push('Dane techniczne:');
    lines.push('- Klucze: ' + summary.technical.keys);
    lines.push('- Rekordy/pozycje w kluczach: ' + summary.technical.records);
    lines.push('- Rozmiar: ' + formatBytes(summary.technical.bytes));
    lines.push('');
    lines.push('Dane testowe:');
    lines.push('- Klucze zawierające dane testowe: ' + summary.test.keys);
    lines.push('- Oznaczone rekordy testowe: ' + summary.test.records);
    lines.push('- Rozmiar kluczy z danymi testowymi: ' + formatBytes(summary.test.bytes));
    lines.push('');
    lines.push('Lista kluczy danych:');
    summary.entries.forEach((entry)=>{
      lines.push(`- [${entry.baseCategory}] ${entry.key} — ${entry.label}; ${formatBytes(entry.size)}; pozycji: ${entry.recordCount}${entry.testRecords ? '; testowe: ' + entry.testRecords : ''}`);
    });
    return lines.join('\n');
  }

  FC.dataStorageClassifier = {
    TEST_OWNER,
    parseJson,
    isPlainObject,
    getTestRunId,
    isTestMarked,
    countMarkedRecords,
    classifyKey,
    listKeyEntries,
    buildSummary,
    buildDiagnosticsReport,
    formatBytes,
  };
})();

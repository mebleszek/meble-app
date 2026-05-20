// js/app/catalog/hardware-technical-params.js
// Dynamiczne parametry techniczne okuć: definicje per kategoria, wartości od-do, typ/cecha i porównywanie.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const DEFAULT_COMPARE_MODES = [
    { value:'equal', label:'Dokładnie taka sama wartość' },
    { value:'withinRange', label:'Mieści się w zakresie' },
    { value:'rangeOverlap', label:'Zakresy się przecinają' },
    { value:'minGte', label:'Minimum takie samo lub większe' },
    { value:'ignore', label:'Nie porównuj' },
  ];
  const DEFAULT_FIELD_TYPES = [
    { value:'text', label:'Tekst / wybór' },
    { value:'boolean', label:'Tak / nie' },
    { value:'numberRange', label:'Liczba / zakres od-do' },
  ];
  const DEFAULT_DEFINITIONS = [
    { category:'Zawiasy', key:'nalozenie', label:'Nałożenie', fieldType:'text', unit:'', options:['nakładany','półnakładany / bliźniaczy','wpuszczany'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Zawiasy', key:'kat_otwarcia', label:'Kąt otwarcia', fieldType:'numberRange', unit:'°', options:[], keyFeature:true, typePart:true, compareMode:'withinRange', order:20, active:true },
    { category:'Zawiasy', key:'hamulec', label:'Hamulec / domyk', fieldType:'boolean', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:30, active:true },
    { category:'Zawiasy', key:'sprezyna', label:'Sprężyna', fieldType:'boolean', unit:'', options:[], keyFeature:true, typePart:false, compareMode:'equal', order:40, active:true },
    { category:'Zawiasy', key:'prowadnik', label:'Prowadnik / montaż', fieldType:'text', unit:'', options:['standardowy','specjalny','osobno'], keyFeature:false, typePart:false, compareMode:'ignore', order:50, active:true },

    { category:'Szuflady / prowadnice', key:'profil_szuflady', label:'Profil / wysokość', fieldType:'text', unit:'', options:['M','N','H','niska','średnia','wysoka'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true, legacyField:'drawerProfile' },
    { category:'Szuflady / prowadnice', key:'dlugosc_mm', label:'Długość', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:20, active:true, legacyField:'drawerLengthMm' },
    { category:'Szuflady / prowadnice', key:'nosnosc_kg', label:'Nośność', fieldType:'numberRange', unit:'kg', options:[], keyFeature:true, typePart:true, compareMode:'minGte', order:30, active:true, legacyField:'drawerLoadKg' },
    { category:'Szuflady / prowadnice', key:'wzmocniona', label:'Wzmocniona', fieldType:'boolean', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:40, active:true, legacyField:'drawerReinforced' },
    { category:'Szuflady / prowadnice', key:'kolor_okucia', label:'Kolor okucia', fieldType:'text', unit:'', options:['biały','szary','antracyt'], keyFeature:false, typePart:false, compareMode:'ignore', order:50, active:true, legacyField:'hardwareColor' },
    { category:'Szuflady / prowadnice', key:'zastosowanie', label:'Zastosowanie', fieldType:'text', unit:'', options:['frontowa','wewnętrzna','zlewowa','piekarnikowa'], keyFeature:true, typePart:false, compareMode:'equal', order:60, active:true, legacyField:'hardwareUsage' },

    { category:'Cargo / organizery', key:'szerokosc_modulu_mm', label:'Szerokość modułu', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Cargo / organizery', key:'wysokosc_min_mm', label:'Wysokość od', fieldType:'numberRange', unit:'mm', options:[], keyFeature:false, typePart:false, compareMode:'rangeOverlap', order:20, active:true },
    { category:'Cargo / organizery', key:'glebokosc_min_mm', label:'Głębokość min.', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:false, compareMode:'minGte', order:30, active:true },
    { category:'Cargo / organizery', key:'strona', label:'Strona', fieldType:'text', unit:'', options:['lewa','prawa','uniwersalna'], keyFeature:true, typePart:true, compareMode:'equal', order:40, active:true },
    { category:'Cargo / organizery', key:'nosnosc_kg', label:'Nośność', fieldType:'numberRange', unit:'kg', options:[], keyFeature:true, typePart:false, compareMode:'minGte', order:50, active:true },

    { category:'Podnośniki', key:'typ_podnosnika', label:'Typ podnośnika', fieldType:'text', unit:'', options:['HK-S','HK-XS','HF','HS','HL'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Podnośniki', key:'zakres_sily', label:'Zakres siły', fieldType:'numberRange', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'rangeOverlap', order:20, active:true },
    { category:'Podnośniki', key:'front_wysokosc_mm', label:'Wysokość frontu', fieldType:'numberRange', unit:'mm', options:[], keyFeature:false, typePart:false, compareMode:'rangeOverlap', order:30, active:true },

    { category:'Systemy narożne', key:'typ_narozny', label:'Typ narożny', fieldType:'text', unit:'', options:['nerka','magic corner','le mans'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Systemy narożne', key:'szerokosc_korpusu_mm', label:'Szerokość korpusu', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:20, active:true },
    { category:'Systemy narożne', key:'strona', label:'Strona', fieldType:'text', unit:'', options:['lewa','prawa'], keyFeature:true, typePart:true, compareMode:'equal', order:30, active:true },
    { category:'Systemy narożne', key:'glebokosc_min_mm', label:'Głębokość min.', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:false, compareMode:'minGte', order:40, active:true },

    { category:'Pantografy', key:'szerokosc_mm', label:'Szerokość', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:true, compareMode:'withinRange', order:10, active:true },
    { category:'Pantografy', key:'nosnosc_kg', label:'Nośność', fieldType:'numberRange', unit:'kg', options:[], keyFeature:true, typePart:true, compareMode:'minGte', order:20, active:true },
    { category:'Pantografy', key:'kolor_okucia', label:'Kolor / wykończenie', fieldType:'text', unit:'', options:['chrom','czarny','biały'], keyFeature:false, typePart:false, compareMode:'ignore', order:30, active:true },

    { category:'Ociekarki', key:'szerokosc_korpusu_mm', label:'Szerokość korpusu', fieldType:'numberRange', unit:'mm', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Ociekarki', key:'poziomy', label:'Liczba poziomów', fieldType:'numberRange', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:20, active:true },
    { category:'Ociekarki', key:'material_wykonczenie', label:'Materiał / wykończenie', fieldType:'text', unit:'', options:['inox','chrom','biały'], keyFeature:false, typePart:false, compareMode:'ignore', order:30, active:true },
  ];

  const FIELD_HELP = {
    name:'To nazwa pola technicznego, które pojawi się przy okuciu danej kategorii, np. Długość, Kąt otwarcia, Nośność, Strona.',
    key:'Stabilny klucz techniczny używany w Excelu i imporcie. Po utworzeniu nie zmieniaj go bez potrzeby, żeby stare pliki nadal pasowały.',
    fieldType:'Typ danych: tekst/wybór, tak-nie albo liczba z obsługą wartości dokładnej i zakresu od-do.',
    unit:'Jednostka parametru, np. mm, kg albo °. Trafia do opisów i Excela.',
    options:'Opcjonalne wartości podpowiedzi rozdzielone średnikiem, np. nakładany;wpuszczany;bliźniaczy. Pole nadal można edytować.',
    keyFeature:'Zaznacz, jeśli parametr ma być ważny przy szukaniu zamiennika. Przykład: długość prowadnicy 500 mm musi pasować do 500 mm.',
    typePart:'Zaznacz, jeśli parametr ma budować automatyczny opis Typ / cecha, np. „110° nakładany” albo „M 500 50 kg”.',
    compareMode:'Określa, jak program będzie porównywał parametr przy zamianie producenta: dokładnie, przez zakres albo przez minimalną wartość.',
    valueFrom:'Wpisz dokładną wartość albo początek zakresu. Jeśli pole „do” zostawisz puste, program traktuje tę wartość jako dokładną.',
    valueTo:'Wypełnij tylko wtedy, gdy parametr jest zakresem, np. kąt 90–110° albo szerokość 600–830 mm.',
    exact:'Dokładna wartość: pole „od” wypełnione, pole „do” puste. Przykład: prowadnica 500 mm.',
    range:'Zakres: wypełnione pola „od” i „do”. Przykład: zawias 90–110° albo pantograf 600–830 mm.',
    equal:'Zamiennik musi mieć identyczną wartość. Dobre dla długości prowadnic albo szerokości korpusu.',
    withinRange:'Wartość może mieścić się w zakresie. Dobre dla kątów zawiasów albo zakresów szerokości.',
    rangeOverlap:'Dwa zakresy muszą mieć część wspólną. Dobre dla produktów pracujących w zakresach.',
    minGte:'Zamiennik musi mieć minimum taką samą lub większą wartość. Dobre dla nośności: 50 kg może zastąpić 30 kg, ale nie odwrotnie.',
    ignore:'Parametr zapisuje się informacyjnie, ale nie blokuje zamiany producenta.',
  };

  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function scalarValue(value, depth){
    if(value == null) return '';
    if(depth > 4) return '';
    if(typeof value === 'string') return value === '[object Object]' ? '' : value;
    if(typeof value === 'number' || typeof value === 'boolean') return value;
    if(Array.isArray(value)) return value.map((item)=> text(item)).filter(Boolean).join('; ');
    if(value && typeof value === 'object'){
      const keys = ['value','label','name','text','title','id','key'];
      for(let i = 0; i < keys.length; i += 1){
        if(Object.prototype.hasOwnProperty.call(value, keys[i])){
          const resolved = scalarValue(value[keys[i]], (depth || 0) + 1);
          if(text(resolved)) return resolved;
        }
      }
      return '';
    }
    return '';
  }
  function text(value){ return String(scalarValue(value, 0)).trim(); }
  function number(value){ const n = Number(text(value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function safeKey(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || '';
  }
  function bool(value){
    if(value === true) return true;
    if(value === false) return false;
    const raw = text(value).toLowerCase();
    return ['tak','true','1','yes','y'].includes(raw);
  }
  function uniqueKey(category, key){ return safeKey(category) + '|' + safeKey(key); }
  function normalizeCompareMode(value){ const raw = text(value) || 'equal'; return DEFAULT_COMPARE_MODES.some((row)=> row.value === raw) ? raw : 'equal'; }
  function normalizeFieldType(value){ const raw = text(value) || 'text'; return DEFAULT_FIELD_TYPES.some((row)=> row.value === raw) ? raw : 'text'; }
  function optionsFrom(value){
    if(Array.isArray(value)) return value.map(text).filter(Boolean);
    return text(value).split(/[;|]/).map(text).filter(Boolean);
  }
  function normalizeDefinition(row, index){
    const src = row && typeof row === 'object' ? row : {};
    const category = text(src.category || src.hardwareCategory || src.kategoria);
    const label = text(src.label || src.name || src.nazwa);
    const key = safeKey(src.key || src.klucz || label);
    return {
      id:text(src.id) || (safeKey(category) + '_' + key),
      category,
      key,
      label:label || key,
      fieldType:normalizeFieldType(src.fieldType || src.typ_pola || src.type),
      unit:text(src.unit || src.jednostka),
      options:optionsFrom(src.options || src.wartosci),
      keyFeature:src.keyFeature === false || text(src.cecha_kluczowa).toLowerCase() === 'nie' ? false : !!(src.keyFeature || src.compareKey || src.cechaKluczowa || src.cecha_kluczowa || src.typePart || src.tworzyTyp),
      typePart:src.typePart === false || text(src.tworzy_typ).toLowerCase() === 'nie' ? false : (src.typePart != null ? !!src.typePart : (src.keyFeature != null ? !!src.keyFeature : true)),
      compareMode:normalizeCompareMode(src.compareMode || src.sposob_porownania || src.porownanie),
      order:Number(src.order != null ? src.order : src.kolejnosc) || (index + 1) * 10,
      active:src.active === false || text(src.aktywny).toLowerCase() === 'nie' ? false : true,
      legacyField:text(src.legacyField || src.legacy_field),
    };
  }
  function normalizeDefinitions(list, categories){
    const rows = (Array.isArray(list) && list.length ? list : []).concat(DEFAULT_DEFINITIONS);
    const seen = new Set();
    const out = [];
    rows.forEach((row, index)=>{
      const item = normalizeDefinition(row, index);
      if(!item.category || !item.key) return;
      const key = uniqueKey(item.category, item.key);
      if(seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    (Array.isArray(categories) ? categories : []).map(text).filter(Boolean).forEach((cat)=>{
      if(!out.some((row)=> text(row.category) === cat)){
        out.push(normalizeDefinition({ category:cat, key:'uwagi_techniczne', label:'Uwagi techniczne', fieldType:'text', keyFeature:false, typePart:false, compareMode:'ignore', order:999, active:true }, out.length));
      }
    });
    return out.sort((a, b)=> text(a.category).localeCompare(text(b.category), 'pl') || (Number(a.order) || 0) - (Number(b.order) || 0) || text(a.label).localeCompare(text(b.label), 'pl'));
  }
  function fieldsForCategory(definitions, category){
    const cat = text(category);
    return normalizeDefinitions(definitions || DEFAULT_DEFINITIONS).filter((row)=> row.active !== false && text(row.category) === cat).sort((a, b)=> (Number(a.order) || 0) - (Number(b.order) || 0));
  }
  function normalizeParamValue(field, raw){
    const src = raw && typeof raw === 'object' ? raw : { value:raw };
    if(!field) return { value:text(src.value) };
    if(field.fieldType === 'boolean') return { value:!!(src.value === true || bool(src.value) || src.checked === true) };
    if(field.fieldType === 'numberRange'){
      const fromRaw = src.from != null ? src.from : (src.value != null ? src.value : src.od);
      const toRaw = src.to != null ? src.to : src.do;
      const from = text(fromRaw) === '' ? '' : number(fromRaw);
      const to = text(toRaw) === '' ? '' : number(toRaw);
      return { from, to };
    }
    return { value:text(src.value != null ? src.value : src) };
  }
  function normalizeParamValues(values, definitions, category){
    const src = values && typeof values === 'object' ? values : {};
    const out = {};
    fieldsForCategory(definitions, category).forEach((field)=>{
      const raw = src[field.key] != null ? src[field.key] : src[field.legacyField];
      const val = normalizeParamValue(field, raw);
      if(field.fieldType === 'boolean' || text(val.value) || text(val.from) || text(val.to)) out[field.key] = val;
    });
    return out;
  }
  function paramValueText(field, value, opts){
    const cfg = Object.assign({ withUnit:true, forType:false }, opts || {});
    const val = normalizeParamValue(field, value || {});
    if(field.fieldType === 'boolean'){
      if(!val.value) return '';
      return field.key === 'wzmocniona' ? 'wzmocniona' : text(field.label).toLowerCase();
    }
    if(field.fieldType === 'numberRange'){
      const unit = cfg.withUnit && field.unit ? String(field.unit) : '';
      if(text(val.from) && text(val.to)) return `${val.from}–${val.to}${unit}`;
      if(text(val.from)) return `${val.from}${unit}`;
      return '';
    }
    const raw = text(val.value);
    if(!raw) return '';
    return raw;
  }
  function buildTypeLabel(definitions, category, values){
    const parts = [];
    fieldsForCategory(definitions, category).filter((field)=> field.typePart !== false).forEach((field)=>{
      const value = values && values[field.key];
      const part = paramValueText(field, value, { forType:true, withUnit:true });
      if(part) parts.push(part);
    });
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  function legacyParamValues(src){
    const row = src && typeof src === 'object' ? src : {};
    const out = {};
    if(text(row.drawerProfile)) out.profil_szuflady = { value:text(row.drawerProfile) };
    if(text(row.drawerLengthMm)) out.dlugosc_mm = { from:number(row.drawerLengthMm), to:'' };
    if(text(row.drawerLoadKg)) out.nosnosc_kg = { from:number(row.drawerLoadKg), to:'' };
    if(row.drawerReinforced === true || bool(row.drawerReinforced)) out.wzmocniona = { value:true };
    if(text(row.hardwareColor)) out.kolor_okucia = { value:text(row.hardwareColor) };
    if(text(row.hardwareUsage)) out.zastosowanie = { value:text(row.hardwareUsage) };
    if(text(row.technicalNote)) out.uwagi_techniczne = { value:text(row.technicalNote) };
    return out;
  }
  function mergeLegacyValues(src, definitions, category){
    const row = src && typeof src === 'object' ? src : {};
    const fromLegacy = legacyParamValues(row);
    const explicit = row.technicalParams && typeof row.technicalParams === 'object' ? row.technicalParams : {};
    return normalizeParamValues(Object.assign({}, fromLegacy, explicit), definitions, category);
  }
  function applyLegacyFieldsFromParams(target, definitions){
    const row = target && typeof target === 'object' ? target : {};
    const params = row.technicalParams || {};
    fieldsForCategory(definitions, row.hardwareCategory).forEach((field)=>{
      if(!field.legacyField || !params[field.key]) return;
      const val = normalizeParamValue(field, params[field.key]);
      if(field.fieldType === 'boolean') row[field.legacyField] = !!val.value;
      else if(field.fieldType === 'numberRange') row[field.legacyField] = val.from !== '' ? val.from : '';
      else row[field.legacyField] = text(val.value);
    });
    return row;
  }
  function compareParam(field, source, target){
    if(!field || field.compareMode === 'ignore') return true;
    const a = normalizeParamValue(field, source || {});
    const b = normalizeParamValue(field, target || {});
    if(field.fieldType === 'boolean') return !!a.value === !!b.value;
    if(field.fieldType !== 'numberRange') return text(a.value).toLowerCase() === text(b.value).toLowerCase();
    const af = Number(a.from), at = a.to === '' ? af : Number(a.to);
    const bf = Number(b.from), bt = b.to === '' ? bf : Number(b.to);
    if(!Number.isFinite(af) || !Number.isFinite(bf)) return false;
    const aMin = Math.min(af, Number.isFinite(at) ? at : af), aMax = Math.max(af, Number.isFinite(at) ? at : af);
    const bMin = Math.min(bf, Number.isFinite(bt) ? bt : bf), bMax = Math.max(bf, Number.isFinite(bt) ? bt : bf);
    if(field.compareMode === 'minGte') return bMax >= aMax;
    if(field.compareMode === 'rangeOverlap') return aMin <= bMax && bMin <= aMax;
    if(field.compareMode === 'withinRange') return aMin >= bMin && aMax <= bMax || bMin >= aMin && bMax <= aMax || (aMax >= bMin && aMax <= bMax) || (bMax >= aMin && bMax <= aMax);
    return aMin === bMin && aMax === bMax;
  }
  function technicalSignature(definitions, category, values){
    const params = normalizeParamValues(values || {}, definitions, category);
    return fieldsForCategory(definitions, category).filter((field)=> field.keyFeature).map((field)=> field.key + '=' + paramValueText(field, params[field.key], { withUnit:false })).join('|');
  }
  function sheetNameForCategory(category){
    const key = safeKey(category) || 'inne';
    return ('Okucia_' + key).slice(0, 31);
  }
  function columnKeyForField(field){ return safeKey(field && field.key); }
  function rangeColumnKeys(field){ return { from:columnKeyForField(field) + '_od', to:columnKeyForField(field) + '_do' }; }

  FC.hardwareTechnicalParams = {
    DEFAULT_DEFINITIONS,
    DEFAULT_COMPARE_MODES,
    DEFAULT_FIELD_TYPES,
    FIELD_HELP,
    safeKey,
    normalizeDefinition,
    normalizeDefinitions,
    fieldsForCategory,
    normalizeParamValue,
    normalizeParamValues,
    paramValueText,
    buildTypeLabel,
    legacyParamValues,
    mergeLegacyValues,
    applyLegacyFieldsFromParams,
    compareParam,
    technicalSignature,
    sheetNameForCategory,
    columnKeyForField,
    rangeColumnKeys,
    scalarText:text,
  };
})();

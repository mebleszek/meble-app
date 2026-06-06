// js/app/catalog/hardware-technical-params.js
// Dynamiczne parametry techniczne okuć: definicje per kategoria, wartości od-do, nazwa techniczna i porównywanie.
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
    { category:'Zawiasy', key:'rola_kompletu', label:'Rola w komplecie zawiasowym', fieldType:'text', unit:'', options:['komplet zawiasowy','zawias'], keyFeature:true, typePart:false, compareMode:'equal', order:5, active:true },
    { category:'Zawiasy', key:'system_kompatybilnosci', label:'System kompatybilności', fieldType:'text', unit:'', options:['CLIP top','MODUL','GTV clip-on','GTV euro','uniwersalny euro'], keyFeature:true, typePart:false, compareMode:'equal', order:8, active:true },
    { category:'Zawiasy', key:'nalozenie', label:'Nałożenie', fieldType:'text', unit:'', options:['nakładany','półnakładany / bliźniaczy','wpuszczany','równoległy wpuszczany','lodówkowy nakładany'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true },
    { category:'Zawiasy', key:'kat_rzeczywisty', label:'Kąt rzeczywisty / nominalny', fieldType:'numberRange', unit:'°', options:[], keyFeature:false, typePart:true, compareMode:'ignore', order:20, active:true, legacyField:'kat_otwarcia' },
    { category:'Zawiasy', key:'klasa_kata', label:'Klasa / zakres zamienności kąta', fieldType:'text', unit:'', options:['standardowy 90–120°','zerowy uskok 155°','narożny 170°','równoległy wpuszczany 95°','lodówkowy 95°'], keyFeature:true, typePart:true, compareMode:'equal', order:25, active:true },
    { category:'Zawiasy', key:'hamulec', label:'Hamulec / domyk', fieldType:'boolean', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', order:30, active:true },
    { category:'Zawiasy', key:'sprezyna', label:'Sprężyna', fieldType:'boolean', unit:'', options:[], keyFeature:true, typePart:false, compareMode:'equal', order:40, active:true },
    { category:'Zawiasy', key:'typ_prowadnika', label:'Wymagany typ prowadnika', fieldType:'text', unit:'', options:['standardowy','podwyższony 3','lodówkowy','specjalny'], keyFeature:true, typePart:false, compareMode:'equal', order:50, active:true, legacyField:'prowadnik' },
    { category:'Zawiasy', key:'forma_prowadnika', label:'Wymagana forma prowadnika', fieldType:'text', unit:'', options:['krzyżowy','prosty'], keyFeature:true, typePart:false, compareMode:'equal', order:55, active:true },
    { category:'Zawiasy', key:'pokrycie_prowadnika', label:'Pokrycie prowadnika', fieldType:'text', unit:'', options:['w komplecie','osobno','bez prowadnika'], keyFeature:false, typePart:false, compareMode:'ignore', order:60, active:true },

    { category:'Prowadniki', key:'rola_kompletu', label:'Rola w komplecie zawiasowym', fieldType:'text', unit:'', options:['prowadnik'], keyFeature:true, typePart:false, compareMode:'equal', order:5, active:true },
    { category:'Prowadniki', key:'system_kompatybilnosci', label:'System kompatybilności', fieldType:'text', unit:'', options:['CLIP top','MODUL','GTV clip-on','GTV euro','uniwersalny euro'], keyFeature:true, typePart:false, compareMode:'equal', order:10, active:true },
    { category:'Prowadniki', key:'typ_prowadnika', label:'Typ prowadnika', fieldType:'text', unit:'', options:['standardowy','podwyższony 3','lodówkowy','specjalny'], keyFeature:true, typePart:true, compareMode:'equal', order:20, active:true },
    { category:'Prowadniki', key:'forma_prowadnika', label:'Forma prowadnika', fieldType:'text', unit:'', options:['krzyżowy','prosty'], keyFeature:true, typePart:true, compareMode:'equal', order:30, active:true },

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
    options:'Dozwolone wartości dla pola typu tekst/wybór. Wpisz krótkie, konsekwentne opcje rozdzielone średnikiem, np. M; N; H albo lewa; prawa; uniwersalna. Jeżeli parametr ma dozwolone wartości, formularz okucia pokaże wybór z listy aplikacyjnej zamiast zwykłego wpisywania tekstu. Nie dubluj tego samego znaczenia różnymi nazwami, np. lewa, lewy, L. Wybierz jedną wersję i trzymaj się jej w całym katalogu. Starsze wartości spoza tej listy nie będą automatycznie dopasowywane — pole w formularzu będzie puste i trzeba będzie wybrać jedną z wartości słownika. Dla zawiasów „Klasa / zakres zamienności kąta” ma być wybierana ze słownika, a nie wpisywana ręcznie.',
    keyFeature:'Zaznacz, jeśli parametr ma być używany przy porównaniu, doborze zamienników i automatycznej wycenie. Przykład: długość prowadnicy 500 mm musi pasować do 500 mm.',
    typePart:'Zaznacz, jeśli parametr ma budować Nazwę techniczną widoczną pod nazwą katalogową. Ta nazwa jest podglądem dla człowieka; porównanie opiera się na parametrach oznaczonych „Użyj do porównania”.',
    compareMode:'Określa, jak program będzie porównywał parametr przy zamianie producenta: dokładnie, przez zakres albo przez minimalną wartość.',
    rola_kompletu:'Określa, czy pozycja pokrywa cały komplet zawiasowy, jest samym zawiasem albo osobnym prowadnikiem. WYCENA może dzięki temu kupić gotowy komplet albo złożyć go z zawiasu i prowadnika.',
    system_kompatybilnosci:'Jawna nazwa systemu, po której wolno parować zawias z osobnym prowadnikiem, np. CLIP top albo GTV clip-on. Nie ma osobnego słownika zgodności — program porównuje tę samą wpisaną/wybraną wartość po obu stronach.',
    typ_prowadnika:'Typ prowadnika wymagany przez zawias albo oferowany przez osobny prowadnik, np. standardowy, podwyższony 3, lodówkowy. Zerowy uskok nie jest cechą prowadnika — to cecha zawiasu.',
    forma_prowadnika:'Forma prowadnika, np. krzyżowy albo prosty. Przy składaniu kompletu z osobnego zawiasu i prowadnika WYCENA paruje tylko tę samą formę.',
    pokrycie_prowadnika:'Informacja, czy prowadnik jest w gotowym komplecie, ma być kupiony osobno albo nie jest wymagany. To nie jest typ prowadnika.',
    valueFrom:'Wpisz dokładną wartość albo początek zakresu. Jeśli pole „do” zostawisz puste, program traktuje tę wartość jako dokładną.',
    valueTo:'Wypełnij tylko wtedy, gdy parametr jest zakresem, np. szerokość 600–830 mm. Dla zawiasów zakres zamienności kąta nie jest już wpisywany w polu od–do; wybiera się klasę zamienności ze słownika, a kąt rzeczywisty wpisuje jako nominalną liczbę.',
    exact:'Dokładna wartość: pole „od” wypełnione, pole „do” puste. Przykład: prowadnica 500 mm.',
    range:'Zakres: wypełnione pola „od” i „do”. Przykład: zawias 90–110° albo pantograf 600–830 mm.',
    equal:'Zamiennik musi mieć identyczną wartość. Dobre dla długości prowadnic albo szerokości korpusu.',
    withinRange:'Zamiennik musi obejmować wymaganą wartość albo cały wymagany zakres. Przykład: zawias 90–120° może zastąpić wymaganie 100–110°, ale zakres 100–120° nie zastąpi 90–110°.',
    rangeOverlap:'Zakres zamiennika i zakres wymagania muszą mieć część wspólną. To luźniejsze dopasowanie niż „mieści się w zakresie”.',
    minGte:'Zamiennik musi mieć minimum taką samą lub większą wartość. Dobre dla nośności: 50 kg może zastąpić 30 kg, ale nie odwrotnie.',
    ignore:'Parametr zapisuje się informacyjnie, ale nie blokuje zamiany producenta.',
  };

  try{ if(FC.helpRegistry && typeof FC.helpRegistry.registerMany === 'function') FC.helpRegistry.registerMany(FIELD_HELP, { prefix:'hardwareTech.' }); }catch(_){ }

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
    return text(value).toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || '';
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
  function normalizeHingeOverlayOptions(list){
    const base = ['nakładany','półnakładany / bliźniaczy','wpuszczany','równoległy wpuszczany','lodówkowy nakładany'];
    const mapLegacy = {
      'równoległy / do ślepego narożnika':'równoległy wpuszczany',
      'rownolegly / do slepego naroznika':'równoległy wpuszczany',
      'lodówkowy':'lodówkowy nakładany',
      'lodowkowy':'lodówkowy nakładany'
    };
    const seen = new Set();
    const out = [];
    function push(value){
      const raw = text(value);
      if(!raw) return;
      const normalizedKey = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mapped = mapLegacy[raw.toLowerCase()] || mapLegacy[normalizedKey] || raw;
      const key = mapped.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if(!mapped || seen.has(key)) return;
      seen.add(key);
      out.push(mapped);
    }
    base.forEach(push);
    (Array.isArray(list) ? list : []).forEach(push);
    return out;
  }

  function normalizeHingeAngleClassOptions(list){
    const base = ['standardowy 90–120°','zerowy uskok 155°','narożny 170°','równoległy wpuszczany 95°','lodówkowy 95°'];
    const seen = new Set();
    const out = [];
    function push(value){
      const raw = text(value);
      if(!raw) return;
      const key = safeKey(raw);
      if(seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    }
    base.forEach(push);
    (Array.isArray(list) ? list : []).forEach(push);
    return out;
  }
  function hingeAngleNumberFromParams(values){
    const src = values && typeof values === 'object' ? values : {};
    const direct = src.kat_rzeczywisty;
    const legacy = src.kat_otwarcia;
    const raw = direct != null ? direct : legacy;
    if(raw && typeof raw === 'object'){
      if(text(raw.value)) return number(raw.value);
      if(text(raw.from)) return number(raw.from);
      if(text(raw.to)) return number(raw.to);
    }
    return number(raw);
  }
  function inferHingeAngleClass(values){
    const src = values && typeof values === 'object' ? values : {};
    const overlay = safeKey(src.nalozenie && typeof src.nalozenie === 'object' ? src.nalozenie.value : src.nalozenie).replace(/_/g, ' ');
    const plate = safeKey(src.prowadnik && typeof src.prowadnik === 'object' ? src.prowadnik.value : src.prowadnik).replace(/_/g, ' ');
    const angle = hingeAngleNumberFromParams(src);
    if(overlay === 'rownolegly wpuszczany') return 'równoległy wpuszczany 95°';
    if(overlay === 'lodowkowy nakladany') return 'lodówkowy 95°';
    if(overlay === 'nakladany' && (angle >= 165 || plate === 'specjalny')) return 'narożny 170°';
    if(angle >= 150 && angle < 165) return 'zerowy uskok 155°';
    if(angle >= 80 && angle <= 130) return 'standardowy 90–120°';
    if(angle >= 165) return 'narożny 170°';
    return '';
  }

  function hasOwn(obj, key){ return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }
  function firstPresent(src, keys){
    for(let i = 0; i < keys.length; i += 1){
      if(hasOwn(src, keys[i])) return src[keys[i]];
    }
    return undefined;
  }
  function explicitYesNo(value){
    const raw = text(value).toLowerCase();
    if(['nie','false','0','no','n'].includes(raw)) return false;
    if(['tak','true','1','yes','y'].includes(raw)) return true;
    return null;
  }
  function boolFromPresent(value, fallback){
    const yn = explicitYesNo(value);
    if(yn != null) return yn;
    if(value === false) return false;
    if(value === true) return true;
    return fallback;
  }
  function assignDefaultValue(current, explicit, value){ return explicit ? current : value; }
  function normalizeDefinition(row, index){
    const src = row && typeof row === 'object' ? row : {};
    const category = text(src.category || src.hardwareCategory || src.kategoria);
    const label = text(src.label || src.name || src.nazwa);
    const key = safeKey(src.key || src.klucz || label);
    const catKey = safeKey(category);
    const keyFeatureRaw = firstPresent(src, ['keyFeature','compareKey','cechaKluczowa','uzyj_do_porownania','cecha_kluczowa']);
    const typePartRaw = firstPresent(src, ['typePart','budujeNazweTechniczna','buduje_nazwe_techniczna','tworzyTyp','tworzy_typ']);
    const compareRaw = firstPresent(src, ['compareMode','sposob_porownania','porownanie']);
    const activeRaw = firstPresent(src, ['active','aktywny']);
    const hasKeyFeature = keyFeatureRaw !== undefined;
    const hasTypePart = typePartRaw !== undefined;
    const hasCompareMode = compareRaw !== undefined && text(compareRaw) !== '';
    const hasActive = activeRaw !== undefined;
    const hasOrder = src.order != null || src.kolejnosc != null;
    let fieldType = normalizeFieldType(src.fieldType || src.typ_pola || src.type);
    let unit = text(src.unit || src.jednostka);
    let options = optionsFrom(src.options || src.wartosci);
    let keyFeature = hasKeyFeature ? boolFromPresent(keyFeatureRaw, false) : !!(src.typePart || src.budujeNazweTechniczna || src.tworzyTyp);
    let typePart = hasTypePart ? boolFromPresent(typePartRaw, false) : (hasKeyFeature ? !!keyFeature : true);
    let compareMode = normalizeCompareMode(compareRaw);
    let order = Number(src.order != null ? src.order : src.kolejnosc) || (index + 1) * 10;
    let active = hasActive ? boolFromPresent(activeRaw, true) : true;
    let legacyField = text(src.legacyField || src.legacy_field);
    let finalLabel = label || key;

    if(catKey === 'zawiasy' && key === 'nalozenie'){
      options = normalizeHingeOverlayOptions(options);
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, true); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 10);
    }
    if(catKey === 'zawiasy' && key === 'kat_rzeczywisty'){
      finalLabel = label || 'Kąt rzeczywisty / nominalny';
      fieldType = 'numberRange'; unit = '°'; options = [];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, false); typePart = assignDefaultValue(typePart, hasTypePart, true); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'ignore'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 20); legacyField = legacyField || 'kat_otwarcia';
    }
    if(catKey === 'zawiasy' && key === 'klasa_kata'){
      finalLabel = label || 'Klasa / zakres zamienności kąta';
      fieldType = 'text'; unit = ''; options = normalizeHingeAngleClassOptions(options);
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, true); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 25);
    }
    if(catKey === 'zawiasy' && key === 'kat_otwarcia'){
      finalLabel = 'Kąt otwarcia — legacy';
      fieldType = 'numberRange'; unit = '°'; options = [];
      keyFeature = false; typePart = false; compareMode = 'ignore'; active = false; order = 26;
    }
    if(catKey === 'zawiasy' && key === 'typ_prowadnika'){
      finalLabel = label || 'Wymagany typ prowadnika';
      options = options.length ? options : ['standardowy','podwyższony 3','lodówkowy','specjalny'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 50); legacyField = legacyField || 'prowadnik';
    }
    if(catKey === 'zawiasy' && key === 'forma_prowadnika'){
      finalLabel = label || 'Wymagana forma prowadnika';
      options = options.length ? options : ['krzyżowy','prosty'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 55);
    }
    if(catKey === 'zawiasy' && key === 'pokrycie_prowadnika'){
      finalLabel = label || 'Pokrycie prowadnika';
      options = options.length ? options : ['w komplecie','osobno','bez prowadnika'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, false); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'ignore'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 60);
    }
    if(catKey === 'zawiasy' && key === 'prowadnik'){
      finalLabel = 'Prowadnik / montaż — legacy';
      options = options.length ? options : ['standardowy','specjalny','osobno'];
      keyFeature = false; typePart = false; compareMode = 'ignore'; active = false; order = 65;
    }
    if(catKey === 'zawiasy' && key === 'rola_kompletu'){
      finalLabel = label || 'Rola w komplecie zawiasowym';
      options = options.length ? options : ['komplet zawiasowy','zawias'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 5);
    }
    if(catKey === 'zawiasy' && key === 'system_kompatybilnosci'){
      finalLabel = label || 'System kompatybilności';
      options = options.length ? options : ['CLIP top','MODUL','GTV clip-on','GTV euro','uniwersalny euro'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 8);
    }
    if(catKey === 'prowadniki' && key === 'rola_kompletu'){
      finalLabel = label || 'Rola w komplecie zawiasowym';
      options = options.length ? options : ['prowadnik'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 5);
    }
    if(catKey === 'prowadniki' && key === 'system_kompatybilnosci'){
      finalLabel = label || 'System kompatybilności';
      options = options.length ? options : ['CLIP top','MODUL','GTV clip-on','GTV euro','uniwersalny euro'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, false); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 10);
    }
    if(catKey === 'prowadniki' && key === 'typ_prowadnika'){
      finalLabel = label || 'Typ prowadnika';
      options = options.length ? options : ['standardowy','podwyższony 3','lodówkowy','specjalny'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, true); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 20);
    }
    if(catKey === 'prowadniki' && key === 'forma_prowadnika'){
      finalLabel = label || 'Forma prowadnika';
      options = options.length ? options : ['krzyżowy','prosty'];
      keyFeature = assignDefaultValue(keyFeature, hasKeyFeature, true); typePart = assignDefaultValue(typePart, hasTypePart, true); compareMode = assignDefaultValue(compareMode, hasCompareMode, 'equal'); active = assignDefaultValue(active, hasActive, true); order = assignDefaultValue(order, hasOrder, 30);
    }

    return {
      id:text(src.id) || (safeKey(category) + '_' + key),
      category,
      key,
      label:finalLabel,
      fieldType,
      unit,
      options,
      keyFeature,
      typePart,
      compareMode,
      order,
      active,
      legacyField,
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
  function choiceOptionsForField(field){
    return Array.isArray(field && field.options) ? field.options.map(text).filter(Boolean) : [];
  }
  function normalizeChoiceValue(field, rawValue){
    const raw = text(rawValue);
    if(!raw) return '';
    const options = choiceOptionsForField(field);
    if(!options.length) return raw;
    return options.some((option)=> option === raw) ? raw : '';
  }
  function normalizeParamValue(field, raw){
    const src = raw && typeof raw === 'object' ? raw : { value:raw };
    if(!field) return { value:text(src.value) };
    if(field.fieldType === 'boolean'){
      const rawValue = src.value != null ? src.value : (src.checked != null ? src.checked : raw);
      if(rawValue == null || text(rawValue) === '') return { value:'' };
      return { value:!!(rawValue === true || bool(rawValue) || src.checked === true) };
    }
    if(field.fieldType === 'numberRange'){
      const fromRaw = src.from != null ? src.from : (src.value != null ? src.value : src.od);
      const toRaw = src.to != null ? src.to : src.do;
      const from = text(fromRaw) === '' ? '' : number(fromRaw);
      const to = text(toRaw) === '' ? '' : number(toRaw);
      return { from, to };
    }
    return { value:normalizeChoiceValue(field, src.value != null ? src.value : src) };
  }
  function normalizeParamValues(values, definitions, category){
    const src = values && typeof values === 'object' ? values : {};
    const out = {};
    const fields = fieldsForCategory(definitions, category);
    fields.forEach((field)=>{
      const raw = src[field.key] != null ? src[field.key] : src[field.legacyField];
      const val = normalizeParamValue(field, raw);
      if((field.fieldType === 'boolean' && val.value !== '') || text(val.value) || text(val.from) || text(val.to)) out[field.key] = val;
    });
    if(safeKey(category) === 'zawiasy'){
      if(!out.kat_rzeczywisty && src.kat_otwarcia != null){
        const field = fields.find((row)=> row.key === 'kat_rzeczywisty') || normalizeDefinition({ category:'Zawiasy', key:'kat_rzeczywisty', label:'Kąt rzeczywisty / nominalny', fieldType:'numberRange', unit:'°' }, 0);
        const val = normalizeParamValue(field, src.kat_otwarcia);
        if(text(val.from) || text(val.to)) out.kat_rzeczywisty = val;
      }
      if(!out.typ_prowadnika && src.prowadnik != null){
        const field = fields.find((row)=> row.key === 'typ_prowadnika') || normalizeDefinition({ category:'Zawiasy', key:'typ_prowadnika', label:'Wymagany typ prowadnika', fieldType:'text', options:['standardowy','podwyższony 3','lodówkowy','specjalny'] }, 0);
        const val = normalizeParamValue(field, src.prowadnik);
        if(text(val.value)) out.typ_prowadnika = val;
      }
      if(!text(out.klasa_kata && out.klasa_kata.value)){
        const inferred = inferHingeAngleClass(Object.assign({}, src, out));
        if(inferred) out.klasa_kata = { value:inferred };
      }
    }
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
    if(field.compareMode === 'withinRange') return bMin <= aMin && bMax >= aMax;
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

  function paramHasValue(field, value){
    const val = normalizeParamValue(field, value || {});
    if(field.fieldType === 'boolean') return val.value === true || val.value === false;
    if(field.fieldType === 'numberRange') return text(val.from) !== '' || text(val.to) !== '';
    return text(val.value) !== '';
  }
  function requiredFieldsForTechnicalStatus(definitions, category){
    const catKey = safeKey(category);
    return fieldsForCategory(definitions, category).filter((field)=>{
      if(!field || field.active === false) return false;
      if(catKey === 'zawiasy' && field.key === 'kat_rzeczywisty') return true;
      if(catKey === 'zawiasy' && field.key === 'pokrycie_prowadnika') return true;
      if(field.compareMode === 'ignore') return false;
      return field.keyFeature !== false;
    });
  }
  function evaluateItemTechnicalStatus(item, definitions){
    const row = item && typeof item === 'object' ? item : {};
    const category = text(row.hardwareCategory || row.category || row.kategoria || '');
    const defs = definitions && Array.isArray(definitions) ? definitions : DEFAULT_DEFINITIONS;
    const fields = requiredFieldsForTechnicalStatus(defs, category);
    const explicit = row.technicalParams && typeof row.technicalParams === 'object' ? row.technicalParams : {};
    const normalized = mergeLegacyValues(row, defs, category || 'Inne');
    const missing = [];
    let filled = 0;
    fields.forEach((field)=>{
      let raw = explicit[field.key] != null ? explicit[field.key] : (field.legacyField && row[field.legacyField] != null ? row[field.legacyField] : undefined);
      const has = paramHasValue(field, raw);
      if(has) filled += 1;
      else missing.push({ key:field.key, label:text(field.label || field.key), category, fieldType:field.fieldType || '' });
    });
    const required = fields.length;
    const code = !required ? 'noDefinition' : (missing.length === required ? 'missing' : (missing.length ? 'incomplete' : 'ok'));
    const label = code === 'ok' ? 'Dane tech. OK' : (code === 'noDefinition' ? 'Brak definicji tech.' : (code === 'missing' ? 'Brak danych tech.' : 'Niepełne dane tech.'));
    return {
      code,
      label,
      ok:code === 'ok' || code === 'noDefinition',
      needsAttention:code === 'missing' || code === 'incomplete',
      required,
      filled,
      missing,
      category,
    };
  }

  FC.hardwareTechnicalParams = {
    DEFAULT_DEFINITIONS,
    DEFAULT_COMPARE_MODES,
    DEFAULT_FIELD_TYPES,
    FIELD_HELP,
    safeKey,
    normalizeDefinition,
    normalizeDefinitions,
    fieldsForCategory,
    choiceOptionsForField,
    normalizeChoiceValue,
    normalizeParamValue,
    normalizeParamValues,
    paramValueText,
    buildTypeLabel,
    buildTechnicalName:buildTypeLabel,
    legacyParamValues,
    mergeLegacyValues,
    applyLegacyFieldsFromParams,
    compareParam,
    technicalSignature,
    sheetNameForCategory,
    columnKeyForField,
    rangeColumnKeys,
    requiredFieldsForTechnicalStatus,
    evaluateItemTechnicalStatus,
    scalarText:text,
  };
})();

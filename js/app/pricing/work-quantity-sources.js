(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const SYSTEM_SOURCES = [
    {
      code:'cabinet.count',
      label:'Liczba korpusów',
      unit:'szt.',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'1 dla zwykłej szafki/korpusu, 0 dla pozycji bez korpusu. Wartość ma wynikać z typu pozycji w WYWIADZIE.',
    },
    {
      code:'cabinet.width_mm',
      label:'Szerokość korpusu',
      unit:'mm',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'Z pola szerokości szafki w WYWIADZIE. Nie jest drugim zapisem danych, tylko nazwanym odczytem istniejącego wymiaru.',
    },
    {
      code:'cabinet.height_mm',
      label:'Wysokość korpusu',
      unit:'mm',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'Z pola wysokości szafki w WYWIADZIE. Może później służyć jako próg dla czynności, np. skręcenia korpusu według wysokości.',
    },
    {
      code:'cabinet.depth_mm',
      label:'Głębokość korpusu',
      unit:'mm',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'Z pola głębokości szafki w WYWIADZIE. To źródło opisuje istniejący wymiar, bez tworzenia kopii w danych szafki.',
    },
    {
      code:'cabinet.volume_m3',
      label:'Objętość korpusu',
      unit:'m³',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'Wyliczane na żądanie z szerokości × wysokości × głębokości aktualnej szafki. Nie jest zapisywane jako drugie pole w szafce.',
    },
    {
      code:'cabinet.weight_kg',
      label:'Orientacyjna waga korpusu',
      unit:'kg',
      group:'Korpus i wymiary',
      status:'system',
      calculation:'Wyliczana na żądanie z centralnej listy formatek korpusu. Do wnoszenia brany jest sam korpus: bez frontów, półek luźnych, blend, cokołów i okuć.',
    },
    {
      code:'carrying.floor_units',
      label:'Poziomy wnoszenia korpusu',
      unit:'poziom',
      group:'Wnoszenie i logistyka',
      status:'system',
      calculation:'Wynik dla konkretnej szafki: parter liczy się jako 1 poziom, piętro + 1 przy schodach, a gdy korpus mieści się do windy — 2 poziomy.',
    },
    {
      code:'carrying.people_count',
      label:'Liczba osób do wnoszenia',
      unit:'os.',
      group:'Wnoszenie i logistyka',
      status:'system',
      calculation:'1 pomocnik dla lekkiego korpusu do 20 kg, 2 pomocników dla cięższego. To mnożnik robocizny, nie nowy zapis w szafce.',
    },
    {
      code:'carrying.stairs_item_count',
      label:'Elementy po schodach po rozkręceniu',
      unit:'szt.',
      group:'Wnoszenie i logistyka',
      status:'system',
      calculation:'Dla rozkręconego korpusu: liczba dużych elementów, które nie weszły do windy nawet po sprawdzeniu przekątnej drzwi/kabiny. Dla całego korpusu zwykle 1.',
    },
    {
      code:'carrying.requires_disassembly',
      label:'Wymaga rozkręcenia do wnoszenia',
      unit:'0/1',
      group:'Wnoszenie i logistyka',
      status:'system',
      calculation:'1, gdy korpus jest zbyt ciężki do wnoszenia po schodach w całości według progu roboczego. Zasila osobny automat rozkręcenia/składania.',
    },
    {
      code:'carrying.lift_fits',
      label:'Korpus mieści się do windy',
      unit:'0/1',
      group:'Wnoszenie i logistyka',
      status:'system',
      calculation:'1, gdy jakaś para wymiarów przechodzi przez drzwi windy, a trzeci wymiar mieści się w głębokości windy.',
    },
    {
      code:'cabinet.zone',
      label:'Strefa szafki',
      unit:'tekst',
      group:'Klasyfikacja szafki',
      status:'system',
      calculation:'Z typu/strefy szafki w WYWIADZIE, np. dolna, górna/wisząca, wysoka. Służy później jako warunek, nie jako ilość.',
    },
    {
      code:'cabinet.kind',
      label:'Typ szafki',
      unit:'tekst',
      group:'Klasyfikacja szafki',
      status:'system',
      calculation:'Z wybranego wariantu szafki w WYWIADZIE, np. standardowa, narożna, AGD, lodówkowa. Służy później jako warunek.',
    },
    {
      code:'front.count',
      label:'Liczba frontów',
      unit:'szt.',
      group:'Fronty i zawiasy',
      status:'system',
      calculation:'Z pola liczby frontów albo wariantu frontów w szafce. To źródło ma zasilać czynności typu montaż frontu.',
    },
    {
      code:'front.dimensions',
      label:'Wymiary frontów',
      unit:'cm',
      group:'Fronty i zawiasy',
      status:'system',
      calculation:'Odczytywane na żądanie z tego samego centralnego źródła frontów, którego używają MATERIAŁ/WYCENA. Nie tworzy osobnej listy frontów.',
    },
    {
      code:'front.area_m2',
      label:'Powierzchnia frontów',
      unit:'m²',
      group:'Fronty i zawiasy',
      status:'system',
      calculation:'Wyliczana na żądanie z wymiarów frontów z centralnego źródła MATERIAŁ/WYCENA.',
    },
    {
      code:'hinge.count',
      label:'Liczba zawiasów',
      unit:'szt.',
      group:'Fronty i zawiasy',
      status:'system',
      calculation:'Z centralnych wymagań technicznych zawiasów dla frontów szafki. To źródło ma zasilać np. regulację zawiasów.',
    },
    {
      code:'hinge.requirement',
      label:'Wymaganie zawiasu',
      unit:'tekst',
      group:'Fronty i zawiasy',
      status:'system',
      calculation:'Z panelu „Wymagania techniczne do wyceny”. Opisuje typ/cechy zawiasu i może później działać jako warunek doboru czynności.',
    },
    {
      code:'shelf.count',
      label:'Liczba półek',
      unit:'szt.',
      group:'Wnętrze szafki',
      status:'system',
      calculation:'Z pola półek w szafce. To źródło ma zasilać czynności typu montaż półek.',
    },
    {
      code:'drawer.count',
      label:'Liczba szuflad',
      unit:'szt.',
      group:'Wnętrze szafki',
      status:'system',
      calculation:'Odczytywane z jawnych wymagań szuflad/prowadnic szafki. Stare pola typu drawerCount nie są źródłem prawdy.',
    },
    {
      code:'appliance.count',
      label:'Liczba AGD',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'Z typu szafki/AGD w WYWIADZIE i ustawienia, czy montaż AGD jest w zakresie. To źródło nie zmienia obecnego liczenia AGD.',
    },
    {
      code:'appliance.type',
      label:'Typ AGD',
      unit:'tekst',
      group:'Montaż AGD',
      status:'system',
      calculation:'Z wybranego rodzaju AGD, np. zmywarka, lodówka, piekarnik, płyta, okap, mikrofala, pralka, suszarka. Służy jako warunek dla osobnych automatów AGD.',
    },
    {
      code:'appliance.dishwasher.count',
      label:'Zmywarka do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 tylko dla szafki zmywarkowej z włączonym montażem AGD. Zasila osobny automat dishwasher_mount.',
    },
    {
      code:'appliance.fridge.count',
      label:'Lodówka do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 tylko dla lodówki w zabudowie z włączonym montażem AGD. Zasila osobny automat fridge_mount.',
    },
    {
      code:'appliance.oven.count',
      label:'Piekarnik do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 tylko dla szafki piekarnikowej z włączonym montażem AGD. Zasila osobny automat oven_mount.',
    },
    {
      code:'appliance.hob.count',
      label:'Płyta indukcyjna / ceramiczna',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 tylko dla szafki/pozycji płyty z włączonym montażem AGD. Zasila osobny automat hob_mount.',
    },
    {
      code:'appliance.hood_under_cabinet.count',
      label:'Okap podszafkowy / teleskopowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla okapu podszafkowego/teleskopowego z włączonym montażem AGD. Zasila osobny automat hood_under_cabinet_mount.',
    },
    {
      code:'appliance.hood_chimney.count',
      label:'Okap kominowy / wyspowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla okapu kominowego/wyspowego z włączonym montażem AGD. Zasila osobny automat hood_chimney_mount.',
    },
    {
      code:'appliance.microwave.count',
      label:'Mikrofala do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 tylko dla szafki/pozycji mikrofali z włączonym montażem AGD. Zasila osobny automat microwave_mount.',
    },
    {
      code:'appliance.washer.count',
      label:'Pralka do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla pralki do zabudowy z włączonym montażem AGD. Zasila osobny automat washer_mount.',
    },
    {
      code:'appliance.dryer.count',
      label:'Suszarka do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla suszarki do zabudowy z włączonym montażem AGD. Zasila osobny automat dryer_mount.',
    },
    {
      code:'appliance.coffee_machine.count',
      label:'Ekspres do zabudowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla ekspresu do zabudowy z włączonym montażem AGD. Zasila osobny automat coffee_machine_mount.',
    },
    {
      code:'appliance.warming_drawer.count',
      label:'Podgrzewacz szufladowy',
      unit:'szt.',
      group:'Montaż AGD',
      status:'system',
      calculation:'1 dla podgrzewacza szufladowego z włączonym montażem AGD. Zasila osobny automat warming_drawer_mount.',
    },
    {
      code:'transport.distance_km',
      label:'Kilometry transportu do wyceny',
      unit:'km',
      group:'Transport',
      status:'system',
      calculation:'Z odległości zapisanej przy inwestorze oraz zasad transportu z trybika. To źródło służy pozycji Transport w WYCENIE, nie jest daną pojedynczej szafki.',
    },
    {
      code:'worktop.length_m',
      label:'Długość blatu',
      unit:'mb',
      group:'Przyszłe źródła liniowe',
      status:'planned',
      calculation:'Docelowo z danych blatu/projektu. Na tym etapie to tylko nazwana definicja pod późniejsze czynności.',
    },
    {
      code:'plinth.length_m',
      label:'Długość cokołu',
      unit:'mb',
      group:'Przyszłe źródła liniowe',
      status:'planned',
      calculation:'Docelowo z danych cokołów/projektu. Nie wynika automatycznie z jednostki mb w cenniku.',
    },
    {
      code:'cutout.count',
      label:'Liczba wycięć',
      unit:'szt.',
      group:'Przyszłe źródła nietypowe',
      status:'planned',
      calculation:'Docelowo z kreatora nietypowych korpusów albo pól roboczych. Na tym etapie nie jest jeszcze liczone z obecnych szafek.',
    },
    {
      code:'routing.count',
      label:'Liczba frezowań',
      unit:'szt.',
      group:'Przyszłe źródła nietypowe',
      status:'planned',
      calculation:'Docelowo z kreatora nietypowych korpusów albo pól roboczych. Przykład: frezowanie pod LED lub nietypowy otwór.',
    },
  ];

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function text(value){ return String(value == null ? '' : value).trim(); }

  function normalizeSource(source){
    const src = source && typeof source === 'object' ? source : {};
    return {
      code:text(src.code),
      label:text(src.label),
      unit:text(src.unit || '—') || '—',
      group:text(src.group || 'Inne') || 'Inne',
      status:text(src.status || 'system') || 'system',
      calculation:text(src.calculation),
      system:true,
      active:true,
    };
  }

  function list(){
    return SYSTEM_SOURCES.map(normalizeSource).filter((row)=> row.code && row.label);
  }

  function find(code){
    const key = text(code);
    return list().find((row)=> row.code === key) || null;
  }

  function groupByCategory(){
    return list().reduce((acc, row)=>{
      const key = row.group || 'Inne';
      if(!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }

  function statusLabel(status){
    const value = text(status);
    if(value === 'planned') return 'planowane';
    if(value === 'user') return 'użytkownika';
    return 'systemowe';
  }

  function isNumericSource(row){
    const unit = text(row && row.unit).toLowerCase();
    if(!unit || unit === 'tekst') return false;
    return !['front.dimensions','hinge.requirement','cabinet.zone','cabinet.kind','appliance.type'].includes(text(row && row.code));
  }

  function canUseAsQuantitySource(source){
    const row = normalizeSource(source);
    if(!row.code || row.status === 'planned' || row.active === false) return false;
    return isNumericSource(row);
  }

  function canUseAsConditionSource(source){
    const row = normalizeSource(source);
    if(!row.code || row.status === 'planned' || row.active === false) return false;
    return isNumericSource(row);
  }

  function quantityList(selectedCode){
    const selected = text(selectedCode);
    const rows = list().filter(canUseAsQuantitySource);
    if(selected && !rows.some((row)=> row.code === selected)){
      const current = find(selected);
      rows.push(current || { code:selected, label:selected, unit:'—', group:'Nieaktywne', status:'legacy', calculation:'Zapisane wcześniej źródło ilości, którego nie ma na aktywnej liście.' });
    }
    return rows;
  }

  function quantityOptions(selectedCode){
    return [{ value:'', label:'Brak przypisanego źródła', description:'Czynność nie ma jeszcze wskazanego źródła ilości. Obecne liczenie WYCENY pozostaje bez zmian.' }]
      .concat(quantityList(selectedCode).map((row)=> ({
        value:row.code,
        label:`${row.label} — ${row.code}${row.unit && row.unit !== '—' ? ' (' + row.unit + ')' : ''}`,
        description:row.calculation || ''
      })));
  }

  function conditionList(selectedCode){
    const selected = text(selectedCode);
    const rows = list().filter(canUseAsConditionSource);
    if(selected && !rows.some((row)=> row.code === selected)){
      const current = find(selected);
      if(current && canUseAsConditionSource(current)) rows.push(current);
    }
    return rows;
  }

  function conditionOptions(selectedCode){
    return [{ value:'', label:'Wybierz wartość warunku', description:'Wybierz aktywne, policzalne źródło danych używane jako warunek zastosowania reguły.' }]
      .concat(conditionList(selectedCode).map((row)=> ({
        value:row.code,
        label:`${row.label} — ${row.code}${row.unit && row.unit !== '—' ? ' (' + row.unit + ')' : ''}`,
        description:row.calculation || ''
      })));
  }

  root.FC.workQuantitySources = {
    list,
    find,
    getSource:find,
    groupByCategory,
    normalizeSource,
    statusLabel,
    canUseAsQuantitySource,
    canUseAsConditionSource,
    quantityList,
    quantityOptions,
    conditionList,
    conditionOptions,
    _debug:{ SYSTEM_SOURCES:clone(SYSTEM_SOURCES) },
  };
})();

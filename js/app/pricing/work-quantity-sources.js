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
      status:'planned',
      calculation:'Docelowo wyliczane z szerokości × wysokości × głębokości. Przydatne np. do wnoszenia lub gabarytowego montażu.',
    },
    {
      code:'cabinet.weight_kg',
      label:'Orientacyjna waga szafki',
      unit:'kg',
      group:'Korpus i wymiary',
      status:'planned',
      calculation:'Docelowo wyliczana z materiałów, wymiarów, frontów i okuć. Na tym etapie to definicja źródła pod przyszłą robociznę.',
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
      unit:'cm / mm',
      group:'Fronty i zawiasy',
      status:'planned',
      calculation:'Docelowo z centralnych obliczeń frontów dla szafki. Ma pokazywać w audycie, jakich frontów dotyczy czynność.',
    },
    {
      code:'front.area_m2',
      label:'Powierzchnia frontów',
      unit:'m²',
      group:'Fronty i zawiasy',
      status:'planned',
      calculation:'Docelowo wyliczana z wymiarów frontów. Może później zasilać czynności lub usługi zależne od powierzchni.',
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
      status:'planned',
      calculation:'Docelowo z danych szuflad w szafce albo przyszłego kreatora korpusu. Na tym etapie nie przebudowuje szuflad.',
    },
    {
      code:'appliance.count',
      label:'Liczba AGD',
      unit:'szt.',
      group:'AGD',
      status:'system',
      calculation:'Z typu szafki/AGD w WYWIADZIE i ustawienia, czy montaż AGD jest w zakresie. To źródło nie zmienia obecnego liczenia AGD.',
    },
    {
      code:'appliance.type',
      label:'Typ AGD',
      unit:'tekst',
      group:'AGD',
      status:'system',
      calculation:'Z wybranego rodzaju AGD, np. zmywarka, lodówka, piekarnik, płyta, okap, mikrofala. Służy jako warunek dla osobnych automatów AGD.',
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

  root.FC.workQuantitySources = {
    list,
    find,
    getSource:find,
    groupByCategory,
    normalizeSource,
    statusLabel,
    _debug:{ SYSTEM_SOURCES:clone(SYSTEM_SOURCES) },
  };
})();

// js/app/pricing/labor-catalog-definitions.js
// Stałe i domyślne definicje robocizny używane przez uniwersalny katalog robocizny.
(function(){
  'use strict';
  window.FC = window.FC || {};

  const RATE_TYPES = [
    { key:'workshop', label:'Warsztatowa', system:true, price:150 },
    { key:'assembly', label:'Montażowa', system:true, price:250 },
    { key:'specialist', label:'Specjalistyczna', system:true, price:300 },
    { key:'helper', label:'Pomocnika', system:true, price:80 },
  ];

  // usage zostaje w modelu wyłącznie jako kompatybilność wsteczna.
  // Nowe czynności są traktowane jako jedna wspólna pula: można je dodać ręcznie w WYCENIE albo przypiąć do szafki.
  const USAGE_TYPES = [
    { key:'universal', label:'Czynność uniwersalna' },
    { key:'manual', label:'Ręcznie w WYCENIE' },
    { key:'cabinet', label:'Szafka — dodatki' },
    { key:'room', label:'Pomieszczenie' },
    { key:'project', label:'Projekt' },
  ];

  // Legacy autoRole zostaje jako kompatybilność dla działającej WYCENY.
  // Nowy trwały klucz automatu to `workAutomatCode` w formacie snake_case.
  const AUTO_ROLES = [
    { key:'none', label:'Brak legacy automatu' },
    { key:'hourlyRate', label:'Stawka godzinowa' },
    { key:'cabinetBody', label:'Skręcenie korpusu wg wysokości' },
    { key:'cabinetLooseShelves', label:'Półki z danych szafki' },
  ];

  const DEFAULT_WORK_AUTOMATS = [
    { code:'cabinet_body', label:'Skręcenie korpusu', description:'Automat robocizny dla skręcenia korpusu szafki. W obecnej WYCENIE działa przez legacy autoRole cabinetBody i progi wysokości.', system:true, active:true },
    { code:'front_mount', label:'Montaż frontu / drzwi', description:'Automat robocizny dla montażu frontów/drzwi. W obecnej WYCENIE liczony bezpiecznie po istniejącym ID stawki labor_mount_front.', system:true, active:true },
    { code:'hinge_mount', label:'Montaż zawiasu', description:'Automat robocizny dla montażu zawiasów. W obecnej WYCENIE liczony bezpiecznie po istniejącym ID stawki labor_mount_hinge.', system:true, active:true },
    { code:'shelf_mount', label:'Montaż półek', description:'Automat robocizny dla półek z danych szafki. W obecnej WYCENIE działa przez legacy autoRole cabinetLooseShelves.', system:true, active:true },
    { code:'dishwasher_mount', label:'Montaż zmywarki', description:'Docelowy automat montażu zmywarki jako osobny typ AGD.', system:true, active:true },
    { code:'fridge_mount', label:'Montaż lodówki do zabudowy', description:'Docelowy automat montażu lodówki do zabudowy jako osobny typ AGD.', system:true, active:true },
    { code:'oven_mount', label:'Montaż piekarnika', description:'Docelowy automat montażu piekarnika jako osobny typ AGD.', system:true, active:true },
    { code:'hob_mount', label:'Montaż płyty', description:'Docelowy automat montażu płyty jako osobny typ AGD.', system:true, active:true },
    { code:'hood_mount', label:'Montaż okapu', description:'Docelowy automat montażu okapu jako osobny typ AGD.', system:true, active:true },
    { code:'microwave_mount', label:'Montaż mikrofali do zabudowy', description:'Docelowy automat montażu mikrofali do zabudowy jako osobny typ AGD.', system:true, active:true },
    { code:'manual_hourly', label:'Ręczna stawka godzinowa', description:'Automat dla ręcznych stawek godzinowych i bazowych stawek robocizny.', system:true, active:true },
    { code:'manual_fixed', label:'Ręczna kwota stała', description:'Automat dla ręcznych pozycji kwotowych bez specjalnej automatyki.', system:true, active:true },
  ];

  const LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT = {
    hourlyRate:'manual_hourly',
    cabinetBody:'cabinet_body',
    cabinetLooseShelves:'shelf_mount',
  };

  const WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE = {
    manual_hourly:'hourlyRate',
    cabinet_body:'cabinetBody',
    shelf_mount:'cabinetLooseShelves',
  };

  const DEFAULT_RATE_ID_TO_WORK_AUTOMAT = {
    labor_rate_workshop:'manual_hourly',
    labor_rate_assembly:'manual_hourly',
    labor_rate_helper:'manual_hourly',
    labor_rate_specialist:'manual_hourly',
    labor_body_h072:'cabinet_body',
    labor_body_h150:'cabinet_body',
    labor_body_h225:'cabinet_body',
    labor_body_h999:'cabinet_body',
    labor_loose_shelves:'shelf_mount',
    labor_mount_front:'front_mount',
    labor_mount_hinge:'hinge_mount',
  };

  const SERVICE_NAME_TO_WORK_AUTOMAT = {
    'zmywarka do zabudowy':'dishwasher_mount',
    'lodowka do zabudowy':'fridge_mount',
    'lodówka do zabudowy':'fridge_mount',
    'piekarnik do zabudowy':'oven_mount',
    'plyta indukcyjna / ceramiczna':'hob_mount',
    'płyta indukcyjna / ceramiczna':'hob_mount',
    'okap podszafkowy / teleskopowy':'hood_mount',
    'mikrofalowka do zabudowy':'microwave_mount',
    'mikrofalówka do zabudowy':'microwave_mount',
  };

  const QUANTITY_MODES = [
    { key:'none', label:'Bez ilości' },
    { key:'linear', label:'Liniowo: czas × ilość' },
    { key:'tiers', label:'Pakiety/progi ilościowe' },
    { key:'startStep', label:'Start + kolejne sztuki' },
  ];

  const DEFAULT_HOURLY_RATES = [
    { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Stawka warsztatowa', price:150, autoRole:'hourlyRate', workAutomatCode:'manual_hourly', rateKey:'workshop', rateCode:'workshop', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Stawka montażowa', price:250, autoRole:'hourlyRate', workAutomatCode:'manual_hourly', rateKey:'assembly', rateCode:'assembly', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_specialist', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:300, autoRole:'hourlyRate', workAutomatCode:'manual_hourly', rateKey:'specialist', rateCode:'specialist', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_helper', category:'Stawki godzinowe', name:'Stawka pomocnika', price:80, autoRole:'hourlyRate', workAutomatCode:'manual_hourly', rateKey:'helper', rateCode:'helper', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
  ];

  const DEFAULT_LABOR_DEFINITIONS = [
    { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie korpusu do 72 cm', price:0, usage:'universal', autoRole:'cabinetBody', workAutomatCode:'cabinet_body', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, heightMinMm:0, heightMaxMm:720, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h150', category:'Korpusy', name:'Skręcenie korpusu do 150 cm', price:0, usage:'universal', autoRole:'cabinetBody', workAutomatCode:'cabinet_body', rateType:'workshop', timeBlockHours:1, defaultMultiplier:1.15, heightMinMm:721, heightMaxMm:1500, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h225', category:'Korpusy', name:'Skręcenie korpusu do 225 cm', price:0, usage:'universal', autoRole:'cabinetBody', workAutomatCode:'cabinet_body', rateType:'workshop', timeBlockHours:1, defaultMultiplier:1.6, heightMinMm:1501, heightMaxMm:2250, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h999', category:'Korpusy', name:'Skręcenie korpusu powyżej 225 cm', price:0, usage:'universal', autoRole:'cabinetBody', workAutomatCode:'cabinet_body', rateType:'workshop', timeBlockHours:1, defaultMultiplier:2.2, heightMinMm:2251, heightMaxMm:99999, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_loose_shelves', category:'Elementy szafki', name:'Półki luźne — pakiet', price:0, usage:'universal', autoRole:'cabinetLooseShelves', workAutomatCode:'shelf_mount', rateType:'workshop', quantityMode:'tiers', quantityTiers:[{ min:1, max:2, hours:0.25 },{ min:3, max:5, hours:0.5 },{ min:6, max:10, hours:1 }], active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — pakiety godzin do sprawdzenia.' },
    { id:'labor_mount_front', category:'Elementy szafki', name:'Montaż frontu / drzwi', price:0, usage:'universal', autoRole:'none', workAutomatCode:'front_mount', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia przy szafce do czasu pełnego automatu frontów.' },
    { id:'labor_mount_hinge', category:'Elementy szafki', name:'Montaż zawiasu', price:0, usage:'universal', autoRole:'none', workAutomatCode:'hinge_mount', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość odpowiada zawiasom.' },
    { id:'labor_adjust_front', category:'Elementy szafki', name:'Regulacja frontu', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Osobna od ceny gotowego frontu.' },
    { id:'labor_mount_drawer', category:'Elementy szafki', name:'Montaż szuflady / prowadnic', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia lub przyszłego automatu szuflad.' },
    { id:'labor_mount_lift', category:'Elementy szafki', name:'Montaż podnośnika', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_cargo', category:'Elementy szafki', name:'Montaż cargo', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_panel', category:'Robocizna dodatkowa', name:'Montaż blendy / panelu', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Robocizna blend/paneli ma trafiać do osobnego działu, nie do skręcenia korpusu.' },
    { id:'labor_mount_plinth', category:'Robocizna dodatkowa', name:'Montaż cokołu', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość docelowo w mb.' },
    { id:'labor_hole_fi60', category:'Usługi przy szafce', name:'Otwór fi 60', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_cutout', category:'Usługi przy szafce', name:'Wcięcie na rury', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_boxing', category:'Usługi przy szafce', name:'Zabudowa rur', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_vertical_partition_long', category:'Elementy szafki', name:'Przegroda pionowa długa', price:0, usage:'universal', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, quantityMode:'linear', active:true, internalOnly:true },
  ];


  window.FC.laborCatalogDefinitions = {
    RATE_TYPES,
    USAGE_TYPES,
    AUTO_ROLES,
    DEFAULT_WORK_AUTOMATS,
    LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT,
    WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE,
    DEFAULT_RATE_ID_TO_WORK_AUTOMAT,
    SERVICE_NAME_TO_WORK_AUTOMAT,
    QUANTITY_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
  };
})();

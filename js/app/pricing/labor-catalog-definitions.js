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

  const QUANTITY_MODES = [
    { key:'none', label:'Bez ilości' },
    { key:'linear', label:'Liniowo: czas × ilość' },
    { key:'tiers', label:'Pakiety/progi ilościowe' },
    { key:'startStep', label:'Start + kolejne sztuki' },
  ];

  const PRICING_MODES = [
    { key:'fixed', label:'Kwota stała' },
    { key:'perUnit', label:'Cena za ilość' },
    { key:'startPlusUnit', label:'Kwota startowa + cena za ilość' },
    { key:'time', label:'Czas × stawka godzinowa' },
    { key:'timeTiers', label:'Progi czasu' },
    { key:'timeStartStep', label:'Czas startowy + kolejne sztuki' },
    { key:'advanced', label:'Zaawansowane' },
  ];

  const DEFAULT_HOURLY_RATES = [
    { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Stawka warsztatowa', price:150, rateKey:'workshop', rateCode:'workshop', rateType:'workshop', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Stawka montażowa', price:250, rateKey:'assembly', rateCode:'assembly', rateType:'assembly', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_specialist', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:300, rateKey:'specialist', rateCode:'specialist', rateType:'specialist', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
    { id:'labor_rate_helper', category:'Stawki godzinowe', name:'Stawka pomocnika', price:80, rateKey:'helper', rateCode:'helper', rateType:'helper', usage:'universal', active:true, systemRate:true, nonDeletable:true, starterPrice:true, note:'Systemowa stawka godzinowa — można zmienić nazwę przyjazną i kwotę, ale nie usuwać ani zmieniać kodu technicznego.' },
  ];

  const DEFAULT_LABOR_DEFINITIONS = [
    { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie korpusu do 72 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:null, max:720 }], timeBlockHours:0.5, defaultMultiplier:1.25, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h150', category:'Korpusy', name:'Skręcenie korpusu do 150 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:721, max:1500 }], timeBlockHours:1, defaultMultiplier:1.15, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h225', category:'Korpusy', name:'Skręcenie korpusu do 225 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:1501, max:2250 }], timeBlockHours:1, defaultMultiplier:1.6, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_body_h999', category:'Korpusy', name:'Skręcenie korpusu powyżej 225 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:2251, max:null }], timeBlockHours:1, defaultMultiplier:2.2, volumePricePerM3:50, active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — algorytm do sprawdzenia po testach realnej produkcji.' },
    { id:'labor_loose_shelves', category:'Elementy szafki', name:'Półki luźne — pakiet', price:0, usage:'universal', rateType:'workshop', quantitySource:'shelf.count', quantityMode:'tiers', quantityTiers:[{ min:1, max:2, hours:0.25 },{ min:3, max:5, hours:0.5 },{ min:6, max:10, hours:1 }], active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — pakiety godzin do sprawdzenia.' },
    { id:'labor_mount_front', category:'Elementy szafki', name:'Montaż frontu / drzwi', price:0, usage:'universal', rateType:'workshop', quantitySource:'front.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia przy szafce do czasu pełnego automatu frontów.' },
    { id:'labor_mount_hinge', category:'Elementy szafki', name:'Montaż zawiasu', price:0, usage:'universal', rateType:'workshop', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość odpowiada zawiasom.' },
    { id:'labor_adjust_front', category:'Elementy szafki', name:'Regulacja frontu', price:0, usage:'universal', rateType:'workshop', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Osobna od ceny gotowego frontu.' },
    { id:'labor_mount_drawer', category:'Elementy szafki', name:'Montaż szuflady / prowadnic', price:0, usage:'universal', rateType:'workshop', quantitySource:'drawer.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia lub przyszłego automatu szuflad.' },
    { id:'labor_mount_lift', category:'Elementy szafki', name:'Montaż podnośnika', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_cargo', category:'Elementy szafki', name:'Montaż cargo', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_panel', category:'Robocizna dodatkowa', name:'Montaż blendy / panelu', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Robocizna blend/paneli ma trafiać do osobnego działu, nie do skręcenia korpusu.' },
    { id:'labor_mount_plinth', category:'Robocizna dodatkowa', name:'Montaż cokołu', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość docelowo w mb.' },
    { id:'dishwasher_mount', category:'Montaż AGD', name:'Montaż zmywarki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.dishwasher.count', timeBlockHours:0.75, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: dishwasher_mount.' },
    { id:'fridge_mount', category:'Montaż AGD', name:'Montaż lodówki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.fridge.count', timeBlockHours:0.75, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: fridge_mount.' },
    { id:'oven_mount', category:'Montaż AGD', name:'Montaż piekarnika do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.oven.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: oven_mount.' },
    { id:'hob_mount', category:'Montaż AGD', name:'Montaż płyty indukcyjnej / ceramicznej', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hob.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hob_mount.' },
    { id:'hood_under_cabinet_mount', category:'Montaż AGD', name:'Montaż okapu podszafkowego / teleskopowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hood_under_cabinet.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hood_under_cabinet_mount.' },
    { id:'hood_chimney_mount', category:'Montaż AGD', name:'Montaż okapu kominowego / wyspowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hood_chimney.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hood_chimney_mount.' },
    { id:'microwave_mount', category:'Montaż AGD', name:'Montaż mikrofali do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.microwave.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: microwave_mount.' },
    { id:'washer_mount', category:'Montaż AGD', name:'Montaż pralki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.washer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: washer_mount.' },
    { id:'dryer_mount', category:'Montaż AGD', name:'Montaż suszarki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.dryer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: dryer_mount.' },
    { id:'coffee_machine_mount', category:'Montaż AGD', name:'Montaż ekspresu do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.coffee_machine.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: coffee_machine_mount.' },
    { id:'warming_drawer_mount', category:'Montaż AGD', name:'Montaż podgrzewacza szufladowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.warming_drawer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: warming_drawer_mount.' },
    { id:'transport_distance_km', category:'Transport', name:'Transport do klienta', price:0, usage:'project', rateType:'assembly', quantitySource:'transport.distance_km', quantityMode:'linear', pricingMode:'startPlusUnit', startPrice:0, includedQty:0, active:true, internalOnly:false, starterPrice:true, note:'Kwota startowa + cena za 1 km. Ilość kilometrów wynika z Inwestora i ustawień firmy w trybiku.' },
    { id:'labor_hole_fi60', category:'Usługi przy szafce', name:'Otwór fi 60', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_cutout', category:'Usługi przy szafce', name:'Wcięcie na rury', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_boxing', category:'Usługi przy szafce', name:'Zabudowa rur', price:0, usage:'universal', rateType:'workshop', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_vertical_partition_long', category:'Elementy szafki', name:'Przegroda pionowa długa', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, quantityMode:'linear', active:true, internalOnly:true },
  ];


  window.FC.laborCatalogDefinitions = {
    RATE_TYPES,
    USAGE_TYPES,
    QUANTITY_MODES,
    PRICING_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
  };
})();

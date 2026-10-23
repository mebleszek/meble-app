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
    { id:'labor_body_h090', category:'Korpusy', name:'Skręcenie korpusu do 90 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:null, max:900 }], timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'60 min do 90 cm korpusu bez nóżek/cokołu: dokumentacja, znalezienie i przeniesienie formatek, instruktaż, standardowe nawiercenia konstrukcyjne, złożenie/skręcenie i zamontowanie pleców HDF lub 18 mm. Nie doliczać tych samych prac ponownie.' },
    { id:'labor_body_h150', category:'Korpusy', name:'Skręcenie korpusu do 150 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:901, max:1500 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:0.25, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 0.25 h/m³ liczony z cabinet.body_volume_m3.' },
    { id:'labor_body_h210', category:'Korpusy', name:'Skręcenie korpusu do 210 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:1501, max:2100 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.00 h/m³ liczony z cabinet.body_volume_m3.' },
    { id:'labor_body_h230', category:'Korpusy', name:'Skręcenie korpusu do 230 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:2101, max:2300 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1.25, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.25 h/m³ liczony z cabinet.body_volume_m3.' },
    { id:'labor_body_h999', category:'Korpusy', name:'Skręcenie korpusu powyżej 230 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:2301, max:null }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1.5, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.50 h/m³ liczony z cabinet.body_volume_m3.' },
    { id:'labor_body_width_090', category:'Korpusy', name:'Dopłata skręcanie — szerokość 701–900', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:701, max:900 }], timeBlockHours:0.0833333333, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szerszy korpus: trudniejsze obracanie i dostęp do krawędzi.' },
    { id:'labor_body_width_110', category:'Korpusy', name:'Dopłata skręcanie — szerokość 901–1100', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:901, max:1100 }], timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szerszy korpus: trudniejsze obracanie i dostęp do krawędzi.' },
    { id:'labor_body_width_130', category:'Korpusy', name:'Dopłata skręcanie — szerokość 1101–1300', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:1101, max:1300 }], timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szeroki korpus zajmujący stół i utrudniający dojście.' },
    { id:'labor_body_width_999', category:'Korpusy', name:'Dopłata skręcanie — szerokość powyżej 130 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:1301, max:null }], timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za bardzo szeroki korpus — kontrola praktyczna po testach produkcji.' },
    { id:'labor_loose_shelves', category:'Elementy szafki', name:'Półki luźne — pakiet', price:0, usage:'universal', rateType:'workshop', quantitySource:'shelf.count', quantityMode:'tiers', quantityTiers:[{ min:1, max:2, hours:0.25 },{ min:3, max:5, hours:0.5 },{ min:6, max:10, hours:1 }], active:true, internalOnly:true, starterPrice:true, note:'Cena startowa — pakiety godzin do sprawdzenia.' },
    { id:'labor_mount_front', category:'Elementy szafki', name:'Montaż frontu / drzwi', price:0, usage:'universal', rateType:'workshop', quantitySource:'front.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia przy szafce do czasu pełnego automatu frontów.' },
    { id:'labor_mount_hinge', category:'Elementy szafki', name:'Montaż zawiasu', price:0, usage:'universal', rateType:'workshop', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość odpowiada zawiasom.' },
    { id:'labor_adjust_front', category:'Elementy szafki', name:'Regulacja frontu', price:0, usage:'universal', rateType:'workshop', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Osobna od ceny gotowego frontu.' },
    { id:'labor_mount_drawer', category:'Elementy szafki', name:'Montaż szuflady / prowadnic', price:0, usage:'universal', rateType:'workshop', quantitySource:'drawer.count', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Do ręcznego przypięcia lub przyszłego automatu szuflad.' },
    { id:'labor_mount_lift', category:'Elementy szafki', name:'Montaż podnośnika', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_cargo', category:'Elementy szafki', name:'Montaż cargo', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa.' },
    { id:'labor_mount_panel', category:'Robocizna dodatkowa', name:'Montaż blendy / panelu', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Robocizna blend/paneli ma trafiać do osobnego działu, nie do skręcenia korpusu.' },
    { id:'labor_mount_plinth', category:'Robocizna dodatkowa', name:'Montaż cokołu', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Cena startowa. Ilość docelowo w mb.' },
    { id:'dishwasher_mount', category:'Montaż AGD', name:'Montaż zmywarki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.dishwasher.count', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: dishwasher_mount.' },
    { id:'fridge_mount', category:'Montaż AGD', name:'Montaż lodówki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.fridge.count', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: fridge_mount.' },
    { id:'oven_mount', category:'Montaż AGD', name:'Montaż piekarnika do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.oven.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: oven_mount.' },
    { id:'hob_mount', category:'Montaż AGD', name:'Montaż płyty indukcyjnej / ceramicznej', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hob.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hob_mount.' },
    { id:'hood_under_cabinet_mount', category:'Montaż AGD', name:'Montaż okapu podszafkowego / teleskopowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hood_under_cabinet.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hood_under_cabinet_mount.' },
    { id:'hood_chimney_mount', category:'Montaż AGD', name:'Montaż okapu kominowego / wyspowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.hood_chimney.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: hood_chimney_mount.' },
    { id:'microwave_mount', category:'Montaż AGD', name:'Montaż mikrofali do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.microwave.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: microwave_mount.' },
    { id:'washer_mount', category:'Montaż AGD', name:'Montaż pralki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.washer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: washer_mount.' },
    { id:'dryer_mount', category:'Montaż AGD', name:'Montaż suszarki do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.dryer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: dryer_mount.' },
    { id:'coffee_machine_mount', category:'Montaż AGD', name:'Montaż ekspresu do zabudowy', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.coffee_machine.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: coffee_machine_mount.' },
    { id:'warming_drawer_mount', category:'Montaż AGD', name:'Montaż podgrzewacza szufladowego', price:0, usage:'universal', rateType:'assembly', quantitySource:'appliance.warming_drawer.count', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat AGD. Kod techniczny stały: warming_drawer_mount.' },
    { id:'labor_carrying_cabinet', category:'Transport i logistyka', name:'Wnoszenie korpusu / elementów', price:0, usage:'universal', rateType:'helper', quantitySource:'carrying.floor_units', pricingMode:'timeStartStep', quantityMode:'startStep', startHours:0.25, startQty:1, stepEveryQty:1, stepHours:0.0833333333, active:true, internalOnly:true, starterPrice:true, note:'Automat wnoszenia. Program liczy: 15 min startu + 5 min za każdy poziom; dla całego korpusu mnoży przez liczbę pomocników, a po rozkręceniu przez liczbę dużych elementów niewchodzących do windy.' },
    { id:'labor_carrying_disassembly', category:'Transport i logistyka', name:'Rozkręcenie i ponowne skręcenie korpusu', price:0, usage:'universal', rateType:'assembly', quantitySource:'carrying.requires_disassembly', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Osobny automat uruchamiany tylko gdy korpus jest za ciężki do wnoszenia po schodach w całości. Po rozkręceniu program sprawdza duże elementy i dolicza po schodach tylko te, które nie weszły do windy. Czas startowy: 1 h stawki montażowej.' },
    { id:'project_design_parts', category:'Projekt', name:'Projekt techniczny — formatki', price:0, usage:'universal', rateType:'specialist', quantitySource:'cabinet.part_count', timeBlockHours:0.0166666667, quantityMode:'linear', pricingMode:'time', active:true, internalOnly:true, starterPrice:true, note:'Projekt techniczny liczony od liczby formatek szafki. 1 min × stawka specjalistyczna 300 zł/h daje około 5 zł za formatkę.' },
    { id:'project_design_unusual', category:'Projekt', name:'Projekt techniczny — nietypowa szafka', price:0, usage:'universal', rateType:'specialist', quantitySource:'cabinet.unusual_project_count', timeBlockHours:0.25, quantityMode:'linear', pricingMode:'advanced', volumeTimeMode:'perM3', volumeTimePerM3:1, volumePricePerM3:0, active:true, internalOnly:true, starterPrice:true, note:'Dopłata projektowa dla szafki z ptaszkiem Nietypowy projekt: 15 min + gabarytoczas 1 h/m³.' },
    { id:'transport_distance_km', category:'Transport', name:'Transport do klienta', price:0, usage:'project', rateType:'assembly', quantitySource:'transport.distance_km', quantityMode:'linear', pricingMode:'startPlusUnit', startPrice:0, includedQty:0, active:true, internalOnly:false, starterPrice:true, note:'Kwota startowa + cena za 1 km. Ilość kilometrów wynika z Inwestora i ustawień firmy w trybiku.' },
    { id:'transport_travel_time', category:'Transport', name:'Czas dojazdu', price:0, usage:'project', rateType:'assembly', quantitySource:'transport.duration_hours', quantityMode:'linear', pricingMode:'time', timeBlockHours:1, active:true, internalOnly:true, starterPrice:true, note:'Czas dojazdu z Inwestora liczony stawką montażową. Nie używa kilometrów — kilometry zostają w pozycji Transport do klienta.' },
    { id:'labor_hole_fi60', category:'Usługi przy szafce', name:'Otwór fi 60', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_cutout', category:'Usługi przy szafce', name:'Wcięcie na rury', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_boxing', category:'Usługi przy szafce', name:'Zabudowa rur', price:0, usage:'universal', rateType:'workshop', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_vertical_partition_long', category:'Elementy szafki', name:'Przegroda pionowa długa', price:0, usage:'universal', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, quantityMode:'linear', active:true, internalOnly:true },
  ];


  // 2026-10-23: definitions use the existing editable time/start/step model.
  const LABOR_REPLACEMENTS = {
    labor_mount_front:['labor_door_trial','labor_door_pack','labor_door_rehang'],
    labor_mount_hinge:['labor_hinge_fastening'],
    labor_adjust_front:['labor_door_adjust'],
    labor_loose_shelves:['labor_shelves_adjustable','labor_shelves_fixed','labor_shelves_place']
  };
  function operation(id, name, source, minutes, options){
    return Object.assign({id,category:'Elementy szafki',name,price:0,usage:'universal',rateType:'workshop',quantitySource:source,
      pricingMode:'time',quantityMode:'linear',timeBlockHours:minutes/60,active:true,internalOnly:true,starterPrice:true},options || {});
  }
  function prepared(id, name, source, options){
    return operation(id,name,source,0,Object.assign({pricingMode:'timeStartStep',quantityMode:'startStep',startHours:5/60,startQty:0,stepEveryQty:1,stepHours:1/60},options || {}));
  }
  DEFAULT_LABOR_DEFINITIONS.push(
    prepared('labor_legs_install','Montaż nóżek','leg.count',{note:'5 min przygotowania na korpus + 1 min/nóżkę. Zero nóżek = zero pracy. Poziomowanie poza zakresem.'}),
    prepared('labor_hangers_install','Montaż zawieszek','hanger.count',{note:'5 min przygotowania na korpus + 1 min/zawieszkę. Ilość wspólna z MATERIAŁEM.'}),
    prepared('labor_hdf_cutouts','Wycięcia HDF i podcięcia boków','hdf.cutout_count',{note:'Jedno przygotowanie 5 min + 1 min/otwór HDF + 1 min/podcięcie boku. Standard HDF: 2 + 2 = 9 min.'}),
    prepared('labor_nuts_workshop','NUT-y we własnym warsztacie','nut.workshop_count',{note:'5 min przygotowania piły i przeniesienia elementów + 1 min/kompletny NUT. Bez równoległej usługi zewnętrznej.'}),
    prepared('labor_shelves_adjustable','Półki regulowane — wiercenie','shelf.adjustable_count',{startHours:15/60,startQty:2,stepEveryQty:3,stepHours:15/60,note:'12 otworów/półkę (wysokość oraz ±3 cm). 15 min za pierwsze 1–2 + 15 min/rozpoczęte 3 kolejne; z przygotowaniem, rozmierzaniem i szablonem.'}),
    prepared('labor_shelves_fixed','Półki nieregulowane — wiercenie','shelf.fixed_count',{startHours:15/60,startQty:5,stepEveryQty:7,stepHours:15/60,note:'Półka na podpórkach, jedna wysokość, 4 otwory/półkę. 15 min za pierwsze 1–5 + 15 min/rozpoczęte 7 kolejne; z przygotowaniem, rozmierzaniem i szablonem.'}),
    prepared('labor_shelves_place','Osadzenie półek u klienta','shelf.count',{rateType:'assembly',note:'5 min przygotowania na korpus + 1 min/półkę. Oba rodzaje półek; na warsztacie półek nie wkładamy.'}),
    prepared('labor_hinge_drill','Wiercenie puszek zawiasowych','hinge.drill_count',{note:'5 min przygotowania raz na korpus + 1 min/puszkę. Dodatkowe rozmierzanie per front w osobnej pozycji. Gotowe nawierty: 0.'}),
    operation('labor_hinge_layout','Rozmierzanie trzeciego i kolejnych zawiasów','hinge.extra_drill_count',5,{note:'5 min za trzeci i każdy kolejny zawias konkretnego frontu. Sumowanie TIP-ON według oryginalnego frontu. Gotowe nawierty: 0.'}),
    prepared('labor_hinge_fastening','Przykręcanie zawiasów i prowadników','hinge.fitting_count',{note:'Wspólne 5 min przygotowania + 1 min/zawias + 1 min/prowadnik. Jeden komplet materiałowy, dwie fizyczne operacje.'}),
    operation('labor_door_trial','Pierwsze założenie drzwi na warsztacie','hinge.door_hinge_count',1,{note:'1 min/zawias drzwiowy. Bez przygotowania i regulacji; bez szuflad i podnośników.'}),
    operation('labor_door_pack','Zdjęcie, pakowanie i odłożenie drzwi','hinge.door_count',5,{note:'5 min/front drzwiowy: wypięcie, zdjęcie, zabezpieczenie, pakowanie, przeniesienie i odłożenie. Bez dodatkowej opłaty za zdjęcie/pakowanie i bez załadunku.'}),
    operation('labor_door_rehang','Rozpakowanie i założenie drzwi u klienta','hinge.door_cycle_count',1,{rateType:'assembly',note:'1 min/front + 1 min/zawias. Bez końcowej regulacji.'}),
    operation('labor_door_adjust','Końcowa regulacja drzwi u klienta','hinge.door_cycle_count',1,{rateType:'assembly',note:'1 min/front + 1 min/zawias według aktualnej stawki montażowej.'})
  );

  window.FC.laborCatalogDefinitions = {
    LABOR_REPLACEMENTS,
    RATE_TYPES,
    USAGE_TYPES,
    QUANTITY_MODES,
    PRICING_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
  };
})();

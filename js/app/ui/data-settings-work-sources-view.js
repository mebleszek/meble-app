(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  const INFO_MESSAGE = 'To jest centralny słownik nazw danych, z których program ma później liczyć czynności i WYCENĘ. Ten ekran nie zapisuje drugich danych w szafkach — pokazuje tylko wspólny język programu: nazwa techniczna, nazwa przyjazna, jednostka i sposób liczenia.';
  const PREVIEW_MESSAGE = 'To jest podgląd tylko do odczytu, liczony z aktualnego projektu. Program nie zapisuje tu drugich danych w szafkach. Jeśli wartość jest zła, poprawia się właściwe pole w WYWIADZIE, nie ten podgląd.';
  const FACT_ORDER = [
    'cabinet.width_mm',
    'cabinet.height_mm',
    'cabinet.body_height_mm',
    'cabinet.depth_mm',
    'cabinet.volume_m3',
    'cabinet.body_volume_m3',
    'front.count',
    'front.dimensions',
    'front.area_m2',
    'hinge.count',
    'hinge.requirement',
    'shelf.count',
    'drawer.count',
    'appliance.count',
    'appliance.type',
    'cabinet.zone',
    'cabinet.kind',
  ];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function array(value){ return Array.isArray(value) ? value : []; }

  function makeStatusBadge(source){
    const label = FC.workQuantitySources && typeof FC.workQuantitySources.statusLabel === 'function'
      ? FC.workQuantitySources.statusLabel(source.status)
      : (source.status === 'planned' ? 'planowane' : 'systemowe');
    return h('span', { class:'data-settings-work-source__badge data-settings-work-source__badge--' + String(source.status || 'system'), text:label });
  }

  function makeSourceCard(source){
    const row = h('article', { class:'data-settings-work-source', 'data-work-source-code':source.code });
    const head = h('div', { class:'data-settings-work-source__head' });
    head.appendChild(h('div', { class:'data-settings-work-source__title' }, [
      h('strong', { text:source.label }),
      h('code', { text:source.code }),
    ]));
    const meta = h('div', { class:'data-settings-work-source__meta' });
    meta.appendChild(h('span', { text:source.unit || '—' }));
    meta.appendChild(makeStatusBadge(source));
    head.appendChild(meta);
    row.appendChild(head);
    row.appendChild(h('p', { class:'data-settings-work-source__calc', text:source.calculation || 'Brak opisu sposobu liczenia.' }));
    return row;
  }

  function getProjectData(){
    try{
      if(root.projectData && typeof root.projectData === 'object') return root.projectData;
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.load === 'function') return FC.project.load() || {};
    }catch(_){ }
    return {};
  }

  function getRoomLabel(roomId){
    const key = text(roomId);
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function') return FC.roomRegistry.getRoomLabel(key) || key;
    }catch(_){ }
    return key || 'Pomieszczenie';
  }

  function getCabinetLabel(cabinet, index){
    const nr = index + 1;
    const typeBits = [text(cabinet && cabinet.type), text(cabinet && cabinet.subType)].filter(Boolean).join(' / ');
    const dims = [cabinet && cabinet.width, cabinet && cabinet.height, cabinet && cabinet.depth]
      .map((v)=> text(v))
      .filter(Boolean)
      .join(' × ');
    return ['Szafka #' + nr, typeBits, dims ? dims + ' cm' : ''].filter(Boolean).join(' — ');
  }

  function listRoomsWithCabinets(project){
    const rooms = [];
    Object.keys(project || {}).forEach((roomId)=>{
      if(roomId === 'schemaVersion' || roomId === 'meta') return;
      const room = project[roomId];
      if(!(room && typeof room === 'object' && Array.isArray(room.cabinets))) return;
      if(!room.cabinets.length) return;
      rooms.push({ roomId, room, cabinets:room.cabinets });
    });
    return rooms;
  }

  function factMapFor(roomId, cabinet){
    try{
      const api = FC.workQuantityFacts;
      if(api && typeof api.buildCabinetFactMap === 'function') return api.buildCabinetFactMap(roomId, cabinet) || {};
    }catch(error){
      return { __error:{ displayValue:'Błąd odczytu: ' + (error && error.message ? error.message : String(error)), available:false } };
    }
    return {};
  }

  function makeFactRow(fact){
    const row = h('div', { class:'data-settings-work-fact-row' });
    row.appendChild(h('div', { class:'data-settings-work-fact-row__name' }, [
      h('strong', { text:fact.label || fact.code || 'Źródło' }),
      h('code', { text:fact.code || '' }),
    ]));
    row.appendChild(h('div', { class:'data-settings-work-fact-row__value' }, [
      h('strong', { text:fact.displayValue || 'brak' }),
      fact.source ? h('span', { text:'z: ' + fact.source }) : null,
    ]));
    return row;
  }

  function makeCabinetFactsCard(roomId, cabinet, index){
    const map = factMapFor(roomId, cabinet);
    const card = h('article', { class:'data-settings-cabinet-facts-card', 'data-work-facts-cabinet-id':text(cabinet && cabinet.id) });
    card.appendChild(h('div', { class:'data-settings-cabinet-facts-card__head' }, [
      h('strong', { text:getCabinetLabel(cabinet, index) }),
      h('span', { text:'podgląd tylko do odczytu' }),
    ]));
    const grid = h('div', { class:'data-settings-work-facts-grid' });
    FACT_ORDER.forEach((code)=>{
      const fact = map[code];
      if(!fact) return;
      if(fact.sourceStatus === 'planned' && !fact.available) return;
      grid.appendChild(makeFactRow(fact));
    });
    if(!grid.children.length){
      grid.appendChild(h('div', { class:'data-settings-defaults-summary muted', text:'Brak dostępnych faktów dla tej szafki.' }));
    }
    card.appendChild(grid);
    return card;
  }

  function makeCabinetFactsPreview(){
    const card = h('section', { class:'data-settings-card data-settings-work-facts-preview-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Podgląd odczytu z aktualnego projektu' })]);
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function'){
      titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.workQuantityFacts.preview', title:'Podgląd odczytu z aktualnego projektu', message:PREVIEW_MESSAGE, scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
    }
    card.appendChild(titleRow);
    card.appendChild(h('p', { class:'data-settings-work-sources-lead muted', text:'Ten podgląd działa poza modalem szafki. Czyta aktualne szafki z projektu i pokazuje, jakie nazwane dane program potrafi z nich odczytać. Niczego tu nie zapisujemy.' }));

    if(!(FC.workQuantityFacts && typeof FC.workQuantityFacts.buildCabinetFactMap === 'function')){
      card.appendChild(h('div', { class:'data-settings-defaults-summary muted', text:'Moduł odczytu danych z szafek nie został załadowany.' }));
      return card;
    }

    const rooms = listRoomsWithCabinets(getProjectData());
    if(!rooms.length){
      card.appendChild(h('div', { class:'data-settings-defaults-summary muted', text:'W aktualnym projekcie nie ma jeszcze szafek do podglądu.' }));
      return card;
    }

    rooms.forEach((entry, index)=>{
      const list = h('div', { class:'data-settings-cabinet-facts-list' });
      array(entry.cabinets).forEach((cabinet, cabinetIndex)=>{
        list.appendChild(makeCabinetFactsCard(entry.roomId, cabinet, cabinetIndex));
      });
      if(dom.makeAccordion){
        card.appendChild(dom.makeAccordion(getRoomLabel(entry.roomId), [list], {
          open:index === 0,
          sub:String(entry.cabinets.length),
          infoKey:'dataSettings.workQuantityFacts.room.' + entry.roomId,
          infoMessage:'Podgląd nazwanych danych odczytanych z szafek w tym pomieszczeniu. To nie jest edycja danych i nie zapisuje drugiej prawdy.',
          infoScope:'dataSettings',
        }));
      }else card.appendChild(list);
    });
    return card;
  }

  function render(scroll){
    if(!(scroll && h)) return;
    const api = FC.workQuantitySources;
    scroll.innerHTML = '';
    const card = h('section', { class:'data-settings-card data-settings-work-sources-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Dane, z których program liczy czynności' })]);
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function'){
      titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.workQuantitySources.card', title:'Dane, z których program liczy czynności', message:INFO_MESSAGE, scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
    }
    card.appendChild(titleRow);
    card.appendChild(h('p', { class:'data-settings-work-sources-lead muted', text:'Tu ustalamy wspólny język programu: nazwa techniczna, nazwa przyjazna i opis, skąd dana wartość ma być brana. To jest podgląd systemowych źródeł — nie zapisuje kopii danych w szafkach.' }));

    if(!(api && typeof api.list === 'function' && typeof api.groupByCategory === 'function')){
      card.appendChild(h('div', { class:'data-settings-defaults-summary muted', text:'Moduł źródeł danych do czynności nie został załadowany.' }));
      scroll.appendChild(card);
      return;
    }

    const list = api.list();
    const summary = h('div', { class:'data-settings-work-sources-summary' }, [
      h('div', { class:'data-settings-stat' }, [h('span', { text:'Źródła' }), h('strong', { text:String(list.length) })]),
      h('div', { class:'data-settings-stat' }, [h('span', { text:'Systemowe' }), h('strong', { text:String(list.filter((row)=> row.status !== 'planned').length) })]),
      h('div', { class:'data-settings-stat' }, [h('span', { text:'Planowane' }), h('strong', { text:String(list.filter((row)=> row.status === 'planned').length) })]),
    ]);
    card.appendChild(summary);

    const groups = api.groupByCategory();
    Object.keys(groups).forEach((groupName, index)=>{
      const groupList = groups[groupName] || [];
      const wrap = h('div', { class:'data-settings-work-source-list' });
      groupList.forEach((source)=> wrap.appendChild(makeSourceCard(source)));
      if(dom.makeAccordion) card.appendChild(dom.makeAccordion(groupName, [wrap], { open:index === 0, sub:String(groupList.length), infoKey:'dataSettings.workQuantitySources.' + groupName.replace(/[^a-z0-9]+/gi, '_').toLowerCase(), infoMessage:'Lista źródeł danych z grupy „' + groupName + '”. Kod techniczny będzie później używany w cenniku czynności, a nazwa przyjazna w UI i audycie.', infoScope:'dataSettings' }));
      else card.appendChild(wrap);
    });

    card.appendChild(h('div', { class:'data-settings-work-sources-note', text:'Ten etap nadal nie podpina źródeł do cennika czynności. Podgląd poniżej służy wyłącznie sprawdzeniu, co program potrafi odczytać z obecnych szafek.' }));
    scroll.appendChild(card);
    scroll.appendChild(makeCabinetFactsPreview());
  }

  FC.dataSettingsWorkSourcesView = { render };
})();

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  const INFO_MESSAGE = 'To jest centralny słownik nazw danych, z których program ma później liczyć czynności i WYCENĘ. Ten ekran nie zapisuje drugich danych w szafkach — pokazuje tylko wspólny język programu: nazwa techniczna, nazwa przyjazna, jednostka i sposób liczenia.';

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

    card.appendChild(h('div', { class:'data-settings-work-sources-note', text:'Następny etap po zatwierdzeniu tego słownika: podgląd „Co program odczyta z tej szafki” na dole modala szafki, nadal bez zapisywania drugiego zestawu danych.' }));
    scroll.appendChild(card);
  }

  FC.dataSettingsWorkSourcesView = { render };
})();

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function fallbackFormatBytes(value){
    const n = Math.max(0, Number(value) || 0);
    if(n < 1024) return `${n} zn.`;
    if(n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
    return `${Math.round(n / 104857.6) / 10} MB`;
  }

  function formatBytes(value){
    try{
      if(FC.dataStorageClassifier && typeof FC.dataStorageClassifier.formatBytes === 'function') return FC.dataStorageClassifier.formatBytes(value);
    }catch(_){ }
    return fallbackFormatBytes(value);
  }

  function keyList(h, entries, emptyText){
    const list = h('div', { class:'data-settings-key-list' });
    if(!(entries && entries.length)){
      list.appendChild(h('div', { class:'muted', text:emptyText || 'Brak kluczy w tej kategorii.' }));
      return list;
    }
    entries.forEach((entry)=>{
      const row = h('div', { class:'data-settings-key-row' });
      const main = h('div', { class:'data-settings-key-row__main' }, [
        h('strong', { text:entry.label || entry.key }),
        h('code', { text:entry.key }),
      ]);
      const meta = h('div', { class:'data-settings-key-row__meta' }, [
        h('span', { text:formatBytes(entry.size) }),
        h('span', { text:`pozycji: ${Number(entry.recordCount) || 0}` }),
        entry.testRecords ? h('span', { class:'data-settings-key-test', text:`testowe: ${Number(entry.testRecords) || 0}` }) : null,
      ]);
      row.appendChild(main);
      row.appendChild(meta);
      if(entry.description){
        row.title = entry.description;
        row.setAttribute('aria-label', `${entry.label || entry.key}: ${entry.description}`);
      }
      list.appendChild(row);
    });
    return list;
  }

  function buildCategory(ctx){
    const h = ctx.h;
    const makeAccordion = ctx.makeAccordion;
    const makeStat = ctx.makeStat;
    const title = ctx.title;
    const open = !!ctx.open;
    const summary = ctx.summary || { keys:0, bytes:0, records:0 };
    const entries = ctx.entries || [];
    const stats = h('div', { class:'data-settings-stats' }, [
      makeStat('Klucze', summary.keys),
      makeStat('Pozycje', summary.records),
      makeStat('Rozmiar', formatBytes(summary.bytes)),
    ]);
    const nodes = [
      stats,
      makeAccordion('Lista kluczy danych', [keyList(h, entries, ctx.emptyText)], { open:false, sub:String(entries.length || 0), infoMessage:ctx.keysInfo || 'Lista pokazuje konkretne klucze zapisane w pamięci przeglądarki. To techniczne nazwy używane do backupu i odzyskiwania danych.' }),
    ];
    if(ctx.extraNode) nodes.unshift(ctx.extraNode);
    return makeAccordion(title, nodes, { open, sub:ctx.sub || '', infoMessage:ctx.infoMessage || '' });
  }

  function buildOverview(options){
    const ctx = options && typeof options === 'object' ? options : {};
    const h = ctx.h;
    const makeAccordion = ctx.makeAccordion;
    const makeStat = ctx.makeStat;
    const snapshotApi = ctx.snapshot;
    const stats = ctx.stats || {};
    if(!(h && makeAccordion && makeStat && snapshotApi)) return null;
    const snapshot = snapshotApi.collectSnapshot({ reason:'data-settings-view' });
    const summary = snapshotApi.readDataSummaryFromSnapshot(snapshot);
    const userQuick = h('div', { class:'data-settings-stats' }, [
      makeStat('Inwestorzy', stats.investors),
      makeStat('Projekty', stats.projects),
      makeStat('Snapshoty wycen', stats.quoteSnapshots),
      makeStat('Drafty ofert', stats.quoteDrafts),
      makeStat('Zlecenia usługowe', stats.serviceOrders),
      makeStat('Wpisy oklein', stats.edgeEntries),
    ]);
    const technicalQuick = h('div', { class:'data-settings-stats' }, [
      makeStat('Backupy razem', stats.backups),
      makeStat('Backupy programu', stats.appBackups),
      makeStat('Backupy testowe', stats.testBackups),
      makeStat('Chronione backupy', stats.protectedBackups),
    ]);
    const testQuick = h('div', { class:'data-settings-stats' }, [
      makeStat('Klucze z testami', summary.test.keys),
      makeStat('Rekordy testowe', summary.test.records),
      makeStat('Rozmiar kluczy', formatBytes(summary.test.bytes)),
    ]);
    const card = h('section', { class:'data-settings-card data-settings-overview-card' });
    card.appendChild(buildCategory({
      h, makeAccordion, makeStat,
      title:'Dane użytkownika',
      open:true,
      summary:summary.user,
      entries:summary.byCategory.user,
      extraNode:userQuick,
      sub:String(summary.user.keys || 0),
      infoMessage:'Dane użytkownika to właściwe dane programu: inwestorzy, projekty, cenniki, oferty, zlecenia, okleiny i ustawienia robocze potrzebne do pracy.',
      keysInfo:'Lista kluczy użytkownika pokazuje, które części realnych danych wejdą do backupu.',
    }));
    card.appendChild(buildCategory({
      h, makeAccordion, makeStat,
      title:'Dane techniczne',
      open:false,
      summary:summary.technical,
      entries:summary.byCategory.technical,
      extraNode:technicalQuick,
      sub:String(summary.technical.keys || 0),
      infoMessage:'Dane techniczne to stan interfejsu, identyfikatory aktywnego projektu/inwestora, preferencje widoku i pomocnicze informacje odzyskiwania. Nie są liczbą inwestorów ani projektów.',
      keysInfo:'Lista kluczy technicznych pomaga sprawdzić, jakie ustawienia i identyfikatory są obecnie zapisane w przeglądarce.',
    }));
    card.appendChild(buildCategory({
      h, makeAccordion, makeStat,
      title:'Dane testowe',
      open:false,
      summary:summary.test,
      entries:summary.byCategory.test,
      extraNode:testQuick,
      sub:String(summary.test.records || 0),
      emptyText:'Nie wykryto oznaczonych danych testowych.',
      infoMessage:'Dane testowe to rekordy oznaczone przez runner testów markerem __test albo starym meta.testData. Normalna praca programu nie powinna ich tworzyć.',
      keysInfo:'Ta lista pokazuje tylko klucze, w których wykryto oznaczone rekordy testowe.',
    }));
    return card;
  }

  FC.dataSettingsReportView = { buildOverview, keyList, formatBytes };
})();

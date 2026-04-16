(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Guard', 'Guard ręcznej zmiany statusu pozostaje tylko walidatorem', 'Pilnuje mini-paczkę 3: validateManualStatusChange nie może sam zapisywać statusów projektu ani synchronizować luster.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        H.assert(FC.projectStore && typeof FC.projectStore.upsert === 'function', 'Brak FC.projectStore.upsert');
        H.assert(FC.project && typeof FC.project.save === 'function', 'Brak FC.project.save');
        const prevUpsert = FC.projectStore.upsert;
        const prevSave = FC.project.save;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId })=>{
            FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', 'pomiar');
          });
          H.assert(upsertCalls === 0, 'Guard nie powinien sam zapisywać projectStore', { upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Guard nie powinien sam zapisywać projektu do session store', { upsertCalls, saveCalls });
        } finally {
          FC.projectStore.upsert = prevUpsert;
          FC.project.save = prevSave;
        }
      }),

    H.makeTest('Wycena ↔ Snapshot store', 'Snapshot store nie ustala sam finalnego statusu projektu', 'Pilnuje mini-paczkę 3: wybór snapshotu w quote-snapshot-store zmienia tylko historię ofert i nie może sam zsynchronizować statusów projektu bez centralnego sync.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({ id:'snap_store_only_select', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt store only' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Store only' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820293000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, snapshot.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          const investor = FC.investors.getById(investorId);
          const project = FC.projectStore.getById(projectId);
          const kitchen = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchen && kitchen.projectStatus || '') === 'nowy', 'Sam snapshot store nie powinien podnosić statusu pokoju bez centralnego sync', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'nowy', 'Sam snapshot store nie powinien podnosić projectStore.status bez centralnego sync', project);
        });
      }),

    H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Wycena filtruje elementy dokładnie po zapisanym wyborze pomieszczeń', 'Pilnuje, czy po wyborze pokoi w Wycena agregacja bierze tylko te pokoje, a nie dorzuca formatek z innych pomieszczeń aktywnego projektu.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.collectElementLines === 'function', 'Brak FC.wycenaCore.collectElementLines');
        H.assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        withInvestorProjectFixture({
          cutListFn(cabinet, roomId){
            if(String(roomId || '') === 'room_kuchnia_gora') return [{ name:'Bok kuchnia', material:'Dąb kuchnia', a:72, b:56, qty:2 }];
            if(String(roomId || '') === 'room_salon') return [{ name:'Bok salon', material:'Jesion salon', a:60, b:40, qty:3 }];
            return [];
          }
        }, ()=>{
          const agg = FC.rozrys.aggregatePartsForProject(['room_salon']);
          const lines = FC.wycenaCore.collectElementLines({ selectedRooms:['room_salon'], materialScope:{ includeFronts:false, includeCorpus:true } });
          H.assert(Array.isArray(agg.materials) && agg.materials.length === 1 && String(agg.materials[0] || '') === 'Jesion salon', 'ROZRYS nie ograniczył agregacji do wybranego pokoju', agg);
          H.assert(Array.isArray(lines) && lines.length === 1, 'Wycena nie ograniczyła listy elementów do wybranego pokoju', lines);
          H.assert(String(lines[0].name || '') === 'Bok salon' && String(lines[0].materialLabel || '') === 'Jesion salon' && Number(lines[0].qty) === 3, 'Wycena zwróciła elementy z niewłaściwego pokoju albo złą ilość', lines[0]);
        });
      }),

    H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Pusty wybór pokoi w Wycena wraca do wszystkich aktywnych pomieszczeń bieżącego projektu', 'Pilnuje, czy gdy zapisany wybór jest pusty, Wycena bierze komplet realnych pokoi aktywnego inwestora, a nie pusty stan albo domyślne typy bazowe.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.collectElementLines === 'function', 'Brak FC.wycenaCore.collectElementLines');
        withInvestorProjectFixture({
          cutListFn(cabinet, roomId){
            if(String(roomId || '') === 'room_kuchnia_gora') return [{ name:'Kuchnia bok', material:'Biały mat', a:72, b:56, qty:1 }];
            if(String(roomId || '') === 'room_salon') return [{ name:'Salon bok', material:'Dąb artisan', a:65, b:45, qty:2 }];
            return [];
          }
        }, ()=>{
          const normalized = FC.wycenaCore.normalizeQuoteSelection({ selectedRooms:[], materialScope:{ includeFronts:false, includeCorpus:true } });
          const lines = FC.wycenaCore.collectElementLines({ selectedRooms:[], materialScope:{ includeFronts:false, includeCorpus:true } });
          H.assert(Array.isArray(normalized.selectedRooms) && normalized.selectedRooms.includes('room_kuchnia_gora') && normalized.selectedRooms.includes('room_salon'), 'Wycena nie wróciła do wszystkich aktywnych pokoi projektu', normalized);
          H.assert(Array.isArray(lines) && lines.length === 2, 'Wycena nie zebrała elementów ze wszystkich aktywnych pokoi po pustym wyborze', lines);
          H.assert(lines.some((row)=> String(row.name || '') === 'Kuchnia bok') && lines.some((row)=> String(row.name || '') === 'Salon bok'), 'Po pustym wyborze brakuje elementów z któregoś pokoju', lines);
        });
      }),

    H.makeTest('Wycena ↔ PDF', 'PDF budowany z zapisanej końcowej oferty zachowuje handlowy charakter po konwersji z wstępnej', 'Pilnuje, czy po konwersji zaakceptowanej wyceny wstępnej na końcową PDF nadal bierze tę samą wersję oferty, pokazuje pomieszczenia i nie wraca do technicznych formatek.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function', 'Brak FC.quoteSnapshotStore.convertPreliminaryToFinal');
        H.assert(FC.quotePdf && typeof FC.quotePdf.buildPrintHtml === 'function', 'Brak FC.quotePdf.buildPrintHtml');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const prelim = FC.quoteSnapshotStore.save({
            id:'snap_pdf_cross_prelim',
            investor:{ id:'inv_pdf_cross', name:'Jan Test' },
            project:{ id:'proj_pdf_cross', investorId:'inv_pdf_cross', title:'Projekt PDF cross', status:'pomiar' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'], materialScopeMode:'corpus', materialScope:{ includeFronts:false, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Wstępna oferta' },
            meta:{ selectedByClient:true, acceptedAt:1712820200000, acceptedStage:'pomiar' },
            lines:{
              elements:[{ name:'Bok', qty:2, width:720, height:560, materialLabel:'Biały mat' }],
              materials:[{ name:'Biały mat', qty:1, unit:'ark.' }],
              accessories:[{ name:'Zawias Blum', qty:4 }],
              agdServices:[{ name:'Piekarnik do zabudowy', qty:1 }],
              quoteRates:[{ name:'Montaż zabudowy', qty:1, unit:'x' }],
            },
            totals:{ grand:999, subtotal:999, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712820200000,
          });
          FC.quoteSnapshotStore.convertPreliminaryToFinal('proj_pdf_cross', prelim.id);
          const selected = FC.quoteSnapshotStore.getSelectedForProject('proj_pdf_cross');
          const html = FC.quotePdf.buildPrintHtml(selected);
          H.assert(selected && selected.commercial && selected.commercial.preliminary === false, 'Konwersja nie zostawiła finalnej zapisanej oferty do PDF', selected);
          H.assert(/Wycena końcowa/.test(String(html || '')) && /Kuchnia góra/.test(String(html || '')), 'PDF po konwersji nie pokazuje końcowego typu oferty albo pomieszczeń', html);
          H.assert(/Biały mat/.test(String(html || '')) && /Zawias Blum/.test(String(html || '')) && /Montaż zabudowy/.test(String(html || '')) && /Piekarnik do zabudowy/.test(String(html || '')), 'PDF po konwersji zgubił handlowe sekcje materiałów / akcesoriów / usług / AGD', html);
          H.assert(!/Elementy w ofercie/.test(String(html || '')) && !/720 × 560 mm/.test(String(html || '')), 'PDF po konwersji wrócił do technicznej listy formatek', html);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);

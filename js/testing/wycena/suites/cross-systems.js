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
            upsertCalls = 0;
            saveCalls = 0;
            FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', 'pomiar');
            H.assert(upsertCalls === 0, 'Guard nie powinien sam zapisywać projectStore', { upsertCalls, saveCalls });
            H.assert(saveCalls === 0, 'Guard nie powinien sam zapisywać projektu do session store', { upsertCalls, saveCalls });
          });
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

    H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Wycena filtruje elementy dokładnie po zapisanym wyborze pomieszczeń', 'Rzeczywiste natywne formatki i PCV zachowują roomId i materiał wybranego pokoju.', ()=> withInvestorProjectFixture({nativeCalculation:true,
      projectData:{meta:{roomDefs:{room_kuchnia_gora:{id:'room_kuchnia_gora',baseType:'kuchnia',name:'Kuchnia góra'},room_salon:{id:'room_salon',baseType:'pokoj',name:'Salon'}},roomOrder:['room_kuchnia_gora','room_salon']},room_kuchnia_gora:{cabinets:[{id:'cab_k',bodyColor:'laminat Dąb kuchnia'}]},room_salon:{cabinets:[{id:'cab_s',bodyColor:'laminat Jesion salon',height:60,depth:40}]}}
    }, ({activateCalculation})=>{
      activateCalculation();
      const agg=FC.rozrys.aggregatePartsForProject(['room_salon']);
      const parts=agg.materials.flatMap(material=>agg.groups[material].allParts);
      H.assert(parts.length>0 && parts.every(part=>part.sourceRefs.every(ref=>ref.roomId==='room_salon')), 'Agregat zawiera obce źródła',parts);
      const lines=FC.wycenaCore.collectElementLines({selectedRooms:['room_salon'],materialScope:{includeFronts:false,includeCorpus:true}});
      const side=lines.find(line=>line.name==='Bok' && line.materialLabel==='laminat Jesion salon');
      H.assert(side && side.qty===2, 'Natywne boki salonu mają niewłaściwy materiał lub ilość',lines);
      H.assert(!lines.some(line=>line.materialLabel==='laminat Dąb kuchnia'),'Wycena pobrała materiał kuchni',lines);
    })),

    H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Pusty wybór pokoi w Wycena wraca do wszystkich aktywnych pomieszczeń bieżącego projektu', 'Pusty wybór jest normalizowany do dwóch pokoi; rzeczywista geometria obu pozostaje w agregacji.', ()=> withInvestorProjectFixture({nativeCalculation:true}, ({activateCalculation})=>{
      activateCalculation();
      const normalized=FC.wycenaCore.normalizeQuoteSelection({selectedRooms:[],materialScope:{includeFronts:false,includeCorpus:true}});
      H.assert(JSON.stringify(normalized.selectedRooms)===JSON.stringify(['room_kuchnia_gora','room_salon']), 'Pusty wybór nie obejmuje obu aktywnych pokoi',normalized);
      const lines=FC.wycenaCore.collectElementLines({selectedRooms:[],materialScope:{includeFronts:false,includeCorpus:true}});
      H.assert(lines.filter(line=>line.name==='Bok').reduce((n,line)=>n+line.qty,0)===4,'Nie policzono czterech natywnych boków obu szafek',lines);
      const agg=FC.rozrys.aggregatePartsForProject(normalized.selectedRooms),refs=agg.materials.flatMap(material=>agg.groups[material].allParts).flatMap(part=>part.sourceRefs);
      H.assert(refs.some(ref=>ref.roomId==='room_kuchnia_gora') && refs.some(ref=>ref.roomId==='room_salon'),'Brakuje źródła któregoś pokoju',refs);
    })),

    H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Wycena dla pustego, ale istniejącego pokoju nie pobiera danych z innego pokoju projektu', 'Pilnuje exact scope: gdy wybrany pokój istnieje, ale nie ma żadnych szafek, Wycena ma zwrócić empty_quote_scope zamiast policzyć ofertę na podstawie danych z innego pokoju.', async ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function', 'Brak FC.wycenaCore.collectQuoteData');
        await withInvestorProjectFixture({nativeCalculation:true,
          projectData:{
            schemaVersion: 2,
            meta:{
              roomDefs:{
                room_kuchnia_gora:{ id:'room_kuchnia_gora', baseType:'kuchnia', name:'A', label:'A' },
                room_salon:{ id:'room_salon', baseType:'pokoj', name:'H', label:'H' },
              },
              roomOrder:['room_kuchnia_gora','room_salon'],
            },
            room_kuchnia_gora:{ cabinets:[{ id:'cab_k' }], fronts:[], sets:[], settings:{} },
            room_salon:{ cabinets:[], fronts:[], sets:[], settings:{} },
          },
          cutListFn(cabinet, roomId){
            if(String(roomId || '') !== 'room_kuchnia_gora') return [];
            return [{ name:'Kuchnia bok', material:'Biały mat', a:72, b:56, qty:1 }];
          }
        }, async ({activateCalculation})=>{
          activateCalculation();
          let caught = null;
          try{
            await FC.wycenaCore.collectQuoteData({ selection:{ selectedRooms:['room_salon'], materialScope:{ includeFronts:false, includeCorpus:true } } });
          }catch(error){
            caught = error;
          }
          H.assert(caught && caught.quoteValidation === true, 'Wycena powinna zgłosić błąd walidacji dla pustego exact scope', caught);
          H.assert(String(caught && caught.code || '') === 'empty_quote_scope', 'Wycena dla pustego exact scope zwróciła zły kod błędu', caught);
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

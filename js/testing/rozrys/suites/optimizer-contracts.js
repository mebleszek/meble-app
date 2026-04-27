(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.optimizerContracts = function optimizerContracts(ctx){
    ctx = ctx || {};
    const FC = ctx.FC || host.FC || {};
    const Fx = ctx.Fx;
    const assert = ctx.assert;
    const makeTest = ctx.makeTest;
    const fallbackPartSignature = ctx.fallbackPartSignature;
    const defaultRotationAllowed = ctx.defaultRotationAllowed;
    const readAssetSource = ctx.readAssetSource;

    function optimizerItems(parts){
      assert(FC.cutOptimizer && typeof FC.cutOptimizer.makeItems === 'function', 'Brak FC.cutOptimizer.makeItems');
      return FC.cutOptimizer.makeItems(parts || []);
    }

    function countPlacements(sheets){
      return (sheets || []).reduce((sum, sheet)=> sum + ((sheet && sheet.placements) || []).filter((placement)=> placement && !placement.unplaced).length, 0);
    }

    return [
      makeTest('Kontrakty optymalizatora', 'Źródła startów i MAX są dostępne dla kontraktów ROZRYS', 'Pilnuje, żeby po splicie testy widziały aktualne pliki startów oraz wszystkie moduły MAX bez uruchamiania ciężkiego algorytmu w smoke.', ()=>{
        assert(readAssetSource('js/app/optimizer/start-along.js'), 'Brak źródła start-along.js w assets testów');
        assert(readAssetSource('js/app/optimizer/start-across.js'), 'Brak źródła start-across.js w assets testów');
        assert(readAssetSource('js/app/optimizer/start-optimax.js'), 'Brak źródła start-optimax.js w assets testów');
        assert(readAssetSource('js/app/optimizer/speed-max-core.js'), 'Brak źródła speed-max-core.js w assets testów');
        assert(readAssetSource('js/app/optimizer/speed-max-bands.js'), 'Brak źródła speed-max-bands.js w assets testów');
        assert(readAssetSource('js/app/optimizer/speed-max-sheet-plan.js'), 'Brak źródła speed-max-sheet-plan.js w assets testów');
        assert(readAssetSource('js/app/optimizer/speed-max-half-sheet.js'), 'Brak źródła speed-max-half-sheet.js w assets testów');
        assert(readAssetSource('js/app/optimizer/speed-max.js'), 'Brak źródła speed-max.js w assets testów');
      }),

      makeTest('Kontrakty optymalizatora', 'Wzdłuż i W poprzek zachowują fizyczne mapowanie osi startu', 'Pilnuje nazewnictwa trybów: Wzdłuż ma startować osią długości płyty, a W poprzek osią poprzeczną według obecnego mapowania silnika.', ()=>{
        const alongSrc = readAssetSource('js/app/optimizer/start-along.js');
        const acrossSrc = readAssetSource('js/app/optimizer/start-across.js');
        assert(/label:\s*'Pierwsze pasy wzdłuż'/.test(alongSrc), 'start-along nie ma etykiety Wzdłuż', { alongSrc });
        assert(/resolvePrimaryAxis\(\)\{\s*return 'across';\s*\}/.test(alongSrc), 'start-along nie wskazuje osi lengthwise/across', { alongSrc });
        assert(/label:\s*'Pierwsze pasy w poprzek'/.test(acrossSrc), 'start-across nie ma etykiety W poprzek', { acrossSrc });
        assert(/resolvePrimaryAxis\(\)\{\s*return 'along';\s*\}/.test(acrossSrc), 'start-across nie wskazuje osi crosswise/along', { acrossSrc });
      }),

      makeTest('Kontrakty optymalizatora', 'Opti-max porównuje obie osie i wybiera lepszy preview', 'Pilnuje, żeby Opti-max nie został przypadkiem zabetonowany na jednym kierunku i nadal porównywał użyte pole, liczbę elementów oraz odpad.', ()=>{
        const src = readAssetSource('js/app/optimizer/start-optimax.js');
        assert(/previewAxis\('along'\)/.test(src), 'Opti-max nie wykonuje preview osi along', { src });
        assert(/previewAxis\('across'\)/.test(src), 'Opti-max nie wykonuje preview osi across', { src });
        assert(/usedArea/.test(src), 'Opti-max nie porównuje użytego pola', { src });
        assert(/placementCount/.test(src), 'Opti-max nie porównuje liczby elementów przy remisie pola', { src });
        assert(/waste/.test(src), 'Opti-max nie porównuje odpadu przy remisie pola i liczby elementów', { src });
      }),

      makeTest('Kontrakty optymalizatora', 'Źródło MAX zachowuje kolejność: 1–2 pasy startowe, potem obowiązkowy obrót osi', 'Pilnuje po splicie, żeby pierwsze pasy nie zostały przeniesione za domknięcie i żeby tryby Wzdłuż/W poprzek nie stały się tylko etykietą.', ()=>{
        const src = readAssetSource('js/app/optimizer/speed-max-sheet-plan.js');
        assert(src && /emitStage\(options, \{ phase:'start-axis', axis:startAxis \}\);/.test(src), 'speed-max-sheet-plan nie emituje start-axis z osią startową', { src:src && src.slice(15000, 23000) });
        assert(/phase:'start-pass-1-pick', axis:startAxis/.test(src), 'speed-max-sheet-plan nie wybiera pierwszego pasa na osi startowej', { src:src && src.slice(15000, 23000) });
        assert(/phase:'start-pass-2-pick', axis:startAxis/.test(src), 'speed-max-sheet-plan nie próbuje drugiego pasa na osi startowej', { src:src && src.slice(15000, 23000) });
        assert(/phase:'mandatory-axis-switch', from:startAxis, to:opposite\(startAxis\)/.test(src), 'speed-max-sheet-plan nie ma jawnego obowiązkowego przejścia na przeciwną oś po pasach startowych', { src:src && src.slice(15000, 23000) });
      }),

      makeTest('Kontrakty optymalizatora', 'Rzaz piły przesuwa kolejne formatki w prostym shelf packingu', 'Pilnuje, żeby kerf nie został zgubiony podczas późniejszego wyjmowania helperów układania z cut-optimizer/speed-max.', ()=>{
        const items = optimizerItems([
          { key:'kerf-a', name:'A', w:100, h:100, qty:1, rotationAllowed:false },
          { key:'kerf-b', name:'B', w:100, h:100, qty:1, rotationAllowed:false },
        ]);
        const noKerf = FC.cutOptimizer.packShelf(items, 220, 100, 0, 'across')[0];
        const withKerf = FC.cutOptimizer.packShelf(items, 220, 100, 10, 'across')[0];
        const noKerfXs = (noKerf.placements || []).map((p)=> p.x).sort((a,b)=> a-b);
        const withKerfXs = (withKerf.placements || []).map((p)=> p.x).sort((a,b)=> a-b);
        assert(noKerfXs[1] - noKerfXs[0] === 100, 'Bez rzazu odstęp nie wynosi szerokości elementu', { noKerfXs });
        assert(withKerfXs[1] - withKerfXs[0] === 110, 'Rzaz 10 mm nie został doliczony między formatkami', { withKerfXs });
      }),

      makeTest('Kontrakty optymalizatora', 'Słój blokuje obrót, a wyjątek free pozwala obrócić tylko wskazaną formatkę', 'Pilnuje kontraktu mapPartsForOptimizer → cutOptimizer: przy słojach obrót jest zablokowany, chyba że konkretna formatka ma wyjątek free.', ()=>{
        const part = { key:'grain-rot', name:'Front obrotowy', material:'Dąb dziki', w:220, h:980, qty:1 };
        const sig = fallbackPartSignature(part);
        const state = Fx.baseState({ boardW:1020, boardH:240, edgeTrim:10, kerf:0, grain:true, direction:'across' });
        const blocked = FC.rozrysEngine.computePlan(Object.assign({}, state, { grainExceptions:{} }), [part], {
          cutOptimizer: FC.cutOptimizer,
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const free = FC.rozrysEngine.computePlan(Object.assign({}, state, { grainExceptions:{ [sig]:'free' } }), [part], {
          cutOptimizer: FC.cutOptimizer,
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const freePlacements = (free.sheets || []).flatMap((sheet)=> (sheet.placements || []).filter((p)=> p && !p.unplaced));
        assert(countPlacements(blocked.sheets) === 0, 'Formatka wymagająca obrotu została rozłożona mimo blokady słojów', blocked);
        assert(freePlacements.length === 1 && freePlacements[0].rotated === true, 'Wyjątek free nie pozwolił obrócić konkretnej formatki', { freePlacements, free });
      }),

      makeTest('Kontrakty optymalizatora', 'Shelf packing rozkłada komplet wejściowych formatek, gdy wszystkie mieszczą się na arkuszu', 'Pilnuje podstawowej kompletności wyniku na stabilnym helperze bazowym przed przenoszeniem logiki do modułów speed-max.', ()=>{
        const sheets = FC.cutOptimizer.packShelf(optimizerItems([
          { key:'complete-a', name:'A', w:500, h:250, qty:2, rotationAllowed:false },
          { key:'complete-b', name:'B', w:250, h:250, qty:2, rotationAllowed:false },
        ]), 1000, 1000, 0, 'across');
        const placements = (sheets || []).flatMap((sheet)=> (sheet.placements || []).filter((p)=> p && !p.unplaced));
        const ids = new Set(placements.map((p)=> p.id));
        assert(placements.length === 4, 'Shelf packing nie rozłożył wszystkich czterech prostych formatek', { placements, sheets });
        assert(ids.size === 4, 'Shelf packing zduplikował albo zgubił identyfikatory formatek', { ids:Array.from(ids), placements });
      }),

      makeTest('Kontrakty optymalizatora', 'Mały pasek mieści się w domknięciu tego samego arkusza w bazowym packingu', 'Pilnuje praktycznej regresji: po dużym pasie mały pozostały pasek ma zostać możliwy do ułożenia na tej samej płycie.', ()=>{
        const sheets = FC.cutOptimizer.packShelf(optimizerItems([
          { key:'big-band', name:'Duży pas', w:1000, h:900, qty:1, rotationAllowed:false },
          { key:'small-strip', name:'Mały pasek', w:1000, h:100, qty:1, rotationAllowed:false },
        ]), 1000, 1000, 0, 'across');
        assert(Array.isArray(sheets) && sheets.length === 1, 'Bazowy packing otworzył nowy arkusz mimo że pasek mieścił się w domknięciu', sheets);
        assert(countPlacements(sheets) === 2, 'Bazowy packing nie umieścił dużego pasa i małego paska na tym samym arkuszu', sheets);
      }),

      makeTest('Kontrakty optymalizatora', 'MAX ma źródłowo ograniczony limit top 5 seedów', 'Pilnuje kosztu i jakości wyszukiwania przed splitem: pętle seedów mają używać MAX_TOP_SEEDS przez Math.min, a nie wrócić do jednego albo nieograniczonego przebiegu.', ()=>{
        const coreSrc = readAssetSource('js/app/optimizer/speed-max-core.js');
        const bandsSrc = readAssetSource('js/app/optimizer/speed-max-bands.js');
        assert(coreSrc && /const\s+MAX_TOP_SEEDS\s*=\s*5\s*;/.test(coreSrc), 'Brak stałej MAX_TOP_SEEDS = 5 w speed-max-core.js', { src:coreSrc && coreSrc.slice(0, 1600) });
        const guardedLoops = (bandsSrc.match(/Math\.min\(seeds\.length,\s*MAX_TOP_SEEDS\)/g) || []).length;
        assert(guardedLoops >= 2, 'Pętle seedów MAX nie używają limitu Math.min(seeds.length, MAX_TOP_SEEDS) w obu ścieżkach', { guardedLoops, src:bandsSrc && bandsSrc.slice(0, 12000) });
      }),

      makeTest('Kontrakty optymalizatora', 'Moduł core speed-max trzyma progi 95/90 i mapowanie lengthwise', 'Pilnuje stałych, które przed splitem muszą zostać przeniesione 1:1 do nowych modułów, bez cichej zmiany zachowania algorytmu.', ()=>{
        const src = readAssetSource('js/app/optimizer/speed-max-core.js');
        assert(src && /const\s+IDEAL_OCCUPANCY\s*=\s*0\.95\s*;/.test(src), 'Brak progu idealnego pasa 95% w speed-max-core.js', { src:src && src.slice(0, 1200) });
        assert(/const\s+MIN_OK_OCCUPANCY\s*=\s*0\.9\s*;/.test(src), 'Brak fallbackowego progu pasa 90% w speed-max-core.js', { src:src && src.slice(0, 1200) });
        assert(/const\s+MAX_TOP_SEEDS\s*=\s*5\s*;/.test(src), 'Brak limitu top 5 seedów w speed-max-core.js', { src:src && src.slice(0, 1200) });
        assert(/const\s+LENGTHWISE_AXIS\s*=\s*'across'\s*;/.test(src), 'Brak aktualnego mapowania lengthwise → across w speed-max-core.js', { src:src && src.slice(0, 1600) });
      }),
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);

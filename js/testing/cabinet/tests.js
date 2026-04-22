(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  host.FC_BOARD_THICKNESS_CM = host.FC_BOARD_THICKNESS_CM || (FC.materialCommon && FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8;
  host.FC_TOP_TRAVERSE_DEPTH_CM = host.FC_TOP_TRAVERSE_DEPTH_CM || (FC.materialCommon && FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9;
  host.fmtCm = host.fmtCm || (FC.materialCommon && FC.materialCommon.fmtCm) || function(v){ const n = Number(v); return Number.isFinite(n) ? (Math.round(n*10)/10).toString() : String(v ?? ''); };
  host.getCabinetFrontCutListForMaterials = host.getCabinetFrontCutListForMaterials || function(){ return []; };
  host.getHingeCountForCabinet = host.getHingeCountForCabinet || function(){ return 0; };
  host.getBlumAventosInfo = host.getBlumAventosInfo || function(){ return null; };

  function partByName(parts, name){ return (parts || []).find((part)=> part && part.name === name) || null; }

  function withCabinetGlobals(cfg, run){
    const prevProjectData = Object.prototype.hasOwnProperty.call(host, 'projectData') ? host.projectData : undefined;
    const prevUiState = Object.prototype.hasOwnProperty.call(host, 'uiState') ? host.uiState : undefined;
    const prevMaterials = Object.prototype.hasOwnProperty.call(host, 'materials') ? host.materials : undefined;
    const prevCabinetModalState = Object.prototype.hasOwnProperty.call(host, 'cabinetModalState') ? host.cabinetModalState : undefined;
    const prevStorageKeys = Object.prototype.hasOwnProperty.call(host, 'STORAGE_KEYS') ? host.STORAGE_KEYS : undefined;
    const prevRenderCabinets = Object.prototype.hasOwnProperty.call(host, 'renderCabinets') ? host.renderCabinets : undefined;
    const prevRenderTopHeight = Object.prototype.hasOwnProperty.call(host, 'renderTopHeight') ? host.renderTopHeight : undefined;
    const prevReq = Object.prototype.hasOwnProperty.call(host, 'requestAnimationFrame') ? host.requestAnimationFrame : undefined;
    const clone = (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone : (value)=> JSON.parse(JSON.stringify(value));
    try{
      host.projectData = clone(cfg.projectData || {
        schemaVersion: 9,
        kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 } },
        pokoj:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:5, counterThickness:1.8, gapHeight:0, ceilingBlende:0 } }
      });
      host.uiState = Object.assign({ roomType:'kuchnia', activeTab:'wywiad', selectedCabinetId:null, expanded:{}, lastAddedAt:null }, clone(cfg.uiState || {}));
      host.materials = clone(cfg.materials || [
        { name:'Laminat bazowy', materialType:'laminat' },
        { name:'Egger W1100 ST9', materialType:'laminat' },
        { name:'Akryl test', materialType:'akryl' },
        { name:'Lakier test', materialType:'lakier' }
      ]);
      host.cabinetModalState = clone(cfg.cabinetModalState || { mode:'add', editingId:null, draft:null, chosen:null, setPreset:null, setEditId:null });
      host.STORAGE_KEYS = Object.assign({ projectData:'fc_project_v1', ui:'fc_ui_v1' }, clone(cfg.storageKeys || {}));
      host.renderCabinets = function(){};
      host.renderTopHeight = function(){};
      host.requestAnimationFrame = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame : function(cb){ if(typeof cb === 'function') cb(); };
      return run();
    } finally {
      if(prevProjectData === undefined) { try{ delete host.projectData; }catch(_){ host.projectData = undefined; } }
      else host.projectData = prevProjectData;
      if(prevUiState === undefined) { try{ delete host.uiState; }catch(_){ host.uiState = undefined; } }
      else host.uiState = prevUiState;
      if(prevMaterials === undefined) { try{ delete host.materials; }catch(_){ host.materials = undefined; } }
      else host.materials = prevMaterials;
      if(prevCabinetModalState === undefined) { try{ delete host.cabinetModalState; }catch(_){ host.cabinetModalState = undefined; } }
      else host.cabinetModalState = prevCabinetModalState;
      if(prevStorageKeys === undefined) { try{ delete host.STORAGE_KEYS; }catch(_){ host.STORAGE_KEYS = undefined; } }
      else host.STORAGE_KEYS = prevStorageKeys;
      if(prevRenderCabinets === undefined) { try{ delete host.renderCabinets; }catch(_){ host.renderCabinets = undefined; } }
      else host.renderCabinets = prevRenderCabinets;
      if(prevRenderTopHeight === undefined) { try{ delete host.renderTopHeight; }catch(_){ host.renderTopHeight = undefined; } }
      else host.renderTopHeight = prevRenderTopHeight;
      if(prevReq === undefined) { try{ delete host.requestAnimationFrame; }catch(_){ host.requestAnimationFrame = undefined; } }
      else host.requestAnimationFrame = prevReq;
    }
  }

  function buildCabinetModalFixture(){
    if(typeof document === 'undefined' || !document || !document.body) return null;
    const wrap = document.createElement('div');
    wrap.setAttribute('data-test-fixture', 'cabinet-modal');
    wrap.innerHTML = `
      <div aria-modal="true" class="modal-back" id="cabinetModal" role="dialog">
        <div class="modal">
          <div class="header">
            <div style="display:flex;gap:12px;align-items:center">
              <div id="cabinetModalIcon">➕</div>
              <div>
                <div id="cabinetModalTitle">Dodaj</div>
                <div id="cabinetModalSubtitle">Wybierz rodzaj / zestaw</div>
              </div>
            </div>
            <div>
              <button type="button" id="cabinetModalCancel">Anuluj</button>
              <button type="button" id="cabinetModalSave" style="display:none">Zatwierdź</button>
            </div>
          </div>
          <div class="body">
            <div id="cabinetChoiceCard"><div id="cabinetTypeChoices"></div></div>
            <div id="cabinetFormArea" class="cabinet-choice-sync" style="display:none">
              <div class="card cabinet-config-card">
                <h3 class="section-title cabinet-config-card__title">Konfiguracja</h3>
                <div class="grid-3 cabinet-form-grid cabinet-form-grid--core">
                  <div>
                    <label>Wariant</label>
                    <select id="cmSubType" class="cabinet-choice-source" data-choice-title="Wybierz wariant" data-choice-placeholder="Wybierz wariant"></select>
                  </div>
                  <div>
                    <div id="cmFrontCountWrap">
                      <label id="cmFrontCountLabel">Ilość frontów</label>
                      <select id="cmFrontCount" class="cabinet-choice-source" data-choice-title="Wybierz ilość frontów" data-choice-placeholder="Wybierz ilość frontów"></select>
                      <div id="cmFrontCountStatic" style="display:none"></div>
                      <div id="cmFrontCountHint" style="display:none"></div>
                    </div>
                    <div id="cmFlapWrap" style="display:none">
                      <select id="cmFlapVendor" class="cabinet-choice-source" data-choice-title="Wybierz producenta podnośnika" data-choice-placeholder="Wybierz producenta podnośnika"><option value="blum">BLUM</option><option value="gtv">GTV</option><option value="hafele">HAFELE</option></select>
                      <div id="cmFlapKindWrap"><select id="cmFlapKind" class="cabinet-choice-source" data-choice-title="Wybierz rodzaj podnośnika" data-choice-placeholder="Wybierz rodzaj podnośnika"></select></div>
                      <div id="cmFlapInfo" style="display:none"></div>
                      <div id="cmFlapFrontInfo" style="display:none"></div>
                    </div>
                    <div id="cmShelvesWrap" class="cabinet-extra-field cabinet-extra-field--number cabinet-extra-field--compact" style="display:none"><label class="cabinet-extra-field__label">Półki (szt.)</label><input id="cmShelves" class="cabinet-extra-field__control" type="number"/></div>
                  </div>
                  <div>
                    <div id="cmHint" class="cabinet-inline-hint"></div>
                  </div>
                </div>
                <div id="cmExtraDetails" class="cabinet-extra-details"></div>
                <div id="cmDynamicHost"></div>
                <div class="grid-3 cabinet-form-grid">
                  <div><label>Szerokość</label><input id="cmWidth" type="number"/></div>
                  <div><label>Wysokość</label><input id="cmHeight" type="number"/></div>
                  <div><label>Głębokość</label><input id="cmDepth" type="number"/></div>
                  <div><label>Materiał frontu</label><select id="cmFrontMaterial" class="cabinet-choice-source" data-choice-title="Wybierz materiał frontu" data-choice-placeholder="Wybierz materiał frontu"><option value="laminat">Laminat</option><option value="akryl">Akryl</option><option value="lakier">Lakier</option></select></div>
                  <div><label>Kolor frontu</label><select id="cmFrontColor" class="cabinet-choice-source" data-choice-title="Wybierz kolor frontu" data-choice-placeholder="Wybierz kolor frontu"></select></div>
                  <div><label>Plecy</label><select id="cmBackMaterial" class="cabinet-choice-source" data-choice-title="Wybierz plecy" data-choice-placeholder="Wybierz plecy"><option value="HDF 3mm biała">HDF 3mm biała</option><option value="18 mm pod kolor korpusu">18 mm pod kolor</option><option value="Brak">Brak</option></select></div>
                  <div><label>Korpus</label><select id="cmBodyColor" class="cabinet-choice-source" data-choice-title="Wybierz korpus" data-choice-placeholder="Wybierz korpus"></select></div>
                  <div><label>Otwieranie</label><select id="cmOpeningSystem" class="cabinet-choice-source" data-choice-title="Wybierz system otwierania" data-choice-placeholder="Wybierz system otwierania"></select></div>
                </div>
              </div>
            </div>
            <div id="setWizardArea" class="cabinet-choice-sync" style="display:none">
              <div id="setWizardTitle"></div>
              <div id="setWizardDesc"></div>
              <div id="setTiles"></div>
              <button id="setWizardCreate" type="button"></button>
              <div id="setParams" style="display:none"></div>
              <div id="setFrontBlock" style="display:none">
                <select id="setFrontCount" class="cabinet-choice-source set-front-choice-source" data-launcher-label="Ilość frontów" data-choice-title="Wybierz ilość frontów zestawu" data-choice-placeholder="Ilość frontów"><option value="1">1</option><option value="2">2</option></select>
                <select id="setFrontMaterial" class="cabinet-choice-source set-front-choice-source" data-launcher-label="Materiał frontów" data-choice-title="Wybierz materiał frontów zestawu" data-choice-placeholder="Materiał frontów"><option value="laminat">Laminat</option><option value="akryl">Akryl</option><option value="lakier">Lakier</option></select>
                <select id="setFrontColor" class="cabinet-choice-source set-front-choice-source" data-launcher-label="Kolor frontów" data-choice-title="Wybierz kolor frontów zestawu" data-choice-placeholder="Kolor frontów"></select>
                <div id="setFrontHint"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function withCabinetModalFixture(cfg, run){
    return withCabinetGlobals(cfg, ()=>{
      if(typeof document === 'undefined' || !document || !document.body) return run(null);
      const fixture = buildCabinetModalFixture();
      try{
        return run(fixture);
      } finally {
        if(fixture && fixture.parentNode) fixture.parentNode.removeChild(fixture);
      }
    });
  }

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Szafki', 'Cutlista szafki nie dodaje pleców przy materiale Brak', 'Sprawdza, czy szafka z wyłączonymi plecami nie wrzuca fikcyjnej formatki do materiałów i ROZRYS.', ()=>{
        if(!FC.cabinetCutlist || typeof FC.cabinetCutlist.getCabinetCutList !== 'function') throw new Error('Brak getCabinetCutList');
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'stojąca', subType:'standard', width:60, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'Brak', details:{}
        }, 'kuchnia');
        H.assert(!parts.some((part)=> part && part.name === 'Plecy'), 'Cutlista nadal dodała plecy mimo materiału Brak', parts);
      }),
      H.makeTest('Szafki', 'Szafka stojąca ma dolny wieniec na pełną szerokość i dwa trawersy', 'Sprawdza, czy podstawowa geometria korpusu nie rozjechała się po refaktorach modułów szafki.', ()=>{
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'stojąca', subType:'standard', width:80, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'HDF', details:{}
        }, 'kuchnia');
        const bottom = partByName(parts, 'Wieniec dolny');
        const trawers = partByName(parts, 'Trawers górny (9 cm)');
        H.assert(bottom && bottom.a === 80, 'Wieniec dolny nie ma pełnej szerokości stojącej szafki', bottom || parts);
        H.assert(trawers && trawers.qty === 2, 'Brakuje dwóch trawersów górnych', trawers || parts);
      }),
      H.makeTest('Szafki', 'Wisząca podblatowa bez pleców zachowuje pełną wysokość boków', 'Sprawdza, czy wyjątek podblatowej wiszącej nie obcina boków i respektuje wyłączenie pleców.', ()=>{
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'wisząca', subType:'dolna_podblatowa', width:60, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'HDF', details:{ hasBack:'0' }
        }, 'kuchnia');
        const side = partByName(parts, 'Bok');
        H.assert(side && side.a === 72, 'Bok podblatowej wiszącej nie zachował pełnej wysokości', side || parts);
        H.assert(!parts.some((part)=> part && part.name === 'Plecy'), 'Podblatowa wisząca z hasBack=0 nadal dodała plecy', parts);
      }),
      H.makeTest('Szafki', 'Domyślny draft dla kuchni startuje jako szafka dolna z wysokością dolnych szafek', 'Pilnuje, czy Wywiad po otwarciu dodawania szafki w kuchni nadal zaczyna od bezpiecznego draftu dolnej szafki z ustawień pomieszczenia.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.makeDefaultCabinetDraftForRoom === 'function', 'Brak FC.cabinetModal.makeDefaultCabinetDraftForRoom');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetGlobals({
          projectData:{ schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:86, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 } } }
        }, ()=>{
          const draft = FC.cabinetModal.makeDefaultCabinetDraftForRoom('kuchnia');
          H.assert(draft && draft.type === 'stojąca', 'Domyślny draft kuchni nie startuje jako szafka stojąca', draft);
          H.assert(Number(draft.height) === 86, 'Domyślna wysokość draftu kuchni nie bierze bottomHeight z ustawień pokoju', draft);
          H.assert(Number(draft.depth) === 51, 'Domyślna głębokość draftu kuchni nie jest zgodna z bezpiecznym ustawieniem startowym', draft);
        });
      }),
      H.makeTest('Szafki', 'Domyślny draft potrafi sklonować ostatnio dodaną szafkę bez identyfikatorów technicznych', 'Pilnuje szybkiego dodawania serii szafek: po świeżym dodaniu nowy draft może kopiować poprzednią szafkę, ale nie może nieść starych id/setId.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.makeDefaultCabinetDraftForRoom === 'function', 'Brak FC.cabinetModal.makeDefaultCabinetDraftForRoom');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetGlobals({
          projectData:{ schemaVersion:9, pokoj:{ cabinets:[{ id:'cab_prev', setId:'set_prev', setNumber:3, width:91, height:210, depth:62, type:'moduł', subType:'uchylne', bodyColor:'Egger W1100 ST9', frontMaterial:'lakier', frontColor:'Biel', openingSystem:'TIP-ON', backMaterial:'Brak', details:{ shelves:2 } }], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:5, counterThickness:1.8, gapHeight:0, ceilingBlende:0 } } },
          uiState:{ lastAddedAt: Date.now(), roomType:'pokoj' }
        }, ()=>{
          const draft = FC.cabinetModal.makeDefaultCabinetDraftForRoom('pokoj');
          H.assert(draft && draft.type === 'moduł' && draft.subType === 'uchylne', 'Świeży draft nie sklonował ostatniej szafki', draft);
          H.assert(draft.id == null, 'Skopiowany draft nadal niesie stare id', draft);
          H.assert(!('setId' in draft), 'Skopiowany draft nadal niesie setId poprzedniej szafki', draft);
          H.assert(!('setNumber' in draft), 'Skopiowany draft nadal niesie setNumber poprzedniej szafki', draft);
        });
      }),
      H.makeTest('Szafki', 'Opcje otwierania dla wiszącej zachowują warianty tylko dla góry', 'Pilnuje, czy select otwierania w Wywiadzie nie gubi wariantów typowych dla szafek wiszących i nie miesza ich z dolnymi.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.populateOpeningOptionsTo === 'function', 'Brak FC.cabinetModal.populateOpeningOptionsTo');
        if(typeof document === 'undefined' || !document || !document.createElement) return;
        const hanging = document.createElement('select');
        const standing = document.createElement('select');
        FC.cabinetModal.populateOpeningOptionsTo(hanging, 'wisząca', 'podchwyt');
        FC.cabinetModal.populateOpeningOptionsTo(standing, 'stojąca', 'uchwyt klienta');
        const hangingValues = Array.from(hanging.options).map((opt)=> String(opt.value));
        const standingValues = Array.from(standing.options).map((opt)=> String(opt.value));
        H.assert(hangingValues.includes('podchwyt'), 'Select wiszącej nie zawiera wariantu podchwyt', hangingValues);
        H.assert(!standingValues.includes('podchwyt'), 'Select stojącej odziedziczył wariant podchwytu przeznaczony dla wiszącej', standingValues);
      }),
      H.makeTest('Szafki', 'Modal szafki w trybie dodawania renderuje natywne selecty jako źródło prawdy dla bezpiecznych pól', 'Pilnuje fundamentu pod przyszłe UI Wywiadu: modal szafki musi nadal mieć natywne selecty źródłowe dla pól wariant/front/plecy/korpus/otwieranie.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          FC.cabinetModal.openCabinetModalForAdd();
          const modal = document.getElementById('cabinetModal');
          const save = document.getElementById('cabinetModalSave');
          const ids = ['cmSubType','cmFrontMaterial','cmFrontColor','cmBackMaterial','cmBodyColor','cmOpeningSystem','cmFrontCount'];
          const fields = ids.map((id)=> document.getElementById(id));
          H.assert(modal && modal.style.display === 'flex', 'Modal szafki nie otworzył się w trybie dodawania', modal && modal.style.display);
          H.assert(save && save.textContent === 'Dodaj', 'Przycisk zapisu w trybie dodawania nie pokazuje CTA „Dodaj”', save && save.textContent);
          fields.forEach((field, idx)=>{
            H.assert(field && String(field.tagName).toLowerCase() === 'select', `Pole ${ids[idx]} nie jest natywnym selectem źródłowym`, field && field.outerHTML);
            H.assert(field.options.length >= 1, `Pole ${ids[idx]} nie dostało listy opcji po renderze modala`, field && field.outerHTML);
          });
        });
      }),
      H.makeTest('Szafki', 'Modal szafki utrzymuje uporządkowany shell konfiguracji po bezpiecznych poprawkach UI', 'Pilnuje drugą paczkę bezpiecznych zmian UI Wywiadu: część konfiguracji zachowuje lokalny shell, rytm siatki i klasy sekcji bez ruszania logiki formularza.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          FC.cabinetModal.openCabinetModalForAdd();
          const formArea = document.getElementById('cabinetFormArea');
          const configCard = document.querySelector('#cabinetFormArea .cabinet-config-card');
          const coreGrid = document.querySelector('#cabinetFormArea .cabinet-form-grid--core');
          const extra = document.getElementById('cmExtraDetails');
          H.assert(formArea && formArea.classList.contains('cabinet-choice-sync'), 'Formularz szafki stracił namespacowany shell cabinet-choice-sync', formArea && formArea.className);
          H.assert(!!configCard, 'Konfiguracja szafki nie renderuje lokalnej karty cabinet-config-card', configCard && configCard.outerHTML);
          H.assert(!!coreGrid, 'Podstawowa siatka konfiguracji nie renderuje klasy cabinet-form-grid--core', coreGrid && coreGrid.outerHTML);
          H.assert(extra && extra.classList.contains('cabinet-extra-details'), 'Kontener dodatkowych pól szafki nie zachował lokalnej klasy cabinet-extra-details', extra && extra.className);
        });
      }),

      H.makeTest('Szafki', 'Modal szafki renderuje launchery dla bezpiecznych selectów bez usuwania natywnych selectów', 'Pilnuje pierwszą paczkę UI Wywiadu: najbezpieczniejsze selecty w modalu szafki dostają launchery w stylu aplikacji, ale natywne selecty dalej pozostają w DOM jako źródło prawdy.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          FC.cabinetModal.openCabinetModalForAdd();
          ['cmSubType','cmFrontMaterial','cmFrontColor','cmBackMaterial','cmBodyColor','cmOpeningSystem','cmFrontCount'].forEach((id)=>{
            const select = document.getElementById(id);
            const slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + id + '"]');
            const btn = slot && slot.querySelector('.cabinet-choice-launch');
            H.assert(select && String(select.tagName || '').toLowerCase() === 'select', `Pole ${id} przestało istnieć jako natywny select`, select && select.outerHTML);
            H.assert(select && select.classList.contains('cabinet-choice-source--enhanced'), `Pole ${id} nie zostało oznaczone jako ukryty select źródłowy`, select && select.className);
            H.assert(!!btn, `Pole ${id} nie dostało launchera w stylu aplikacji`, slot && slot.innerHTML);
          });
        });
      }),
      H.makeTest('Szafki', 'Fallback mount nie zdejmuje launcherów z selectów już ukrytych pod overlayem', 'Pilnuje prawdziwej regresji z aplikacji: po oznaczeniu selecta jako ukrytego źródła kolejny przebieg fallbacku nie może sprzątnąć launchera i przywrócić systemowego selecta.', ()=>{
        H.assert(FC.cabinetChoiceLaunchers && typeof FC.cabinetChoiceLaunchers.mountVisibleFallbackLaunchers === 'function', 'Brak FC.cabinetChoiceLaunchers.mountVisibleFallbackLaunchers');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const style = document.createElement('style');
          style.textContent = '.cabinet-choice-source--enhanced{display:none!important;}';
          document.head.appendChild(style);
          try{
            FC.cabinetModal.openCabinetModalForAdd();
            const select = document.getElementById('cmFrontMaterial');
            let slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFrontMaterial"]');
            let launcher = slot && slot.querySelector('.cabinet-choice-launch');
            H.assert(!!launcher, 'Przed fallbackiem nie zbudowano launchera materiału frontu', slot && slot.innerHTML);
            FC.cabinetChoiceLaunchers.mountVisibleFallbackLaunchers(document.getElementById('cabinetFormArea'));
            slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFrontMaterial"]');
            launcher = slot && slot.querySelector('.cabinet-choice-launch');
            H.assert(select && select.classList.contains('cabinet-choice-source--enhanced'), 'Fallback zdjął klasę ukrytego selecta źródłowego', select && select.className);
            H.assert(!!launcher, 'Fallback usunął launcher i odsłonił natywny select', slot && slot.innerHTML);
          } finally {
            style.remove();
          }
        });
      }),

      H.makeTest('Szafki', 'Launcher bezpiecznego selecta aktualizuje natywny select i draft szafki', 'Pilnuje, czy nowy launcher UI Wywiadu tylko przykrywa select, ale dalej zapisuje wybór do źródłowego selecta i draftu formularza.', async ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        H.assert(FC.rozrysChoice && typeof FC.rozrysChoice.openRozrysChoiceOverlay === 'function', 'Brak FC.rozrysChoice.openRozrysChoiceOverlay');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, async ()=>{
          const prevOpen = FC.rozrysChoice.openRozrysChoiceOverlay;
          try{
            FC.rozrysChoice.openRozrysChoiceOverlay = async ()=> 'akryl';
            FC.cabinetModal.openCabinetModalForAdd();
            const draft = host.cabinetModalState && host.cabinetModalState.draft;
            const select = document.getElementById('cmFrontMaterial');
            const launcher = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFrontMaterial"] .cabinet-choice-launch');
            H.assert(!!launcher, 'Launcher materiału frontu nie został zbudowany');
            launcher.click();
            await new Promise((resolve)=> setTimeout(resolve, 0));
            H.assert(String(select && select.value || '') === 'akryl', 'Launcher nie zaktualizował natywnego selecta materiału frontu', { value:select && select.value });
            H.assert(draft && draft.frontMaterial === 'akryl', 'Launcher nie zaktualizował draftu szafki przez native select', draft);
          } finally {
            FC.rozrysChoice.openRozrysChoiceOverlay = prevOpen;
          }
        });
      }),

      H.makeTest('Szafki', 'Druga paczka launcherów obejmuje kolor frontu i liczbę frontów bez utraty natywnego selecta', 'Pilnuje kolejny etap UI Wywiadu: kolor frontu i liczba frontów też dostają launcher aplikacyjny, ale select źródłowy nadal pozostaje w DOM i dalej napędza draft.', async ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        H.assert(FC.rozrysChoice && typeof FC.rozrysChoice.openRozrysChoiceOverlay === 'function', 'Brak FC.rozrysChoice.openRozrysChoiceOverlay');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, async ()=>{
          const prevOpen = FC.rozrysChoice.openRozrysChoiceOverlay;
          try{
            FC.cabinetModal.openCabinetModalForAdd();
            const draft = host.cabinetModalState && host.cabinetModalState.draft;
            const frontColorSelect = document.getElementById('cmFrontColor');
            const frontCountSelect = document.getElementById('cmFrontCount');
            const frontColorLauncher = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFrontColor"] .cabinet-choice-launch');
            const frontCountLauncher = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFrontCount"] .cabinet-choice-launch');
            H.assert(frontColorSelect && String(frontColorSelect.tagName || '').toLowerCase() === 'select', 'Pole cmFrontColor przestało istnieć jako natywny select', frontColorSelect && frontColorSelect.outerHTML);
            H.assert(frontCountSelect && String(frontCountSelect.tagName || '').toLowerCase() === 'select', 'Pole cmFrontCount przestało istnieć jako natywny select', frontCountSelect && frontCountSelect.outerHTML);
            H.assert(!!frontColorLauncher, 'Pole cmFrontColor nie dostało launchera aplikacyjnego');
            H.assert(!!frontCountLauncher, 'Pole cmFrontCount nie dostało launchera aplikacyjnego');

            FC.rozrysChoice.openRozrysChoiceOverlay = async ({ title })=> /kolor/i.test(String(title || '')) ? String(frontColorSelect.options[0] && frontColorSelect.options[0].value || '') : '1';
            frontColorLauncher.click();
            await new Promise((resolve)=> setTimeout(resolve, 0));
            H.assert(String(draft && draft.frontColor || '') === String(frontColorSelect && frontColorSelect.value || ''), 'Launcher koloru frontu nie zaktualizował draftu przez natywny select', draft);

            FC.rozrysChoice.openRozrysChoiceOverlay = async ()=> '1';
            frontCountLauncher.click();
            await new Promise((resolve)=> setTimeout(resolve, 0));
            H.assert(String(frontCountSelect && frontCountSelect.value || '') === '1', 'Launcher liczby frontów nie zaktualizował natywnego selecta', frontCountSelect && frontCountSelect.value);
            H.assert(Number(draft && draft.frontCount || 0) === 1, 'Launcher liczby frontów nie zaktualizował draftu', draft);
          } finally {
            FC.rozrysChoice.openRozrysChoiceOverlay = prevOpen;
          }
        });
      }),


      H.makeTest('Szafki', 'Dynamiczny select Wnętrze dostaje launcher bez gubienia źródłowego selecta', 'Pilnuje, czy dodatkowe pola dokładane w trakcie renderu modala szafki też przechodzą na launcher aplikacyjny, ale nadal zostawiają natywny select jako źródło prawdy.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          FC.cabinetModal.openCabinetModalForAdd();
          const select = document.getElementById('cmExtraSelectInsideMode');
          const slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmExtraSelectInsideMode"]');
          const btn = slot && slot.querySelector('.cabinet-choice-launch');
          H.assert(select && String(select.tagName || '').toLowerCase() === 'select', 'Dynamiczne pole Wnętrze nie istnieje jako natywny select', select && select.outerHTML);
          H.assert(!!btn, 'Dynamiczne pole Wnętrze nie dostało launchera aplikacyjnego', slot && slot.innerHTML);
        });
      }),

      H.makeTest('Szafki', 'Zestaw renderuje launchery dla frontów bez utraty natywnych selectów', 'Pilnuje, czy blok frontów w zestawie też używa launcherów aplikacyjnych, ale selecty źródłowe nadal pozostają w DOM.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          host.cabinetModalState.chosen = 'zestaw';
          host.cabinetModalState.setPreset = 'A';
          FC.cabinetModal.renderCabinetModal();
          const frontBlock = document.getElementById('setFrontBlock');
          if(frontBlock) frontBlock.style.display = 'block';
          FC.cabinetModal.renderCabinetModal();
          ['setFrontCount','setFrontMaterial','setFrontColor'].forEach((id)=>{
            const select = document.getElementById(id);
            const slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + id + '"]');
            const btn = slot && slot.querySelector('.cabinet-choice-launch');
            H.assert(select && String(select.tagName || '').toLowerCase() === 'select', `Pole ${id} przestało istnieć jako natywny select`, select && select.outerHTML);
            H.assert(!!btn, `Pole ${id} w zestawie nie dostało launchera aplikacyjnego`, slot && slot.innerHTML);
          });
        });
      }),

      H.makeTest('Szafki', 'Zmiana materiału frontów zestawu od razu odświeża kolor i launcher', 'Pilnuje regresji set-wizarda: po przejściu z laminatu na akryl/lakier ukryty select koloru i jego launcher mają od razu pokazać pierwszy kolor z nowego materiału, bez czekania na zapis.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({
          materials:[
            { name:'Egger W1100 ST9', materialType:'laminat' },
            { name:'Akryl test', materialType:'akryl' },
            { name:'Kaszmir angielskie', materialType:'lakier' }
          ]
        }, ()=>{
          host.cabinetModalState.chosen = 'zestaw';
          host.cabinetModalState.setPreset = 'C';
          FC.cabinetModal.renderCabinetModal();
          const matSel = document.getElementById('setFrontMaterial');
          const colSel = document.getElementById('setFrontColor');
          H.assert(!!matSel && !!colSel, 'Brak pól frontów zestawu', { matSel:!!matSel, colSel:!!colSel });
          matSel.value = 'lakier';
          if(typeof matSel.onchange === 'function') matSel.onchange({ target: matSel });
          H.assert(String(colSel.value || '') === 'Kaszmir angielskie', 'Zmiana materiału zestawu nie ustawiła pierwszego koloru z nowego materiału', colSel && colSel.outerHTML);
          const slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="setFrontColor"]');
          const label = slot && slot.querySelector('.rozrys-choice-launch__label');
          H.assert(String(label && label.textContent || '').includes('Kaszmir angielskie'), 'Launcher koloru zestawu nie odświeżył się po zmianie materiału', slot && slot.innerHTML);
        });
      }),

      H.makeTest('Szafki', 'Materiały zestawu pokazują fronty i zawiasy tylko na pierwszym korpusie zestawu', 'Pilnuje regresji materiałów zestawu: fronty wygenerowane dla całego zestawu mają pojawić się przy pierwszym korpusie, a kolejne korpusy zestawu nie mogą dublować frontów ani zawiasów.', ()=>{
        H.assert(FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function', 'Brak FC.cabinetCutlist.getCabinetCutList');
        return withCabinetGlobals({
          projectData:{
            schemaVersion:9,
            kuchnia:{
              cabinets:[
                { id:'cab-set-1', setId:'set-1', setNumber:1, setRole:'dolny', type:'stojąca', subType:'standardowa', width:93, height:210, depth:60, bodyColor:'Egger W1100 ST9 Biały Alpejski', frontMaterial:'lakier', frontColor:'Kaszmir angielskie', backMaterial:'HDF 3mm biała', openingSystem:'uchwyt klienta', frontCount:2, details:{} },
                { id:'cab-set-2', setId:'set-1', setNumber:1, setRole:'gorny_modul', type:'moduł', subType:'standardowa', width:93, height:25, depth:59, bodyColor:'Egger W1100 ST9 Biały Alpejski', frontMaterial:'lakier', frontColor:'Kaszmir angielskie', backMaterial:'HDF 3mm biała', openingSystem:'uchwyt klienta', frontCount:0, details:{} }
              ],
              fronts:[
                { id:'front-1', setId:'set-1', setNumber:1, material:'lakier', color:'Kaszmir angielskie', width:46.5, height:235, note:'Zestaw 1: front lewy' },
                { id:'front-2', setId:'set-1', setNumber:1, material:'lakier', color:'Kaszmir angielskie', width:46.5, height:235, note:'Zestaw 1: front prawy' }
              ],
              sets:[{ id:'set-1', presetId:'C', number:1, frontCount:2, frontMaterial:'lakier', frontColor:'Kaszmir angielskie', params:{ w:93, hB:210, hTop:25, dBottom:60, dModule:59, blende:5 } }],
              settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:0, ceilingBlende:5 }
            }
          }
        }, ()=>{
          const leadParts = FC.cabinetCutlist.getCabinetCutList(host.projectData.kuchnia.cabinets[0], 'kuchnia');
          const followerParts = FC.cabinetCutlist.getCabinetCutList(host.projectData.kuchnia.cabinets[1], 'kuchnia');
          const leadFront = partByName(leadParts, 'Front');
          const followerFront = partByName(followerParts, 'Front');
          const leadHinges = partByName(leadParts, 'Zawias BLUM');
          const followerHinges = partByName(followerParts, 'Zawias BLUM');
          H.assert(leadFront && Number(leadFront.qty) === 2, 'Pierwszy korpus zestawu nie dostał wspólnych frontów zestawu', leadParts);
          H.assert(String(leadFront && leadFront.material || '').includes('lakier') && String(leadFront && leadFront.material || '').includes('Kaszmir angielskie'), 'Fronty zestawu na pierwszym korpusie nie trzymają wybranego materiału/koloru', leadFront || leadParts);
          H.assert(leadHinges && Number(leadHinges.qty) >= 4, 'Pierwszy korpus zestawu nie dostał wspólnej liczby zawiasów zestawu', leadParts);
          H.assert(!followerFront, 'Kolejny korpus zestawu nadal duplikuje fronty', followerParts);
          H.assert(!followerHinges, 'Kolejny korpus zestawu nadal duplikuje zawiasy', followerParts);
        });
      }),


      H.makeTest('Szafki', 'Moduł z podnośnikiem renderuje launcher rodzaju bez powrotu do systemowego selecta', 'Pilnuje, czy przy module uchylnym pole rodzaju podnośnika też korzysta z launchera aplikacyjnego, a select źródłowy zostaje tylko pod spodem.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          host.cabinetModalState.chosen = 'moduł';
          host.cabinetModalState.draft = { type:'moduł', subType:'uchylne', width:60, height:94.2, depth:36, frontMaterial:'laminat', frontColor:'Egger W1100 ST9 Biały Alpejski', backMaterial:'HDF 3mm biała', bodyColor:'Egger W1100 ST9 Biały Alpejski', openingSystem:'uchwyt klienta', frontCount:1, details:{ flapVendor:'blum', flapKind:'HKI', shelves:2 } };
          FC.cabinetModal.renderCabinetModal();
          const select = document.getElementById('cmFlapKind');
          const slot = document.querySelector('.cabinet-choice-launch-slot[data-launch-for="cmFlapKind"]');
          const btn = slot && slot.querySelector('.cabinet-choice-launch');
          H.assert(select && String(select.tagName || '').toLowerCase() === 'select', 'Pole cmFlapKind przestało istnieć jako natywny select', select && select.outerHTML);
          H.assert(select && select.classList.contains('cabinet-choice-source--enhanced'), 'Pole cmFlapKind nie zostało oznaczone jako ukryty select źródłowy', select && select.className);
          H.assert(!!btn, 'Pole cmFlapKind nie dostało launchera aplikacyjnego', slot && slot.innerHTML);
        });
      }),

      H.makeTest('Szafki', 'Zestaw liczy parametry bez zależności od globalnej calcTopForSet', 'Pilnuje, czy render zestawu korzysta z namespacowanego helpera obliczeń i nie zależy od przypadkowej globalki z app.js.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const prevGlobal = Object.prototype.hasOwnProperty.call(host, 'calcTopForSet') ? host.calcTopForSet : undefined;
          try{
            try{ delete host.calcTopForSet; }catch(_){ host.calcTopForSet = undefined; }
            host.cabinetModalState.chosen = 'zestaw';
            host.cabinetModalState.setPreset = 'A';
            FC.cabinetModal.renderCabinetModal();
            const result = document.getElementById('setHTopResult');
            H.assert(result && String(result.value || '') !== '', 'Render zestawu dalej zależy od globalnej calcTopForSet', result && result.outerHTML);
          } finally {
            if(prevGlobal === undefined){ try{ delete host.calcTopForSet; }catch(_){ host.calcTopForSet = undefined; } }
            else host.calcTopForSet = prevGlobal;
          }
        });
      }),

      H.makeTest('Szafki', 'Edycja zestawu ładuje preset i parametry po wydzieleniu set-wizarda', 'Pilnuje etap 3 ujarzmiania Wywiadu: otwarcie edycji istniejącego zestawu ma dalej wejść w tryb zestawu i wczytać realne parametry bez trzymania tej logiki w monolicie cabinet-modal.js.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openSetWizardForEdit === 'function', 'Brak FC.cabinetModal.openSetWizardForEdit');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({
          projectData:{
            schemaVersion: 9,
            kuchnia:{
              cabinets:[],
              fronts:[],
              sets:[{ id:'set-1', presetId:'D', number:4, params:{ presetId:'D', w:80, hB:82, hM:100, hTop:58, dBottom:51, dModule:50, blende:10 }, frontCount:2, frontMaterial:'laminat', frontColor:'Egger W1100 ST9' }],
              settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 }
            },
            pokoj:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:5, counterThickness:1.8, gapHeight:0, ceilingBlende:0 } }
          }
        }, ()=>{
          FC.cabinetModal.openSetWizardForEdit('set-1');
          H.assert(host.cabinetModalState && host.cabinetModalState.chosen === 'zestaw', 'Edycja zestawu nie ustawiła trybu zestawu', host.cabinetModalState);
          H.assert(String(host.cabinetModalState && host.cabinetModalState.setEditId || '') === 'set-1', 'Edycja zestawu nie zapamiętała setEditId', host.cabinetModalState);
          H.assert(String(host.cabinetModalState && host.cabinetModalState.setPreset || '') === 'D', 'Edycja zestawu nie zapamiętała presetu', host.cabinetModalState);
          H.assert(String(document.getElementById('setWizardArea') && document.getElementById('setWizardArea').style.display || '') === 'block', 'Set wizard nie został pokazany przy edycji zestawu');
          H.assert(String(document.getElementById('setWizardCreate') && document.getElementById('setWizardCreate').textContent || '') === 'Zapisz zmiany', 'Przycisk edycji zestawu nie wrócił jako Zapisz zmiany', document.getElementById('setWizardCreate') && document.getElementById('setWizardCreate').outerHTML);
          H.assert(String(document.getElementById('setW') && document.getElementById('setW').value || '') === '80', 'Nie wczytano szerokości zestawu D', document.getElementById('setW') && document.getElementById('setW').outerHTML);
          H.assert(String(document.getElementById('setHMiddle') && document.getElementById('setHMiddle').value || '') === '100', 'Nie wczytano wysokości modułu środkowego zestawu D', document.getElementById('setHMiddle') && document.getElementById('setHMiddle').outerHTML);
          H.assert(String(document.getElementById('setFrontColor') && document.getElementById('setFrontColor').value || '') === 'Egger W1100 ST9', 'Nie wczytano koloru frontów zestawu przy edycji', document.getElementById('setFrontColor') && document.getElementById('setFrontColor').outerHTML);
        });
      }),

      H.makeTest('Szafki', 'Modal szafki renderuje warianty bez zależności od globalnej getSubTypeOptionsForType', 'Pilnuje antyregresję środowiska testowego i przyszłego splitu Wywiadu: modal szafki ma czytać warianty z FC.cabinetFronts, a nie wymagać przypadkowej globalki z app.js.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const prevGlobal = Object.prototype.hasOwnProperty.call(host, 'getSubTypeOptionsForType') ? host.getSubTypeOptionsForType : undefined;
          try{
            try{ delete host.getSubTypeOptionsForType; }catch(_){ host.getSubTypeOptionsForType = undefined; }
            FC.cabinetModal.openCabinetModalForAdd();
            const subType = document.getElementById('cmSubType');
            H.assert(subType && subType.options.length >= 1, 'Modal szafki dalej zależy od globalnej getSubTypeOptionsForType', subType && subType.outerHTML);
          } finally {
            if(prevGlobal === undefined){ try{ delete host.getSubTypeOptionsForType; }catch(_){ host.getSubTypeOptionsForType = undefined; } }
            else host.getSubTypeOptionsForType = prevGlobal;
          }
        });
      }),
      H.makeTest('Szafki', 'Modal szafki aktualizuje draft po zmianie kluczowych selectów', 'Pilnuje, czy najbezpieczniejsze pola formularza dalej aktualizują draft szafki przez natywne selecty — to ma zostać źródłem prawdy także po przyszłym liftingu UI Wywiadu.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          FC.cabinetModal.openCabinetModalForAdd();
          const draft = host.cabinetModalState && host.cabinetModalState.draft;
          H.assert(!!draft, 'Modal dodawania nie zbudował draftu szafki');
          const frontMaterial = document.getElementById('cmFrontMaterial');
          const backMaterial = document.getElementById('cmBackMaterial');
          const bodyColor = document.getElementById('cmBodyColor');
          const opening = document.getElementById('cmOpeningSystem');
          frontMaterial.value = 'akryl';
          frontMaterial.onchange({ target: frontMaterial });
          backMaterial.value = 'Brak';
          backMaterial.onchange({ target: backMaterial });
          if(bodyColor.options.length > 1) bodyColor.value = bodyColor.options[1].value;
          bodyColor.onchange({ target: bodyColor });
          if(opening.options.length > 1) opening.value = opening.options[1].value;
          opening.onchange({ target: opening });
          H.assert(draft.frontMaterial === 'akryl', 'Zmiana materiału frontu nie zapisała się do draftu', draft);
          H.assert(draft.backMaterial === 'Brak', 'Zmiana pleców nie zapisała się do draftu', draft);
          H.assert(draft.bodyColor === bodyColor.value, 'Zmiana koloru korpusu nie zapisała się do draftu', { expected:bodyColor.value, draft });
          H.assert(draft.openingSystem === opening.value, 'Zmiana systemu otwierania nie zapisała się do draftu', { expected:opening.value, draft });
        });
      }),
      H.makeTest('Szafki', 'Zmiana subtype stojącej na zmywarkową dalej przelicza szerokość i przegrody techniczne', 'Pilnuje etapu 4 splitu typów: po wydzieleniu stojącej zmiana subtype w modalu nadal ma zsynchronizować szerokość zmywarki i liczbę przegród technicznych bez logiki zaszytej w monolicie.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({
          projectData:{ schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 } } }
        }, ()=>{
          host.cabinetModalState.chosen = 'stojąca';
          host.cabinetModalState.draft = { type:'stojąca', subType:'standardowa', width:60, height:90, depth:56, frontMaterial:'laminat', frontColor:'Egger W1100 ST9', backMaterial:'HDF 3mm biała', bodyColor:'Egger W1100 ST9', openingSystem:'uchwyt klienta', frontCount:2, details:{ dishWasherWidth:'45' } };
          FC.cabinetModal.renderCabinetModal();
          const sub = document.getElementById('cmSubType');
          H.assert(!!sub, 'Brak selecta subtype');
          sub.value = 'zmywarkowa';
          sub.onchange();
          const draft = host.cabinetModalState && host.cabinetModalState.draft;
          H.assert(String(draft && draft.subType || '') === 'zmywarkowa', 'Subtype stojącej nie przełączył się na zmywarkową', draft);
          H.assert(Number(draft && draft.width || 0) === 45, 'Zmywarkowa nie przejęła szerokości z details.dishWasherWidth po zmianie subtype', draft);
          H.assert(String(draft && draft.details && draft.details.techDividerCount || '') === '3', 'Zmywarkowa nie przeliczyła przegród technicznych po zmianie subtype', draft && draft.details);
        });
      }),

      H.makeTest('Szafki', 'Zmiana subtype modułu na uchylne dalej przełącza modal na logikę klapy', 'Pilnuje etapu 4 splitu typów: po wydzieleniu modułu zmiana subtype na uchylne nadal ma wymusić tryb klapy i pokazać pola podnośnika bez regresji.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetModal === 'function', 'Brak FC.cabinetModal.renderCabinetModal');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          host.cabinetModalState.chosen = 'moduł';
          host.cabinetModalState.draft = { type:'moduł', subType:'standardowa', width:60, height:90, depth:36, frontMaterial:'laminat', frontColor:'Egger W1100 ST9', backMaterial:'HDF 3mm biała', bodyColor:'Egger W1100 ST9', openingSystem:'uchwyt klienta', frontCount:2, details:{} };
          FC.cabinetModal.renderCabinetModal();
          const sub = document.getElementById('cmSubType');
          H.assert(!!sub, 'Brak selecta subtype modułu');
          sub.value = 'uchylne';
          sub.onchange();
          const draft = host.cabinetModalState && host.cabinetModalState.draft;
          const flapWrap = document.getElementById('cmFlapWrap');
          H.assert(String(draft && draft.subType || '') === 'uchylne', 'Subtype modułu nie przełączył się na uchylne', draft);
          H.assert(Number(draft && draft.frontCount || 0) === 1, 'Moduł uchylny nie wymusił automatycznej liczby frontów po zmianie subtype', draft);
          H.assert(flapWrap && String(flapWrap.style.display || '') === 'block', 'Moduł uchylny nie pokazał sekcji podnośnika po zmianie subtype', flapWrap && flapWrap.outerHTML);
        });
      }),

      H.makeTest('Szafki', 'Modal szafki w trybie edycji ładuje dane i pokazuje CTA „Zapisz zmiany”', 'Pilnuje, czy edycja istniejącej szafki nadal otwiera modal z prawidłowym tytułem, danymi draftu i przyciskiem zapisu pod późniejsze prace UI Wywiadu.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForEdit === 'function', 'Brak FC.cabinetModal.openCabinetModalForEdit');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({
          projectData:{ schemaVersion:9, kuchnia:{ cabinets:[{ id:'cab_edit', width:77, height:92, depth:58, type:'stojąca', subType:'standardowa', bodyColor:'Egger W1100 ST9', frontMaterial:'lakier', frontColor:'Lakier test', openingSystem:'korytkowy', backMaterial:'Brak', details:{} }], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 } } }
        }, ()=>{
          FC.cabinetModal.openCabinetModalForEdit('cab_edit');
          const title = document.getElementById('cabinetModalTitle');
          const save = document.getElementById('cabinetModalSave');
          const width = document.getElementById('cmWidth');
          const frontMaterial = document.getElementById('cmFrontMaterial');
          H.assert(title && /Edytuj szafkę/.test(String(title.textContent || '')), 'Modal edycji nie pokazuje tytułu „Edytuj szafkę”', title && title.textContent);
          H.assert(save && save.textContent === 'Zapisz zmiany', 'Modal edycji nie pokazuje CTA „Zapisz zmiany”', save && save.textContent);
          H.assert(String(width && width.value || '') === '77', 'Modal edycji nie załadował szerokości istniejącej szafki', { width:width && width.value });
          H.assert(String(frontMaterial && frontMaterial.value || '') === 'lakier', 'Modal edycji nie załadował materiału frontu istniejącej szafki', { frontMaterial: frontMaterial && frontMaterial.value });
        });
      }),

      H.makeTest('Szafki', 'Modal szafki zapisuje nową szafkę przez wydzieloną finalizację bez zmiany zachowania', 'Pilnuje etapu 5: przycisk Dodaj nadal finalizuje draft zwykłej szafki, zapisuje ją do projektu, odświeża listę i zamyka modal.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForAdd === 'function', 'Brak FC.cabinetModal.openCabinetModalForAdd');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const prevProjectApi = FC.project;
          const prevStorageApi = FC.storage;
          const prevRenderCabinets = host.renderCabinets;
          let renderCount = 0;
          let storageCalls = 0;
          try{
            FC.project = Object.assign({}, FC.project, { save:(pd)=> pd });
            FC.storage = Object.assign({}, FC.storage, { setJSON:()=>{ storageCalls += 1; } });
            host.renderCabinets = ()=>{ renderCount += 1; };
            FC.cabinetModal.openCabinetModalForAdd();
            const width = document.getElementById('cmWidth');
            const save = document.getElementById('cabinetModalSave');
            H.assert(!!save, 'Brak przycisku zapisu modala');
            width.value = '73';
            if(typeof save.onclick === 'function') save.onclick({ preventDefault(){}, stopPropagation(){}, target:save });
            const cabinets = (((host.projectData || {}).kuchnia || {}).cabinets) || [];
            const modal = document.getElementById('cabinetModal');
            H.assert(cabinets.length === 1, 'Dodanie szafki nie zapisało nowego rekordu do projektu', cabinets);
            H.assert(Number(cabinets[0] && cabinets[0].width || 0) === 73, 'Zapis nowej szafki nie pobrał szerokości z formularza', cabinets[0]);
            H.assert(renderCount === 1, 'Finalizacja dodania nie odświeżyła listy szafek dokładnie raz', { renderCount });
            H.assert(storageCalls === 1, 'Finalizacja dodania nie zapisała uiState dokładnie raz', { storageCalls });
            H.assert(modal && modal.style.display === 'none', 'Modal po dodaniu szafki nie został zamknięty', modal && modal.style.display);
          } finally {
            FC.project = prevProjectApi;
            FC.storage = prevStorageApi;
            host.renderCabinets = prevRenderCabinets;
          }
        });
      }),

      H.makeTest('Szafki', 'Modal szafki zapisuje edycję istniejącej szafki przez wydzieloną finalizację', 'Pilnuje etapu 5: zapis edycji nadal aktualizuje istniejącą szafkę po id zamiast tworzyć duplikat, odświeża listę i zamyka modal.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.openCabinetModalForEdit === 'function', 'Brak FC.cabinetModal.openCabinetModalForEdit');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({
          projectData:{ schemaVersion:9, kuchnia:{ cabinets:[{ id:'cab_edit', width:77, height:92, depth:58, type:'stojąca', subType:'standardowa', bodyColor:'Egger W1100 ST9', frontMaterial:'lakier', frontColor:'Lakier test', openingSystem:'korytkowy', backMaterial:'Brak', details:{} }], fronts:[], sets:[], settings:{ roomHeight:250, bottomHeight:82, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 } } }
        }, ()=>{
          const prevProjectApi = FC.project;
          const prevStorageApi = FC.storage;
          const prevRenderCabinets = host.renderCabinets;
          let renderCount = 0;
          let storageCalls = 0;
          try{
            FC.project = Object.assign({}, FC.project, { save:(pd)=> pd });
            FC.storage = Object.assign({}, FC.storage, { setJSON:()=>{ storageCalls += 1; } });
            host.renderCabinets = ()=>{ renderCount += 1; };
            FC.cabinetModal.openCabinetModalForEdit('cab_edit');
            const width = document.getElementById('cmWidth');
            const save = document.getElementById('cabinetModalSave');
            width.value = '81';
            if(typeof save.onclick === 'function') save.onclick({ preventDefault(){}, stopPropagation(){}, target:save });
            const cabinets = (((host.projectData || {}).kuchnia || {}).cabinets) || [];
            const modal = document.getElementById('cabinetModal');
            H.assert(cabinets.length === 1, 'Edycja szafki utworzyła duplikat zamiast zaktualizować rekord', cabinets);
            H.assert(String(cabinets[0] && cabinets[0].id || '') === 'cab_edit', 'Edycja szafki nie zachowała istniejącego id', cabinets[0]);
            H.assert(Number(cabinets[0] && cabinets[0].width || 0) === 81, 'Edycja szafki nie pobrała nowej szerokości z formularza', cabinets[0]);
            H.assert(renderCount === 1, 'Finalizacja edycji nie odświeżyła listy szafek dokładnie raz', { renderCount });
            H.assert(storageCalls === 1, 'Finalizacja edycji nie zapisała uiState dokładnie raz', { storageCalls });
            H.assert(modal && modal.style.display === 'none', 'Modal po zapisaniu edycji szafki nie został zamknięty', modal && modal.style.display);
          } finally {
            FC.project = prevProjectApi;
            FC.storage = prevStorageApi;
            host.renderCabinets = prevRenderCabinets;
          }
        });
      }),

      H.makeTest('Szafki', 'Dynamiczne selecty lodówki renderują launchery bez usuwania selectów źródłowych', 'Pilnuje kolejny krok Wywiadu: dynamiczne selecty lodówki w dodatkowych polach też mają aplikacyjne launchery, a natywne selecty dalej zostają źródłem prawdy.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetExtraDetailsInto === 'function', 'Brak FC.cabinetModal.renderCabinetExtraDetailsInto');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const container = document.getElementById('cmExtraDetails');
          const draft = { type:'moduł', subType:'lodowkowa', width:60, height:207, depth:60, details:{ fridgeOption:'zabudowa', fridgeNicheHeight:'178', fridgeFreeOption:'brak' } };
          FC.cabinetModal.renderCabinetExtraDetailsInto(container, draft);
          H.assert(FC.cabinetChoiceLaunchers && typeof FC.cabinetChoiceLaunchers.mountDynamicSelectLaunchers === 'function', 'Brak mountDynamicSelectLaunchers');
          FC.cabinetChoiceLaunchers.mountDynamicSelectLaunchers(container);
          ['cmFridgeOption','cmFridgeNiche'].forEach((id)=>{
            const select = document.getElementById(id);
            const slot = container.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + id + '"]');
            const btn = slot && slot.querySelector('.cabinet-choice-launch');
            H.assert(select && String(select.tagName || '').toLowerCase() === 'select', `Pole ${id} przestało istnieć jako natywny select`, select && select.outerHTML);
            H.assert(select && select.classList.contains('cabinet-choice-source--enhanced'), `Pole ${id} nie zostało oznaczone jako select źródłowy pod launcher`, select && select.className);
            H.assert(!!btn, `Pole ${id} nie dostało launchera`, slot && slot.innerHTML);
          });
        });
      }),

      H.makeTest('Szafki', 'Lodówkowa zachowuje pełną listę wysokości niszy po refaktorze typów', 'Pilnuje antyregresyjnie, czy po wydzieleniu standing modal nie zgubił dawnych wysokości niszy lodówkowej, zwłaszcza wysokich wariantów około 2 m.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetExtraDetailsInto === 'function', 'Brak FC.cabinetModal.renderCabinetExtraDetailsInto');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const container = document.getElementById('cmExtraDetails');
          const draft = { type:'stojąca', subType:'lodowkowa', width:60, height:207, depth:60, details:{ fridgeOption:'zabudowa', fridgeNicheHeight:'178', fridgeFreeOption:'brak' } };
          FC.cabinetModal.renderCabinetExtraDetailsInto(container, draft);
          const niche = document.getElementById('cmFridgeNiche');
          H.assert(!!niche, 'Brak selecta wysokości niszy lodówkowej', container.innerHTML);
          const values = Array.from(niche.options || []).map((opt)=>String(opt.value || ''));
          ['82','122','158','178','194','204'].forEach((value)=>{
            H.assert(values.includes(value), `Lista wysokości niszy zgubiła opcję ${value} cm`, values);
          });
        });
      }),
      H.makeTest('Szafki', 'Dynamiczny select ilości szuflad wewnętrznych renderuje launcher i zachowuje compact field', 'Pilnuje, czy licznik szuflad wewnętrznych nie wraca do systemowego selecta i nadal używa kompaktowego pola zgodnego z formularzem szafki.', ()=>{
        H.assert(FC.cabinetModal && typeof FC.cabinetModal.renderCabinetExtraDetailsInto === 'function', 'Brak FC.cabinetModal.renderCabinetExtraDetailsInto');
        if(typeof document === 'undefined' || !document || !document.body) return;
        return withCabinetModalFixture({}, ()=>{
          const container = document.getElementById('cmExtraDetails');
          const draft = { type:'stojąca', subType:'szufladowa', width:80, height:86, depth:56, details:{ drawerLayout:'3_1_2_2', innerDrawerType:'blum', innerDrawerCount:'2' } };
          FC.cabinetModal.renderCabinetExtraDetailsInto(container, draft);
          H.assert(FC.cabinetChoiceLaunchers && typeof FC.cabinetChoiceLaunchers.mountDynamicSelectLaunchers === 'function', 'Brak mountDynamicSelectLaunchers');
          FC.cabinetChoiceLaunchers.mountDynamicSelectLaunchers(container);
          const select = container.querySelector('select.cabinet-dynamic-choice-source[data-launcher-label^="Ilość szuflad wewnętrznych"]');
          const field = select && select.closest('.cabinet-extra-field--compact');
          const slot = select && field && field.querySelector('.cabinet-choice-launch-slot');
          const btn = slot && slot.querySelector('.cabinet-choice-launch');
          H.assert(!!select, 'Nie znaleziono dynamicznego selecta ilości szuflad wewnętrznych', container.innerHTML);
          H.assert(select.classList.contains('cabinet-choice-source--enhanced'), 'Dynamiczny select szuflad wewnętrznych nie został oznaczony jako ukryte źródło prawdy', select.className);
          H.assert(!!field, 'Pole ilości szuflad wewnętrznych straciło compact shell', select && select.outerHTML);
          H.assert(!!btn, 'Pole ilości szuflad wewnętrznych nie dostało launchera', slot && slot.innerHTML);
        });
      }),
    ]);
  }

  FC.cabinetDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);

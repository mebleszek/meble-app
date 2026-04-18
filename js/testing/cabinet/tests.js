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
            <div id="cabinetFormArea" style="display:none">
              <select id="cmSubType"></select>
              <div id="cmFrontCountWrap">
                <label id="cmFrontCountLabel">Ilość frontów</label>
                <select id="cmFrontCount"></select>
                <div id="cmFrontCountStatic" style="display:none"></div>
                <div id="cmFrontCountHint" style="display:none"></div>
              </div>
              <div id="cmFlapWrap" style="display:none">
                <select id="cmFlapVendor"><option value="blum">BLUM</option><option value="gtv">GTV</option><option value="hafele">HAFELE</option></select>
                <div id="cmFlapKindWrap"><select id="cmFlapKind"></select></div>
                <div id="cmFlapInfo" style="display:none"></div>
                <div id="cmFlapFrontInfo" style="display:none"></div>
              </div>
              <div id="cmShelvesWrap" style="display:none"><input id="cmShelves" type="number"/></div>
              <div id="cmHint"></div>
              <div id="cmExtraDetails"></div>
              <input id="cmWidth" type="number"/>
              <input id="cmHeight" type="number"/>
              <input id="cmDepth" type="number"/>
              <select id="cmFrontMaterial"><option value="laminat">Laminat</option><option value="akryl">Akryl</option><option value="lakier">Lakier</option></select>
              <select id="cmFrontColor"></select>
              <select id="cmBackMaterial"><option value="HDF 3mm biała">HDF 3mm biała</option><option value="18 mm pod kolor korpusu">18 mm pod kolor</option><option value="Brak">Brak</option></select>
              <select id="cmBodyColor"></select>
              <select id="cmOpeningSystem"></select>
            </div>
            <div id="setWizardArea" style="display:none">
              <div id="setWizardTitle"></div>
              <div id="setWizardDesc"></div>
              <div id="setTiles"></div>
              <button id="setWizardCreate" type="button"></button>
              <div id="setParams" style="display:none"></div>
              <div id="setFrontBlock" style="display:none">
                <select id="setFrontCount"><option value="1">1</option><option value="2">2</option></select>
                <select id="setFrontMaterial"><option value="laminat">Laminat</option></select>
                <select id="setFrontColor"></select>
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
      })
    ]);
  }

  FC.cabinetDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);

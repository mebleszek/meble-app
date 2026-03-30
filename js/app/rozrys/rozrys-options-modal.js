(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function openOptionsModal(ctx, deps){
    const cfg = Object.assign({
      panelBox: FC.panelBox,
      h:null,
      labelWithInfo:null,
      createChoiceLauncher:null,
      getSelectOptionLabel:null,
      setChoiceLaunchValue:null,
      openRozrysChoiceOverlay:null,
      askRozrysConfirm:null,
      parseLocaleNumber:null,
      getDefaultRozrysOptionValues:null,
      applyUnitChange:null,
      persistOptionPrefs:null,
      tryAutoRenderFromCache:null,
    }, deps || {});
    if(!(cfg.panelBox && typeof cfg.panelBox.open === 'function')) return;
    if(!(ctx && cfg.h && cfg.labelWithInfo)) return;
    const h = cfg.h;
    const body = h('div', { class:'rozrys-panel-form rozrys-panel-form--options rozrys-panel-form--inset' });
    const form = h('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--options' });

    function appendModalInfoLabel(wrap, title, infoTitle, infoMessage){
      const row = cfg.labelWithInfo(title, infoTitle || title, infoMessage || '');
      wrap.appendChild(row);
      return row.querySelector('.label-help__text') || row.querySelector('span');
    }

    const modalUnitWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--options-left rozrys-panel-field--options-row-a' });
    appendModalInfoLabel(modalUnitWrap, 'Jednostki', 'Jednostki', 'Określa jednostki wyświetlane w polach opcji rozkroju.');
    const modalUnitSel = h('select', { hidden:'hidden' });
    modalUnitSel.innerHTML = `
      <option value="cm" ${ctx.unitSel.value==='cm'?'selected':''}>cm</option>
      <option value="mm" ${ctx.unitSel.value==='mm'?'selected':''}>mm</option>
    `;
    const modalUnitBtn = cfg.createChoiceLauncher(cfg.getSelectOptionLabel(modalUnitSel), '');
    modalUnitBtn.classList.add('rozrys-choice-launch--options-clean');
    modalUnitWrap.appendChild(modalUnitBtn);
    modalUnitWrap.appendChild(modalUnitSel);

    const modalEdgeWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--options-right rozrys-panel-field--options-row-a' });
    appendModalInfoLabel(modalEdgeWrap, 'Wymiary do cięcia', 'Wymiary do cięcia', 'Decyduje, czy rozrys liczy wymiar nominalny czy po odjęciu okleiny.');
    const modalEdgeSel = h('select', { hidden:'hidden' });
    modalEdgeSel.innerHTML = ctx.edgeSel.innerHTML;
    modalEdgeSel.value = ctx.edgeSel.value;
    const modalEdgeBtn = cfg.createChoiceLauncher(cfg.getSelectOptionLabel(modalEdgeSel), '');
    modalEdgeBtn.classList.add('rozrys-choice-launch--options-clean');
    modalEdgeWrap.appendChild(modalEdgeBtn);
    modalEdgeWrap.appendChild(modalEdgeSel);

    const modalBoardWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--pair rozrys-panel-field--options-row-c' });
    const modalBoardLabel = appendModalInfoLabel(modalBoardWrap, `Format bazowy arkusza (${ctx.unitSel.value})`, 'Format bazowy arkusza', 'To pełny format płyty bazowej, z której dobieram brakujące arkusze.');
    const modalBoardRow = h('div', { class:'rozrys-panel-inline rozrys-panel-inline--options rozrys-panel-inline--compact-pair rozrys-panel-inline--options-pair' });
    const modalBoardW = h('input', { class:'rozrys-panel-input rozrys-panel-input--pair', type:'number', value:String(ctx.inW.value) });
    const modalBoardH = h('input', { class:'rozrys-panel-input rozrys-panel-input--pair', type:'number', value:String(ctx.inH.value) });
    modalBoardRow.appendChild(modalBoardW);
    modalBoardRow.appendChild(modalBoardH);
    modalBoardWrap.appendChild(modalBoardRow);

    const modalKerfWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--compact rozrys-panel-field--options-left rozrys-panel-field--options-row-b' });
    const modalKerfLabel = appendModalInfoLabel(modalKerfWrap, `Rzaz piły (${ctx.unitSel.value})`, 'Rzaz piły', 'Szerokość cięcia odejmowana między elementami i odpadami.');
    const modalKerf = h('input', { class:'rozrys-panel-input rozrys-panel-input--options-left', type:'number', value:String(ctx.inK.value) });
    modalKerfWrap.appendChild(modalKerf);

    const modalTrimWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--options-right rozrys-panel-field--options-row-b' });
    const modalTrimLabel = appendModalInfoLabel(modalTrimWrap, `Obrównanie krawędzi — arkusz standardowy (${ctx.unitSel.value})`, 'Obrównanie krawędzi', 'Margines odkładany od pełnej płyty przed liczeniem rozkroju.');
    const modalTrim = h('input', { class:'rozrys-panel-input rozrys-panel-input--options-right', type:'number', value:String(ctx.inTrim.value) });
    modalTrimWrap.appendChild(modalTrim);

    const modalMinWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--pair rozrys-panel-field--options-row-d' });
    const modalMinLabel = appendModalInfoLabel(modalMinWrap, `Najmniejszy użyteczny odpad (${ctx.unitSel.value})`, 'Najmniejszy użyteczny odpad', 'Mniejsze odpady traktuję jako nieużyteczne i nie odkładam ich do magazynu odpadów.');
    const modalMinRow = h('div', { class:'rozrys-panel-inline rozrys-panel-inline--options rozrys-panel-inline--compact-pair rozrys-panel-inline--options-pair' });
    const modalMinW = h('input', { class:'rozrys-panel-input rozrys-panel-input--pair', type:'number', value:String(ctx.inMinW.value) });
    const modalMinH = h('input', { class:'rozrys-panel-input rozrys-panel-input--pair', type:'number', value:String(ctx.inMinH.value) });
    modalMinRow.appendChild(modalMinW);
    modalMinRow.appendChild(modalMinH);
    modalMinWrap.appendChild(modalMinRow);

    form.appendChild(modalUnitWrap);
    form.appendChild(modalEdgeWrap);
    form.appendChild(modalKerfWrap);
    form.appendChild(modalTrimWrap);
    form.appendChild(modalBoardWrap);
    form.appendChild(modalMinWrap);

    body.appendChild(form);

    function syncModalLabels(){
      const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
      modalBoardLabel.textContent = `Format bazowy arkusza (${u})`;
      modalKerfLabel.textContent = `Rzaz piły (${u})`;
      modalTrimLabel.textContent = `Obrównanie krawędzi — arkusz standardowy (${u})`;
      modalMinLabel.textContent = `Najmniejszy użyteczny odpad (${u})`;
      cfg.setChoiceLaunchValue(modalUnitBtn, cfg.getSelectOptionLabel(modalUnitSel), '');
      cfg.setChoiceLaunchValue(modalEdgeBtn, cfg.getSelectOptionLabel(modalEdgeSel), '');
    }

    function convertModalNumericFields(prevUnit, nextUnit){
      if(prevUnit === nextUnit) return;
      const factor = (prevUnit === 'cm' && nextUnit === 'mm') ? 10 : (prevUnit === 'mm' && nextUnit === 'cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = cfg.parseLocaleNumber(el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        el.value = (nextUnit === 'cm') ? String(Math.round(v * 10) / 10) : String(Math.round(v));
      };
      [modalBoardW, modalBoardH, modalKerf, modalTrim, modalMinW, modalMinH].forEach(conv);
    }

    function normalizeLenToMm(value, unit){
      const n = cfg.parseLocaleNumber(value);
      if(!Number.isFinite(n)) return 0;
      return unit === 'cm' ? Math.round(n * 10) : Math.round(n);
    }

    function currentModalSignature(){
      const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
      return JSON.stringify({
        unit: u,
        edge: String(modalEdgeSel.value || ''),
        boardWMm: normalizeLenToMm(modalBoardW.value, u),
        boardHMm: normalizeLenToMm(modalBoardH.value, u),
        kerfMm: normalizeLenToMm(modalKerf.value, u),
        trimMm: normalizeLenToMm(modalTrim.value, u),
        minWMm: normalizeLenToMm(modalMinW.value, u),
        minHMm: normalizeLenToMm(modalMinH.value, u),
      });
    }

    function applyDefaultValuesToModal(){
      const defaults = cfg.getDefaultRozrysOptionValues('cm');
      modalUnitSel.value = defaults.unit;
      modalUnitSel.dataset.prevUnit = defaults.unit;
      modalEdgeSel.value = defaults.edge;
      modalBoardW.value = String(defaults.boardW);
      modalBoardH.value = String(defaults.boardH);
      modalKerf.value = String(defaults.kerf);
      modalTrim.value = String(defaults.trim);
      modalMinW.value = String(defaults.minW);
      modalMinH.value = String(defaults.minH);
      syncModalLabels();
    }

    const footer = h('div', { class:'rozrys-panel-footer rozrys-panel-footer--options' });
    const resetBtn = h('button', { class:'btn', type:'button', text:'Przywróć domyślne' });
    const actionWrap = h('div', { class:'rozrys-panel-footer__actions rozrys-panel-footer__actions--options' });
    const exitBtn = h('button', { class:'btn-primary', type:'button', text:'Wyjdź' });
    const cancelBtn = h('button', { class:'btn-danger', type:'button', text:'Anuluj' });
    const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });
    footer.appendChild(resetBtn);
    footer.appendChild(actionWrap);
    body.appendChild(footer);

    const closeModal = ()=> cfg.panelBox.close();
    const initialSignature = currentModalSignature();
    let isDirty = false;

    function renderFooterActions(){
      actionWrap.innerHTML = '';
      if(isDirty){
        actionWrap.appendChild(cancelBtn);
        actionWrap.appendChild(saveBtn);
      }else{
        actionWrap.appendChild(exitBtn);
      }
    }

    function updateDirtyState(){
      isDirty = currentModalSignature() !== initialSignature;
      saveBtn.disabled = !isDirty;
      renderFooterActions();
    }

    function confirmDiscardIfDirty(){
      if(!isDirty) return Promise.resolve(true);
      return cfg.askRozrysConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w opcjach rozkroju zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      });
    }

    function confirmSaveIfDirty(){
      if(!isDirty) return Promise.resolve(true);
      return cfg.askRozrysConfirm({
        title:'ZAPISAĆ ZMIANY?',
        message:'Zmienione opcje rozkroju zostaną zapisane i użyte przy kolejnych wejściach do panelu.',
        confirmText:'✓ ZAPISZ',
        cancelText:'WRÓĆ',
        confirmTone:'success',
        cancelTone:'neutral'
      });
    }

    function wireDirty(el){
      if(!el) return;
      el.addEventListener('input', updateDirtyState);
      el.addEventListener('change', updateDirtyState);
    }

    modalUnitSel.addEventListener('change', ()=>{
      const prevUnit = modalUnitSel.dataset.prevUnit || ctx.unitSel.value || 'mm';
      const nextUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
      convertModalNumericFields(prevUnit, nextUnit);
      modalUnitSel.dataset.prevUnit = nextUnit;
      syncModalLabels();
      updateDirtyState();
    });
    modalUnitSel.dataset.prevUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';

    modalUnitBtn.addEventListener('click', async ()=>{
      const picked = await cfg.openRozrysChoiceOverlay({
        title:'Jednostki',
        value: modalUnitSel.value,
        options:[
          { value:'cm', label:'cm', description:'Wartości wyświetlane w centymetrach.' },
          { value:'mm', label:'mm', description:'Wartości wyświetlane w milimetrach.' }
        ]
      });
      if(picked == null || picked === modalUnitSel.value) return;
      modalUnitSel.value = picked;
      modalUnitSel.dispatchEvent(new Event('change', { bubbles:true }));
    });

    modalEdgeBtn.addEventListener('click', async ()=>{
      const picked = await cfg.openRozrysChoiceOverlay({
        title:'Wymiary do cięcia',
        value: modalEdgeSel.value,
        options:[
          { value:'0', label:'Nominalne', description:'Rozrys liczy wymiary nominalne bez odjęcia okleiny.' },
          { value:'1', label:'Po odjęciu 1 mm okleiny', description:'Rozrys od razu kompensuje 1 mm okleiny na odpowiednich krawędziach.' },
          { value:'2', label:'Po odjęciu 2 mm okleiny', description:'Rozrys od razu kompensuje 2 mm okleiny na odpowiednich krawędziach.' }
        ]
      });
      if(picked == null || picked === modalEdgeSel.value) return;
      modalEdgeSel.value = picked;
      cfg.setChoiceLaunchValue(modalEdgeBtn, cfg.getSelectOptionLabel(modalEdgeSel), '');
      modalEdgeSel.dispatchEvent(new Event('change', { bubbles:true }));
    });

    [modalEdgeSel, modalBoardW, modalBoardH, modalKerf, modalTrim, modalMinW, modalMinH].forEach(wireDirty);
    updateDirtyState();

    exitBtn.addEventListener('click', ()=> closeModal());
    cancelBtn.addEventListener('click', async ()=>{
      if(!(await confirmDiscardIfDirty())) return;
      closeModal();
    });
    resetBtn.addEventListener('click', ()=>{
      applyDefaultValuesToModal();
      updateDirtyState();
    });
    saveBtn.addEventListener('click', async ()=>{
      if(!(await confirmSaveIfDirty())) return;
      if(!isDirty){
        closeModal();
        return;
      }
      cfg.applyUnitChange(modalUnitSel.value);
      ctx.edgeSel.value = modalEdgeSel.value;
      ctx.inW.value = String(Math.max(1, cfg.parseLocaleNumber(modalBoardW.value) || 0));
      ctx.inH.value = String(Math.max(1, cfg.parseLocaleNumber(modalBoardH.value) || 0));
      ctx.inK.value = String(Math.max(0, cfg.parseLocaleNumber(modalKerf.value) || 0));
      ctx.inTrim.value = String(Math.max(0, cfg.parseLocaleNumber(modalTrim.value) || 0));
      ctx.inMinW.value = String(Math.max(0, cfg.parseLocaleNumber(modalMinW.value) || 0));
      ctx.inMinH.value = String(Math.max(0, cfg.parseLocaleNumber(modalMinH.value) || 0));
      cfg.persistOptionPrefs();
      closeModal();
      cfg.tryAutoRenderFromCache();
    });

    cfg.panelBox.open({
      title:'Opcje rozkroju',
      contentNode: body,
      width:'860px',
      boxClass:'panel-box--rozrys',
      dismissOnOverlay:false,
      beforeClose: ()=> confirmDiscardIfDirty()
    });
  }

  FC.rozrysOptionsModal = { openOptionsModal };
})();

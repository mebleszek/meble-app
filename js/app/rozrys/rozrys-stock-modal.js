(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function openAddStockModal(options, deps){
    const cfg = Object.assign({
      agg:null,
      matSelValue:'',
      unitValue:'mm',
      boardWValue:'',
      boardHValue:'',
    }, options || {});
    const api = Object.assign({
      normalizeMaterialScopeForAggregate:null,
      decodeMaterialScope:null,
      splitMaterialAccordionTitle:null,
      parseLocaleNumber:null,
      openRozrysInfo:null,
      askRozrysConfirm:null,
      createChoiceLauncher:null,
      getSelectOptionLabel:null,
      setChoiceLaunchValue:null,
      openRozrysChoiceOverlay:null,
    }, deps || {});

    if(!(FC.magazyn && (FC.magazyn.addSheetStock || FC.magazyn.upsertSheet))){
      try{ api.openRozrysInfo && api.openRozrysInfo('Brak modułu magazynu', 'Nie udało się zapisać formatu, bo moduł Magazynu nie jest dostępny.'); }catch(_){ }
      return;
    }
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')){
      try{ api.openRozrysInfo && api.openRozrysInfo('Brak panelu', 'Nie udało się otworzyć okna dodawania płyty.'); }catch(_){ }
      return;
    }

    const scope = (typeof api.normalizeMaterialScopeForAggregate === 'function' && typeof api.decodeMaterialScope === 'function')
      ? api.normalizeMaterialScopeForAggregate(api.decodeMaterialScope(cfg.matSelValue), cfg.agg)
      : { kind:'all', material:'' };
    const currentMaterial = scope.kind === 'material' && scope.material ? scope.material : '';
    const unit = cfg.unitValue === 'cm' ? 'cm' : 'mm';
    const parseLocaleNumber = (typeof api.parseLocaleNumber === 'function') ? api.parseLocaleNumber : ((v)=> Number(v));
    const splitTitle = (typeof api.splitMaterialAccordionTitle === 'function')
      ? api.splitMaterialAccordionTitle
      : ((material)=> ({ line1:String(material || ''), line2:'' }));

    const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock' });
    const scroll = h('div', { class:'panel-box-form__scroll' });
    const form = h('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock' });

    const materialWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--stock-material' });
    materialWrap.appendChild(h('label', { text:'Materiał' }));
    let materialControl = null;
    let materialLauncher = null;
    if(currentMaterial){
      materialControl = h('input', { type:'text', value: currentMaterial, readonly:'readonly' });
      materialWrap.appendChild(materialControl);
    }else{
      const select = h('select', { hidden:'hidden' });
      select.appendChild(h('option', { value:'', text:'Wybierz materiał' }));
      (((cfg.agg && cfg.agg.materials) || [])).forEach((material)=>{
        const split = splitTitle(material);
        const option = h('option', { value:material, text:[split.line1 || material, split.line2 || ''].filter(Boolean).join(' • ') });
        select.appendChild(option);
      });
      materialControl = select;
      const launcherFactory = (typeof api.createChoiceLauncher === 'function') ? api.createChoiceLauncher : null;
      const readChoiceLabel = (typeof api.getSelectOptionLabel === 'function') ? api.getSelectOptionLabel : ((sel)=> String(sel && sel.value || ''));
      const applyChoiceLabel = (typeof api.setChoiceLaunchValue === 'function') ? api.setChoiceLaunchValue : ((btn, label)=>{ if(btn) btn.textContent = String(label || ''); });
      if(launcherFactory && typeof api.openRozrysChoiceOverlay === 'function'){
        materialLauncher = launcherFactory(readChoiceLabel(select) || 'Wybierz materiał', '');
        materialLauncher.classList.add('rozrys-choice-launch--stock-clean');
        applyChoiceLabel(materialLauncher, readChoiceLabel(select) || 'Wybierz materiał', '');
        materialLauncher.addEventListener('click', async ()=>{
          const picked = await api.openRozrysChoiceOverlay({
            title:'Wybierz materiał',
            value:String(select.value || ''),
            options: (((cfg.agg && cfg.agg.materials) || []).map((material)=>{
              const split = splitTitle(material);
              return {
                value: material,
                label: String(split.line1 || material || ''),
                description: String(split.line2 || '')
              };
            }))
          });
          if(picked == null) return;
          select.value = String(picked || '');
          applyChoiceLabel(materialLauncher, readChoiceLabel(select) || 'Wybierz materiał', '');
          select.dispatchEvent(new Event('change', { bubbles:true }));
        });
        materialWrap.appendChild(materialLauncher);
        materialWrap.appendChild(select);
      }else{
        select.hidden = false;
        materialWrap.appendChild(select);
      }
    }
    form.appendChild(materialWrap);

    const widthWrap = h('div', { class:'rozrys-panel-field' });
    widthWrap.appendChild(h('label', { text:`Szerokość płyty (${unit})` }));
    const widthInput = h('input', { type:'number', value:String(cfg.boardWValue || '') });
    widthWrap.appendChild(widthInput);
    form.appendChild(widthWrap);

    const heightWrap = h('div', { class:'rozrys-panel-field' });
    heightWrap.appendChild(h('label', { text:`Wysokość płyty (${unit})` }));
    const heightInput = h('input', { type:'number', value:String(cfg.boardHValue || '') });
    heightWrap.appendChild(heightInput);
    form.appendChild(heightWrap);

    const qtyWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--qty' });
    qtyWrap.appendChild(h('label', { text:'Ilość (szt.)' }));
    const qtyInput = h('input', { class:'rozrys-panel-input--compact', type:'number', value:'1', min:'1' });
    qtyWrap.appendChild(qtyInput);
    form.appendChild(qtyWrap);

    scroll.appendChild(form);
    body.appendChild(scroll);

    const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
    const actionWrap = h('div', { class:'rozrys-panel-footer__actions' });
    const exitBtn = h('button', { class:'btn-primary', type:'button', text:'Wyjdź' });
    const cancelBtn = h('button', { class:'btn-danger', type:'button', text:'Anuluj' });
    const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });
    footer.appendChild(actionWrap);
    body.appendChild(footer);

    const normalizeFieldText = (value)=> String(value == null ? '' : value).trim();
    const currentSignature = ()=> JSON.stringify({
      material: normalizeFieldText(currentMaterial || (materialControl && materialControl.value) || ''),
      width: normalizeFieldText(widthInput.value),
      height: normalizeFieldText(heightInput.value),
      qty: normalizeFieldText(qtyInput.value)
    });
    const initialSignature = currentSignature();
    const isDirty = ()=> currentSignature() !== initialSignature;
    const updateFooterState = ()=>{
      actionWrap.innerHTML = '';
      saveBtn.disabled = !isDirty();
      if(isDirty()){
        actionWrap.appendChild(cancelBtn);
        actionWrap.appendChild(saveBtn);
      }else{
        actionWrap.appendChild(exitBtn);
      }
    };
    const confirmDiscard = ()=> typeof api.askRozrysConfirm === 'function'
      ? api.askRozrysConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w formularzu dodawania płyty zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        })
      : Promise.resolve(true);
    const wireDirty = (el)=>{
      if(!el) return;
      el.addEventListener('input', updateFooterState);
      el.addEventListener('change', updateFooterState);
    };
    [materialControl, widthInput, heightInput, qtyInput].forEach(wireDirty);

    exitBtn.addEventListener('click', ()=> FC.panelBox.close());
    cancelBtn.addEventListener('click', async ()=>{
      const ok = await confirmDiscard();
      if(!ok) return;
      FC.panelBox.close();
    });
    saveBtn.addEventListener('click', async ()=>{
      const material = currentMaterial || String(materialControl && materialControl.value || '').trim();
      const w = unit==='mm' ? Math.round(parseLocaleNumber(widthInput.value) || 0) : Math.round((parseLocaleNumber(widthInput.value) || 0) * 10);
      const hh = unit==='mm' ? Math.round(parseLocaleNumber(heightInput.value) || 0) : Math.round((parseLocaleNumber(heightInput.value) || 0) * 10);
      const qty = Math.max(1, Math.round(parseLocaleNumber(qtyInput.value) || 1));
      if(!material){
        try{ api.openRozrysInfo && api.openRozrysInfo('Brak materiału', 'Najpierw wybierz konkretny materiał dla płyty magazynowej.'); }catch(_){ }
        return;
      }
      if(!(w > 0 && hh > 0)){
        try{ api.openRozrysInfo && api.openRozrysInfo('Brak formatu płyty', 'Podaj poprawny format płyty, zanim dodasz ją do Magazynu.'); }catch(_){ }
        return;
      }
      if(!isDirty()) return;
      const ok = typeof api.askRozrysConfirm === 'function'
        ? await api.askRozrysConfirm({
            title:'DODAĆ PŁYTĘ DO MAGAZYNU?',
            message:`Materiał: ${material}\nFormat: ${w}×${hh} mm\nDodam ${qty} szt. do magazynu.`,
            confirmText:'Zapisz',
            cancelText:'Anuluj',
            confirmTone:'success',
            cancelTone:'danger'
          })
        : true;
      if(!ok) return;
      let saved = false;
      try{
        if(FC.magazyn && typeof FC.magazyn.addSheetStock === 'function'){
          saved = !!FC.magazyn.addSheetStock(material, w, hh, qty);
        } else {
          const rows = (FC.magazyn && typeof FC.magazyn.findForMaterial === 'function') ? FC.magazyn.findForMaterial(material) : [];
          const exact = (rows || []).find((row)=> Math.round(Number(row && row.width) || 0) === Math.round(w) && Math.round(Number(row && row.height) || 0) === Math.round(hh));
          if(exact){
            saved = !!FC.magazyn.upsertSheet({ id: exact.id, material, width:w, height:hh, qty: Math.max(0, Math.round(Number(exact.qty) || 0)) + qty });
          } else {
            saved = !!FC.magazyn.upsertSheet({ material, width:w, height:hh, qty });
          }
        }
      }catch(_){ saved = false; }
      if(!saved){
        try{ api.openRozrysInfo && api.openRozrysInfo('Nie udało się dodać płyty', 'Spróbuj ponownie.'); }catch(_){ }
        return;
      }
      FC.panelBox.close();
      try{ api.openRozrysInfo && api.openRozrysInfo('Dodano płytę', `Płyta została dodana do Magazynu (+${qty} szt.).`); }catch(_){ }
    });

    updateFooterState();
    FC.panelBox.open({
      title:'Dodaj płytę do magazynu',
      contentNode: body,
      width:'640px',
      boxClass:'panel-box--rozrys',
      dismissOnOverlay:false,
      beforeClose: ()=> isDirty() ? confirmDiscard() : true
    });
  }

  FC.rozrysStockModal = {
    openAddStockModal,
  };
})();

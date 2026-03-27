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

    const body = h('div');
    const form = h('div', { class:'grid-2', style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });

    const materialWrap = h('div', { style:'grid-column:1 / -1' });
    materialWrap.appendChild(h('label', { text:'Materiał' }));
    let materialControl = null;
    if(currentMaterial){
      materialControl = h('input', { type:'text', value: currentMaterial, readonly:'readonly' });
    }else{
      const select = h('select');
      select.appendChild(h('option', { value:'', text:'Wybierz materiał' }));
      (((cfg.agg && cfg.agg.materials) || [])).forEach((material)=>{
        const split = splitTitle(material);
        const option = h('option', { value:material, text:[split.line1 || material, split.line2 || ''].filter(Boolean).join(' • ') });
        select.appendChild(option);
      });
      materialControl = select;
    }
    materialWrap.appendChild(materialControl);
    form.appendChild(materialWrap);

    const widthWrap = h('div');
    widthWrap.appendChild(h('label', { text:`Szerokość płyty (${unit})` }));
    const widthInput = h('input', { type:'number', value:String(cfg.boardWValue || '') });
    widthWrap.appendChild(widthInput);
    form.appendChild(widthWrap);

    const heightWrap = h('div');
    heightWrap.appendChild(h('label', { text:`Wysokość płyty (${unit})` }));
    const heightInput = h('input', { type:'number', value:String(cfg.boardHValue || '') });
    heightWrap.appendChild(heightInput);
    form.appendChild(heightWrap);

    const qtyWrap = h('div', { style:'grid-column:1 / -1' });
    qtyWrap.appendChild(h('label', { text:'Ilość (szt.)' }));
    const qtyInput = h('input', { type:'number', value:'1', min:'1' });
    qtyWrap.appendChild(qtyInput);
    form.appendChild(qtyWrap);

    body.appendChild(form);

    const footer = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center' });
    const actionWrap = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;align-items:center' });
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
      dismissOnOverlay:false,
      beforeClose: ()=> isDirty() ? confirmDiscard() : true
    });
  }

  FC.rozrysStockModal = {
    openAddStockModal,
  };
})();

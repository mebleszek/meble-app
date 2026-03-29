(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function openMaterialGrainExceptions(ctx, deps){
    const cfg = Object.assign({
      panelBox: FC.panelBox,
      askRozrysConfirm:null,
      openRozrysInfo:null,
      setMaterialGrainExceptions:null,
      getMaterialGrainEnabled:null,
      getMaterialGrainExceptions:null,
      materialHasGrain:null,
      partSignature:null,
      materialPartDirectionLabel:null,
      mmToUnitStr:null,
    }, deps || {});
    if(!(cfg.panelBox && typeof cfg.panelBox.open === 'function')) return;
    const material = String(ctx && ctx.material || '');
    const partList = Array.isArray(ctx && ctx.parts) ? ctx.parts.slice() : [];
    const unitValue = String(ctx && ctx.unitValue || 'mm');
    const hasGrain = !!cfg.materialHasGrain(material);
    const enabled = !!cfg.getMaterialGrainEnabled(material, hasGrain);
    if(!hasGrain || !enabled){
      cfg.openRozrysInfo('Wyjątki słojów', 'Najpierw włącz pilnowanie kierunku słojów dla tego materiału.');
      return;
    }

    const h = ctx.h;
    const allowedKeys = partList.map((p)=> cfg.partSignature(p));
    const initial = cfg.getMaterialGrainExceptions(material, allowedKeys, hasGrain);
    const draft = Object.assign({}, initial);
    const currentSignature = ()=> Object.keys(draft).filter((key)=> draft[key]).sort().join('|');
    const initialSignature = Object.keys(initial).filter((key)=> initial[key]).sort().join('|');
    const isDirty = ()=> currentSignature() !== initialSignature;
    const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--grain' });
    const scroll = h('div', { class:'panel-box-form__scroll' });
    const footerShell = h('div', { class:'panel-box-form__footer' });
    scroll.appendChild(h('p', { class:'rozrys-panel-note', style:'margin-bottom:10px', text:'Zaznaczone formatki będą traktowane tak, jakby nie miały słojów i będzie można je obracać.' }));
    const list = h('div', { class:'rozrys-grain-exceptions-list' });
    if(!partList.length){
      list.appendChild(h('div', { class:'muted xs', text:'Brak formatek dla tego materiału w aktualnym zakresie.' }));
    }
    partList.forEach((p)=>{
      const sig = cfg.partSignature(p);
      const row = h('label', { class:'rozrys-grain-exception-row' });
      const cb = h('input', { type:'checkbox' });
      cb.checked = !!draft[sig];
      const copy = h('div', { class:'rozrys-grain-exception-copy' });
      copy.appendChild(h('div', { class:'rozrys-grain-exception-name', text:String(p.name || 'Element') }));
      copy.appendChild(h('div', { class:'muted xs', text:`${cfg.mmToUnitStr(p.w, unitValue)} × ${cfg.mmToUnitStr(p.h, unitValue)} ${unitValue} • ilość ${Math.max(0, Number(p.qty) || 0)}` }));
      if(p && p.direction && String(p.direction) !== 'default'){
        copy.appendChild(h('div', { class:'muted xs', text:`Ustawienie formatki: ${cfg.materialPartDirectionLabel(p)}` }));
      }
      cb.addEventListener('change', ()=>{
        if(cb.checked) draft[sig] = true;
        else delete draft[sig];
        updateFooter();
      });
      row.appendChild(cb);
      row.appendChild(copy);
      list.appendChild(row);
    });
    scroll.appendChild(list);
    const footer = h('div', { class:'rozrys-grain-exceptions__footer' });
    const footerActions = h('div', { class:'rozrys-grain-exceptions__footer-actions' });
    const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
    const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
    const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zapisz' });
    function updateFooter(){
      footerActions.innerHTML = '';
      if(isDirty()){
        footerActions.appendChild(cancelBtn);
        footerActions.appendChild(saveBtn);
      }else{
        footerActions.appendChild(exitBtn);
      }
    }
    updateFooter();
    footer.appendChild(footerActions);
    footerShell.appendChild(footer);
    body.appendChild(scroll);
    body.appendChild(footerShell);
    const confirmDiscardIfDirty = ()=> isDirty() ? cfg.askRozrysConfirm({
      title:'ANULOWAĆ ZMIANY?',
      message:'Niezapisane zmiany w wyjątkach słojów zostaną utracone.',
      confirmText:'✕ ANULUJ ZMIANY',
      cancelText:'WRÓĆ',
      confirmTone:'danger',
      cancelTone:'neutral'
    }) : Promise.resolve(true);
    exitBtn.addEventListener('click', ()=>{ try{ cfg.panelBox.close(); }catch(_){ } });
    cancelBtn.addEventListener('click', async ()=>{
      if(!(await confirmDiscardIfDirty())) return;
      try{ cfg.panelBox.close(); }catch(_){ }
    });
    saveBtn.addEventListener('click', ()=>{
      const next = {};
      Object.keys(draft).forEach((key)=>{ if(draft[key]) next[key] = true; });
      cfg.setMaterialGrainExceptions(material, next, hasGrain);
      try{ cfg.panelBox.close(); }catch(_){ }
      if(typeof ctx.tryAutoRenderFromCache === 'function') ctx.tryAutoRenderFromCache();
    });
    cfg.panelBox.open({ title:`Wyjątki słojów — ${material}`, contentNode: body, width:'760px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, beforeClose: ()=> confirmDiscardIfDirty() });
  }

  FC.rozrysGrainModal = { openMaterialGrainExceptions };
})();

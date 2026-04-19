(function(){
  const ns = (window.FC = window.FC || {});

  function configureStandingFrontControls(ctx){
    const draft = ctx.draft;
    const fcSel = ctx.fcSel;
    const fcStatic = ctx.fcStatic;
    const fcHint = ctx.fcHint;
    const fcWrap = ctx.fcWrap;
    const shelvesWrap = ctx.shelvesWrap;
    const shelvesInput = ctx.shelvesInput;

    const setFcOptions = (arr) => {
      fcSel.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join('');
    };

    if(ctx.fcLabelEl) ctx.fcLabelEl.textContent = 'Ilość frontów';
    setFcOptions([1,2]);
    ctx.ensureFrontCountRulesSafe(draft);

    if(fcSel) fcSel.style.display = '';
    if(fcStatic){
      fcStatic.style.display = 'none';
      fcStatic.textContent = '';
    }

    const canPick = ctx.cabinetAllowsFrontCountSafe(draft);
    const fixedOne = (draft.subType === 'zmywarkowa' || draft.subType === 'piekarnikowa' || (draft.subType === 'rogowa_slepa' && (draft.details?.cornerOption||'polki') === 'magic_corner')) || (draft.subType === 'zlewowa' && (draft.details?.sinkFront||'drzwi') === 'szuflada');
    const isFridge = (draft.subType === 'lodowkowa');
    const isCornerL = (draft.subType === 'narozna_l');

    if(isFridge){
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      return;
    }
    if(isCornerL){
      draft.frontCount = 2;
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap){
        shelvesWrap.style.display = 'block';
        const d = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
          ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
          : (draft.details && typeof draft.details === 'object' ? draft.details : {});
        const sh = (d.shelves == null ? 2 : Number(d.shelves));
        draft.details = Object.assign({}, d, { shelves: Math.max(0, Math.round(Number.isFinite(sh) ? sh : 0)) });
        if(shelvesInput){
          shelvesInput.value = String(draft.details.shelves);
          const onShelvesChange = () => {
            const v = Math.max(0, Math.round(Number(shelvesInput.value) || 0));
            draft.details = Object.assign({}, draft.details || {}, { shelves: v });
            shelvesInput.value = String(v);
          };
          shelvesInput.oninput = onShelvesChange;
          shelvesInput.onchange = onShelvesChange;
        }
      }
      return;
    }
    if(!canPick){
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      return;
    }
    if(fixedOne){
      if(fcWrap) fcWrap.style.display = 'block';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      fcSel.value = '1';
      fcSel.disabled = true;
      if(fcHint){
        fcHint.style.display = 'block';
        fcHint.textContent = 'Dla tej szafki ilość frontów jest stała: 1.';
      }
      return;
    }

    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
    fcSel.disabled = false;
    fcSel.value = String(draft.frontCount === 0 ? 0 : (draft.frontCount || 2));
    if(fcHint) fcHint.style.display = 'none';
  }

  function applyStandingSubTypeChangeEffects(ctx){
    const draft = ctx.draft;
    if(draft.subType === 'zmywarkowa'){
      const leg = Number(ctx.projectData?.[ctx.room]?.settings?.legHeight) || 0;
      const dw = (draft.details && draft.details.dishWasherWidth) ? draft.details.dishWasherWidth : (String(draft.width || '60'));
      draft.details = Object.assign({}, draft.details || {}, { dishWasherWidth: dw });
      draft.width = Number(dw) || 60;
      const frontH = (Number(draft.height) || 0) - leg;
      const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
      draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
    }
  }

  ns.cabinetModalStandingFrontControls = {
    configureStandingFrontControls,
    applyStandingSubTypeChangeEffects
  };
})();

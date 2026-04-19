(function(){
  const ns = (window.FC = window.FC || {});

  function getStandingExtrasApi(){
    return (window.FC && window.FC.cabinetModalStandingExtras) || {};
  }

  function getStandingFrontControlsApi(){
    return (window.FC && window.FC.cabinetModalStandingFrontControls) || {};
  }

  function renderExtraDetails(ctx){
    const st = ctx.subType;
    const extrasApi = getStandingExtrasApi();

    if(st === 'narozna_l' && typeof extrasApi.renderCornerLExtraDetails === 'function'){
      extrasApi.renderCornerLExtraDetails(ctx);
    }
    if(st === 'szuflady' && typeof extrasApi.renderDrawerExtras === 'function'){
      extrasApi.renderDrawerExtras(ctx);
    }
    if(st === 'zlewowa' && typeof extrasApi.renderSinkExtraDetails === 'function'){
      extrasApi.renderSinkExtraDetails(ctx);
    }
    if(st === 'zmywarkowa' && typeof extrasApi.renderDishwasherExtraDetails === 'function'){
      extrasApi.renderDishwasherExtraDetails(ctx);
    }
    if(st === 'lodowkowa' && typeof extrasApi.renderFridgeExtraDetails === 'function'){
      extrasApi.renderFridgeExtraDetails(ctx);
    }
    if(st === 'piekarnikowa' && typeof extrasApi.renderOvenExtraDetails === 'function'){
      extrasApi.renderOvenExtraDetails(ctx);
    }
    if(typeof extrasApi.renderStandardAndCornerExtras === 'function'){
      extrasApi.renderStandardAndCornerExtras(ctx);
    }
    return true;
  }

  function configureFrontControls(ctx){
    const api = getStandingFrontControlsApi();
    if(api && typeof api.configureStandingFrontControls === 'function'){
      return api.configureStandingFrontControls(ctx);
    }
    return null;
  }

  function afterSubTypeChange(ctx){
    const api = getStandingFrontControlsApi();
    if(api && typeof api.applyStandingSubTypeChangeEffects === 'function'){
      return api.applyStandingSubTypeChangeEffects(ctx);
    }
    return null;
  }

  ns.cabinetModalStanding = {
    renderExtraDetails,
    configureFrontControls,
    afterSubTypeChange
  };
})();

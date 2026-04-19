(function(){
  const ns = (window.FC = window.FC || {});

  function getCornerStandardApi(){
    return (window.FC && window.FC.cabinetModalStandingCornerStandard) || {};
  }

  function getSpecialsApi(){
    return (window.FC && window.FC.cabinetModalStandingSpecials) || {};
  }

  function renderCornerLExtraDetails(ctx){
    const api = getCornerStandardApi();
    if(api && typeof api.renderCornerLExtraDetails === 'function'){
      return api.renderCornerLExtraDetails(ctx);
    }
    return null;
  }

  function renderDrawerExtras(ctx){
    const api = getSpecialsApi();
    if(api && typeof api.renderDrawerExtras === 'function'){
      return api.renderDrawerExtras(ctx);
    }
    return null;
  }

  function renderSinkExtraDetails(ctx){
    const api = getSpecialsApi();
    if(api && typeof api.renderSinkExtraDetails === 'function'){
      return api.renderSinkExtraDetails(ctx);
    }
    return null;
  }

  function renderDishwasherExtraDetails(ctx){
    const api = getSpecialsApi();
    if(api && typeof api.renderDishwasherExtraDetails === 'function'){
      return api.renderDishwasherExtraDetails(ctx);
    }
    return null;
  }

  function renderFridgeExtraDetails(ctx){
    const api = getSpecialsApi();
    if(api && typeof api.renderFridgeExtraDetails === 'function'){
      return api.renderFridgeExtraDetails(ctx);
    }
    return null;
  }

  function renderOvenExtraDetails(ctx){
    const api = getSpecialsApi();
    if(api && typeof api.renderOvenExtraDetails === 'function'){
      return api.renderOvenExtraDetails(ctx);
    }
    return null;
  }

  function renderStandardAndCornerExtras(ctx){
    const api = getCornerStandardApi();
    if(api && typeof api.renderStandardAndCornerExtras === 'function'){
      return api.renderStandardAndCornerExtras(ctx);
    }
    return null;
  }

  ns.cabinetModalStandingExtras = {
    renderCornerLExtraDetails,
    renderDrawerExtras,
    renderSinkExtraDetails,
    renderDishwasherExtraDetails,
    renderFridgeExtraDetails,
    renderOvenExtraDetails,
    renderStandardAndCornerExtras
  };
})();

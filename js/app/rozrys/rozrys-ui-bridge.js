(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createFallbackProgressApi(ctx){
    const setUiState = ctx && typeof ctx.setUiState === 'function' ? ctx.setUiState : null;
    return {
      controller: null,
      setGenBtnMode(mode){
        try{ if(setUiState) setUiState({ buttonMode:String(mode || 'idle'), running: mode === 'running' }); }catch(_){ }
      },
      requestCancel(){
        try{ if(setUiState) setUiState({ running:false }); }catch(_){ }
      },
      isRozrysRunning(){
        try{ if(setUiState) setUiState({ running:false }); }catch(_){ }
        return false;
      },
      getRozrysBtnMode(){
        return 'idle';
      },
    };
  }

  function createProgressApi(ctx){
    const cfg = Object.assign({
      statusBox:null,
      statusMain:null,
      statusSub:null,
      statusMeta:null,
      statusProg:null,
      statusProgBar:null,
      genBtn:null,
      setUiState:null,
    }, ctx || {});
    const ctrl = (FC.rozrysProgress && typeof FC.rozrysProgress.createController === 'function')
      ? FC.rozrysProgress.createController({
          statusBox: cfg.statusBox,
          statusMain: cfg.statusMain,
          statusSub: cfg.statusSub,
          statusMeta: cfg.statusMeta,
          statusProg: cfg.statusProg,
          statusProgBar: cfg.statusProgBar,
          genBtn: cfg.genBtn,
        })
      : null;
    if(!ctrl) return createFallbackProgressApi(cfg);
    return {
      controller: ctrl,
      setGenBtnMode(mode){
        try{ if(typeof cfg.setUiState === 'function') cfg.setUiState({ buttonMode:String(mode || 'idle'), running: mode === 'running' }); }catch(_){ }
        return typeof ctrl.setGenBtnMode === 'function' ? ctrl.setGenBtnMode(mode) : undefined;
      },
      requestCancel(){
        try{ if(typeof cfg.setUiState === 'function') cfg.setUiState({ running:false }); }catch(_){ }
        return typeof ctrl.requestCancel === 'function' ? ctrl.requestCancel() : undefined;
      },
      isRozrysRunning(){
        const running = !!(typeof ctrl.isRunning === 'function' && ctrl.isRunning());
        try{ if(typeof cfg.setUiState === 'function') cfg.setUiState({ running }); }catch(_){ }
        return running;
      },
      getRozrysBtnMode(){
        return typeof ctrl.getButtonMode === 'function' ? ctrl.getButtonMode() : 'idle';
      },
    };
  }

  function openOptionsModal(ctx, deps){
    if(FC.rozrysOptionsModal && typeof FC.rozrysOptionsModal.openOptionsModal === 'function'){
      return FC.rozrysOptionsModal.openOptionsModal(ctx, deps);
    }
    return undefined;
  }

  function openAddStockModal(ctx, deps){
    if(FC.rozrysStockModal && typeof FC.rozrysStockModal.openAddStockModal === 'function'){
      return FC.rozrysStockModal.openAddStockModal(ctx, deps);
    }
    return undefined;
  }

  FC.rozrysUiBridge = {
    createApi(){
      return {
        createProgressApi,
        openOptionsModal,
        openAddStockModal,
      };
    }
  };
})();

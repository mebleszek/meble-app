(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getStatusLabel(value){
    const labels = (FC.projectStatusManualGuard && FC.projectStatusManualGuard.STATUS_LABELS) || {};
    return labels[String(value || '').trim().toLowerCase()] || String(value || 'status');
  }

  function normalizeDecision(decision){
    const src = decision && typeof decision === 'object' ? decision : {};
    const choices = Array.isArray(src.choices) ? src.choices.filter((choice)=> choice && Array.isArray(choice.roomIds) && choice.roomIds.length) : [];
    return Object.assign({}, src, { choices });
  }

  async function pickManualStatusScope(decision){
    const cfg = normalizeDecision(decision);
    if(!cfg.needsDecision){
      return cfg.autoChoice || (cfg.choices.length ? cfg.choices[0] : null);
    }
    if(!cfg.choices.length) return null;
    const choiceApi = FC.rozrysChoice;
    if(!(choiceApi && typeof choiceApi.openRozrysChoiceOverlay === 'function')) return cfg.choices[0];
    const statusLabel = getStatusLabel(cfg.targetStatus);
    const picked = await choiceApi.openRozrysChoiceOverlay({
      title:`Dla jakiego zakresu ustawić status „${statusLabel}”?`,
      value:String(cfg.defaultChoiceId || ''),
      options: cfg.choices.map((choice)=> ({
        value:String(choice.id || ''),
        label:String(choice.label || choice.scopeLabel || 'Wybrany zakres'),
        description:String(choice.description || ''),
      })),
    });
    if(picked == null) return null;
    return cfg.choices.find((choice)=> String(choice.id || '') === String(picked || '')) || null;
  }

  FC.projectStatusScopeDecision = {
    normalizeDecision,
    pickManualStatusScope,
  };
})();

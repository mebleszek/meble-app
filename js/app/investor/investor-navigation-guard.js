(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function toggleDisabled(node, disabled){
    if(!node) return;
    try{ node.classList.toggle('is-disabled', !!disabled); }catch(_){ }
    try{
      if(disabled) node.setAttribute('disabled', 'disabled');
      else node.removeAttribute('disabled');
    }catch(_){ }
    try{ node.setAttribute('aria-disabled', disabled ? 'true' : 'false'); }catch(_){ }
  }

  function apply(editing){
    const disabled = !!editing;
    try{
      const topTabs = document.getElementById('topTabs');
      if(topTabs) topTabs.classList.toggle('is-disabled', disabled);
    }catch(_){ }
    try{
      document.querySelectorAll('[data-action="back-investors"]').forEach((btn)=> toggleDisabled(btn, disabled));
    }catch(_){ }
    try{
      document.querySelectorAll('.investor-room-quick-btn, .investor-add-room-btn, .investor-project-status-btn').forEach((btn)=> toggleDisabled(btn, disabled));
    }catch(_){ }
    try{
      ['sessionCancel','sessionSave'].forEach((id)=> toggleDisabled(document.getElementById(id), disabled));
    }catch(_){ }
  }

  FC.investorNavigationGuard = { apply };
})();

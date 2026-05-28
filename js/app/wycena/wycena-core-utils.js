(function(){
  'use strict';
  window.FC = window.FC || {};

  function normalizeText(value){
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function slug(value){
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  window.FC.wycenaCoreUtils = { normalizeText, slug, clone };
})();

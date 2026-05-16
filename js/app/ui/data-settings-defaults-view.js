// js/app/ui/data-settings-defaults-view.js
// Widok globalnych domyślnych materiałów i okuć w trybiku strony głównej.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  const BACK_MATERIALS = ['HDF 3mm biała','HDF 3mm pod kolor','Płyta 18mm pod kolor','Brak'];

  function text(value){ return String(value == null ? '' : value).trim(); }

  function unique(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((item)=>{
      const value = text(item);
      if(!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
    return out;
  }

  function getMaterials(){
    try{ if(FC.catalogStore && typeof FC.catalogStore.getSheetMaterials === 'function') return FC.catalogStore.getSheetMaterials(); }catch(_){ }
    try{ if(Array.isArray(materials)) return materials; }catch(_){ }
    return [];
  }

  function getMaterialTypes(){ return unique(getMaterials().map((row)=> row && row.materialType)); }

  function getMaterialNamesByType(typeValue){
    const type = text(typeValue || 'laminat');
    return unique(getMaterials().filter((row)=> row && text(row.materialType) === type).map((row)=> row && row.name));
  }

  function getHardwareManufacturers(){
    try{ if(FC.catalogStore && typeof FC.catalogStore.getHardwareManufacturers === 'function') return unique(FC.catalogStore.getHardwareManufacturers()); }catch(_){ }
    return ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  }

  function optionList(values, emptyLabel){
    const out = [{ value:'', label:emptyLabel || '— nie ustawiaj —' }];
    unique(values || []).forEach((value)=> out.push({ value, label:value }));
    return out;
  }

  function makeSelectField(cfg, draft, onChange){
    const wrap = h('div', { class:'data-settings-default-field cabinet-extra-field cabinet-extra-field--select' });
    const label = h('label', { class:'data-settings-default-label cabinet-extra-field__label', for:cfg.id, text:cfg.label });
    const select = h('select', {
      id:cfg.id,
      class:'cabinet-extra-field__control cabinet-dynamic-choice-source',
      'data-launcher-label':cfg.label,
      'data-choice-title':cfg.title || ('Wybierz: ' + cfg.label),
      'data-choice-placeholder':cfg.label
    });
    const current = text(cfg.get(draft));
    const options = unique((typeof cfg.options === 'function' ? cfg.options(draft) : (cfg.options || [])).concat(current ? [current] : []));
    optionList(options, cfg.emptyLabel).forEach((opt)=>{
      const node = h('option', { value:opt.value, text:opt.label });
      select.appendChild(node);
    });
    select.value = current;
    select.addEventListener('change', ()=>{
      cfg.set(draft, select.value);
      if(typeof cfg.onChange === 'function') cfg.onChange(draft, select.value, select);
      if(typeof onChange === 'function') onChange(draft);
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    return { wrap, select };
  }

  function rebuildSelect(select, options, value){
    if(!select) return;
    select.innerHTML = '';
    const current = text(value);
    optionList(unique((options || []).concat(current ? [current] : [])), '— nie ustawiaj —').forEach((opt)=> select.appendChild(h('option', { value:opt.value, text:opt.label })));
    select.value = current;
  }

  function refreshChoices(rootEl){
    try{
      if(FC.cabinetChoiceLaunchers && typeof FC.cabinetChoiceLaunchers.refreshCabinetChoices === 'function'){
        FC.cabinetChoiceLaunchers.refreshCabinetChoices(rootEl || document);
      }
    }catch(_){ }
  }

  function render(scroll){
    if(!(scroll && h && FC.programDefaults)) return;
    let draft = FC.programDefaults.normalizeProgramDefaults(FC.programDefaults.read());
    scroll.innerHTML = '';

    const card = h('section', { class:'data-settings-card data-settings-defaults-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Domyślne materiały i okucia' })]);
    const infoBtn = h('button', { type:'button', class:'info-trigger data-settings-card-info', 'aria-label':'Pokaż informację: Domyślne materiały i okucia' });
    infoBtn.addEventListener('click', ()=>{
      if(dom.info) dom.info('Domyślne materiały i okucia', 'To są globalne fallbacki programu. Preferencje konkretnego pomieszczenia w WYWIADZIE mają pierwszeństwo, a te wartości są używane dopiero wtedy, gdy pomieszczenie nie ma własnego wyboru.');
    });
    titleRow.appendChild(infoBtn);
    card.appendChild(titleRow);

    const summary = h('div', { class:'data-settings-defaults-summary muted', text:FC.programDefaults.buildSummary(draft) });
    card.appendChild(summary);

    const materialGrid = h('div', { class:'data-settings-defaults-grid' });
    const materialFields = [
      { id:'programDefaultBodyColor', label:'Domyślny korpus', get:(d)=> d.materials.bodyColor, set:(d,v)=>{ d.materials.bodyColor = text(v); }, options:()=> getMaterialNamesByType('laminat') },
      { id:'programDefaultFrontMaterial', label:'Domyślny materiał frontu', get:(d)=> d.materials.frontMaterial, set:(d,v)=>{ d.materials.frontMaterial = text(v); }, options:getMaterialTypes, onChange:(d)=>{ if(!getMaterialNamesByType(d.materials.frontMaterial || 'laminat').includes(text(d.materials.frontColor))) d.materials.frontColor = ''; } },
      { id:'programDefaultFrontColor', label:'Domyślny kolor frontu', get:(d)=> d.materials.frontColor, set:(d,v)=>{ d.materials.frontColor = text(v); }, options:(d)=> getMaterialNamesByType(d.materials.frontMaterial || 'laminat') },
      { id:'programDefaultBackMaterial', label:'Domyślne plecy', get:(d)=> d.materials.backMaterial, set:(d,v)=>{ d.materials.backMaterial = text(v); }, options:BACK_MATERIALS }
    ];

    function onMaterialChange(){
      const frontColor = materialGrid.querySelector('#programDefaultFrontColor');
      if(frontColor) rebuildSelect(frontColor, getMaterialNamesByType(draft.materials.frontMaterial || 'laminat'), draft.materials.frontColor);
      summary.textContent = FC.programDefaults.buildSummary(draft);
      refreshChoices(card);
    }

    materialFields.forEach((cfg)=> materialGrid.appendChild(makeSelectField(cfg, draft, onMaterialChange).wrap));

    const hardwareGrid = h('div', { class:'data-settings-defaults-grid' });
    const manufacturerOptions = ()=> getHardwareManufacturers();
    [
      ['programDefaultHingesManufacturer', 'Domyślne zawiasy', 'hingesManufacturer'],
      ['programDefaultDrawerManufacturer', 'Domyślne szuflady / prowadnice', 'drawerSystemManufacturer'],
      ['programDefaultLiftManufacturer', 'Domyślne podnośniki', 'liftManufacturer'],
      ['programDefaultSlidingManufacturer', 'Domyślne systemy przesuwne', 'slidingSystemManufacturer'],
      ['programDefaultCargoManufacturer', 'Domyślne cargo / organizery', 'cargoManufacturer']
    ].forEach(([id, label, key])=>{
      hardwareGrid.appendChild(makeSelectField({
        id,
        label,
        get:(d)=> d.hardware[key],
        set:(d,v)=>{ d.hardware[key] = text(v); },
        options:manufacturerOptions
      }, draft, ()=>{ summary.textContent = FC.programDefaults.buildSummary(draft); refreshChoices(card); }).wrap);
    });

    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Materiały', [materialGrid], { open:true, sub:'4' }) : materialGrid);
    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Okucia', [hardwareGrid], { open:false, sub:'5' }) : hardwareGrid);

    const actions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
    const resetBtn = h('button', { type:'button', class:'btn btn-danger', text:'Wyczyść' });
    const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Anuluj zmiany' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    resetBtn.addEventListener('click', ()=>{
      draft = FC.programDefaults.normalizeProgramDefaults(null);
      [
        ['programDefaultBodyColor', draft.materials.bodyColor],
        ['programDefaultFrontMaterial', draft.materials.frontMaterial],
        ['programDefaultFrontColor', draft.materials.frontColor],
        ['programDefaultBackMaterial', draft.materials.backMaterial],
        ['programDefaultHingesManufacturer', draft.hardware.hingesManufacturer],
        ['programDefaultDrawerManufacturer', draft.hardware.drawerSystemManufacturer],
        ['programDefaultLiftManufacturer', draft.hardware.liftManufacturer],
        ['programDefaultSlidingManufacturer', draft.hardware.slidingSystemManufacturer],
        ['programDefaultCargoManufacturer', draft.hardware.cargoManufacturer]
      ].forEach(([id, value])=>{
        const select = card.querySelector('#' + id);
        if(select) select.value = text(value);
      });
      const frontColor = card.querySelector('#programDefaultFrontColor');
      if(frontColor) rebuildSelect(frontColor, getMaterialNamesByType('laminat'), '');
      summary.textContent = FC.programDefaults.buildSummary(draft);
      refreshChoices(card);
    });
    cancelBtn.addEventListener('click', ()=> render(scroll));
    saveBtn.addEventListener('click', ()=>{
      draft = FC.programDefaults.write(draft);
      summary.textContent = FC.programDefaults.buildSummary(draft);
      if(dom.info) dom.info('Zapisano', 'Domyślne materiały i okucia programu zostały zapisane.');
    });
    actions.appendChild(resetBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    card.appendChild(actions);

    scroll.appendChild(card);
    refreshChoices(card);
  }

  FC.dataSettingsDefaultsView = { render };
})();

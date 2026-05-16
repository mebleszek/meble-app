// js/app/ui/data-settings-defaults-view.js
// Widok globalnych domyślnych materiałów i okuć w trybiku strony głównej.
// Wybory są aplikacyjnymi launcherami ROZRYS — bez natywnych selectów/pickerów telefonu.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  const BACK_MATERIALS = ['HDF 3mm biała','HDF 3mm pod kolor','Płyta 18mm pod kolor','Brak'];
  const EMPTY_OPTION = '— nie ustawiaj —';

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
    const out = [{ value:'', label:emptyLabel || EMPTY_OPTION }];
    unique(values || []).forEach((value)=> out.push({ value, label:value }));
    return out;
  }

  function getChoiceApi(){
    const api = FC.rozrysChoice;
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function' && typeof api.setChoiceLaunchValue === 'function') return api;
    return null;
  }

  function selectedLabel(options, value, emptyLabel){
    const current = text(value);
    const rows = optionList(options, emptyLabel);
    const hit = rows.find((row)=> String(row.value) === current);
    return hit ? hit.label : (current || emptyLabel || EMPTY_OPTION);
  }

  function makeChoiceButton(label){
    const api = getChoiceApi();
    if(api && typeof api.createChoiceLauncher === 'function'){
      const btn = api.createChoiceLauncher(label, '');
      btn.classList.add('data-settings-default-choice', 'rozrys-choice-launch--options-clean');
      return btn;
    }
    const btn = h('button', { type:'button', class:'rozrys-choice-launch rozrys-choice-launch--options-clean data-settings-default-choice' });
    btn.innerHTML = '<span class="rozrys-choice-launch__value"><span class="rozrys-choice-launch__label"></span><span class="rozrys-choice-launch__meta"></span></span><span class="rozrys-choice-launch__arrow">▾</span>';
    const labelEl = btn.querySelector('.rozrys-choice-launch__label');
    if(labelEl) labelEl.textContent = String(label || '');
    return btn;
  }

  function setChoiceButtonLabel(btn, label){
    const api = getChoiceApi();
    if(api && typeof api.setChoiceLaunchValue === 'function') return api.setChoiceLaunchValue(btn, label, '');
    const labelEl = btn && btn.querySelector && btn.querySelector('.rozrys-choice-launch__label');
    if(labelEl) labelEl.textContent = String(label || '');
  }

  async function openChoice(title, options, value){
    const api = getChoiceApi();
    if(api && typeof api.openRozrysChoiceOverlay === 'function'){
      return api.openRozrysChoiceOverlay({ title, value:String(value || ''), options });
    }
    return null;
  }

  function makeChoiceField(cfg, draft, onChange){
    const wrap = h('div', { class:'data-settings-default-field' });
    wrap.appendChild(h('div', { class:'data-settings-default-label', text:cfg.label }));
    const getOptions = ()=> unique((typeof cfg.options === 'function' ? cfg.options(draft) : (cfg.options || [])).concat(text(cfg.get(draft)) ? [text(cfg.get(draft))] : []));
    const btn = makeChoiceButton(selectedLabel(getOptions(), cfg.get(draft), cfg.emptyLabel || EMPTY_OPTION));
    btn.setAttribute('aria-label', cfg.title || ('Wybierz: ' + cfg.label));
    btn.addEventListener('click', async ()=>{
      const options = optionList(getOptions(), cfg.emptyLabel || EMPTY_OPTION);
      const picked = await openChoice(cfg.title || ('Wybierz: ' + cfg.label), options, cfg.get(draft));
      if(picked == null || String(picked) === String(cfg.get(draft) || '')) return;
      cfg.set(draft, picked);
      if(typeof cfg.onChange === 'function') cfg.onChange(draft, picked, btn);
      setChoiceButtonLabel(btn, selectedLabel(getOptions(), cfg.get(draft), cfg.emptyLabel || EMPTY_OPTION));
      if(typeof onChange === 'function') onChange(draft);
    });
    wrap.appendChild(btn);
    return { wrap, refresh(){ setChoiceButtonLabel(btn, selectedLabel(getOptions(), cfg.get(draft), cfg.emptyLabel || EMPTY_OPTION)); } };
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
    const refreshers = [];
    function refreshAll(){
      refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } });
      summary.textContent = FC.programDefaults.buildSummary(draft);
    }

    const materialFields = [
      { label:'Domyślny korpus', get:(d)=> d.materials.bodyColor, set:(d,v)=>{ d.materials.bodyColor = text(v); }, options:()=> getMaterialNamesByType('laminat') },
      { label:'Domyślny materiał frontu', get:(d)=> d.materials.frontMaterial, set:(d,v)=>{ d.materials.frontMaterial = text(v); }, options:getMaterialTypes, onChange:(d)=>{ if(!getMaterialNamesByType(d.materials.frontMaterial || 'laminat').includes(text(d.materials.frontColor))) d.materials.frontColor = ''; } },
      { label:'Domyślny kolor frontu', get:(d)=> d.materials.frontColor, set:(d,v)=>{ d.materials.frontColor = text(v); }, options:(d)=> getMaterialNamesByType(d.materials.frontMaterial || 'laminat') },
      { label:'Domyślne plecy', get:(d)=> d.materials.backMaterial, set:(d,v)=>{ d.materials.backMaterial = text(v); }, options:BACK_MATERIALS }
    ];

    materialFields.forEach((cfg)=>{
      const field = makeChoiceField(cfg, draft, refreshAll);
      refreshers.push(field.refresh);
      materialGrid.appendChild(field.wrap);
    });

    const hardwareGrid = h('div', { class:'data-settings-defaults-grid' });
    const manufacturerOptions = ()=> getHardwareManufacturers();
    [
      ['Domyślne zawiasy', 'hingesManufacturer'],
      ['Domyślne szuflady / prowadnice', 'drawerSystemManufacturer'],
      ['Domyślne podnośniki', 'liftManufacturer'],
      ['Domyślne systemy przesuwne', 'slidingSystemManufacturer'],
      ['Domyślne cargo / organizery', 'cargoManufacturer']
    ].forEach(([label, key])=>{
      const field = makeChoiceField({ label, get:(d)=> d.hardware[key], set:(d,v)=>{ d.hardware[key] = text(v); }, options:manufacturerOptions }, draft, refreshAll);
      refreshers.push(field.refresh);
      hardwareGrid.appendChild(field.wrap);
    });

    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Materiały', [materialGrid], { open:true }) : materialGrid);
    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Okucia', [hardwareGrid], { open:false }) : hardwareGrid);

    const actions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
    const resetBtn = h('button', { type:'button', class:'btn btn-danger', text:'Wyczyść' });
    const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Anuluj zmiany' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    resetBtn.addEventListener('click', ()=>{
      draft = FC.programDefaults.normalizeProgramDefaults(null);
      refreshAll();
    });
    cancelBtn.addEventListener('click', ()=> render(scroll));
    saveBtn.addEventListener('click', ()=>{
      draft = FC.programDefaults.write(draft);
      refreshAll();
      if(dom.info) dom.info('Zapisano', 'Domyślne materiały i okucia programu zostały zapisane.');
    });
    actions.appendChild(resetBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    card.appendChild(actions);

    scroll.appendChild(card);
    refreshAll();
  }

  FC.dataSettingsDefaultsView = { render };
})();

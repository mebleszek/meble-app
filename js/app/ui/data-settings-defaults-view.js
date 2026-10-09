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

  function getMaterialTypes(){ return FC.roomPreferences.frontMaterialTypes(getMaterials()); }

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

  function syncDraftObject(target, next){
    const current = target && typeof target === 'object' ? target : {};
    const normalized = FC.programDefaults.normalizeProgramDefaults(next);
    Object.keys(current).forEach((key)=>{ delete current[key]; });
    Object.assign(current, normalized);
    return current;
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
    const getOptions = ()=> unique((typeof cfg.options === 'function' ? cfg.options(draft) : (cfg.options || [])).concat(!cfg.catalogOnly && text(cfg.get(draft)) ? [text(cfg.get(draft))] : []));
    const displayLabel = ()=> cfg.format ? cfg.format(cfg.get(draft)) : selectedLabel(getOptions(), cfg.get(draft), cfg.emptyLabel || EMPTY_OPTION);
    const btn = makeChoiceButton(displayLabel());
    btn.setAttribute('aria-label', cfg.title || ('Wybierz: ' + cfg.label));
    btn.addEventListener('click', async ()=>{
      const options = cfg.choices ? cfg.choices() : optionList(getOptions(), cfg.emptyLabel || EMPTY_OPTION);
      const picked = await openChoice(cfg.title || ('Wybierz: ' + cfg.label), options, cfg.get(draft));
      if(picked == null || String(picked) === String(cfg.get(draft) || '')) return;
      cfg.set(draft, picked);
      if(typeof cfg.onChange === 'function') cfg.onChange(draft, picked, btn);
      setChoiceButtonLabel(btn, displayLabel());
      if(typeof onChange === 'function') onChange(draft);
    });
    wrap.appendChild(btn);
    return { wrap, refresh(){ setChoiceButtonLabel(btn, displayLabel()); } };
  }

  function render(scroll){
    if(!(scroll && h && FC.programDefaults)) return;
    const draft = FC.programDefaults.normalizeProgramDefaults(FC.programDefaults.read());
    scroll.innerHTML = '';

    const card = h('section', { class:'data-settings-card data-settings-defaults-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Domyślne materiały i okucia' })]);
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function') titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.defaults.card', title:'Domyślne materiały i okucia', message:'To są globalne fallbacki programu. Preferencje konkretnego pomieszczenia w WYWIADZIE mają pierwszeństwo, a te wartości są używane dopiero wtedy, gdy pomieszczenie nie ma własnego wyboru.', scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
    else {
      const infoBtn = h('button', { type:'button', class:'info-trigger data-settings-card-info', 'aria-label':'Pokaż informację: Domyślne materiały i okucia' });
      infoBtn.addEventListener('click', ()=>{
        if(dom.info) dom.info('Domyślne materiały i okucia', 'To są globalne fallbacki programu. Preferencje konkretnego pomieszczenia w WYWIADZIE mają pierwszeństwo, a te wartości są używane dopiero wtedy, gdy pomieszczenie nie ma własnego wyboru.');
      });
      titleRow.appendChild(infoBtn);
    }
    card.appendChild(titleRow);

    const summary = h('div', { class:'data-settings-defaults-summary muted', text:FC.programDefaults.buildSummary(draft) });
    card.appendChild(summary);

    const materialGrid = h('div', { class:'data-settings-defaults-grid', 'data-accordion-group':'' });
    const refreshers = [];
    function refreshAll(){
      refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } });
      summary.textContent = FC.programDefaults.buildSummary(draft);
    }

    const api = FC.roomPreferences;
    const generalGrid = h('div', { class:'data-settings-defaults-grid' });
    [ ['Standard wykończenia','finishStandard',api.FINISH_STANDARDS], ['Standard blend','blendStandard',api.BLEND_STANDARDS] ].forEach(([label,key,options])=>{
      const field = makeChoiceField({ label, get:d=>d.general[key], set:(d,v)=>{ d.general[key] = text(v); }, options }, draft, refreshAll);
      refreshers.push(field.refresh); generalGrid.appendChild(field.wrap);
    });
    card.appendChild(dom.makeAccordion('Ogólne', [generalGrid], { open:false }));

    api.ZONE_KEYS.forEach((zoneKey)=>{
      const meta = api.ROOM_PREFERENCE_ZONES[zoneKey];
      const grid = h('div', { class:'data-settings-defaults-grid', 'data-default-zone':zoneKey });
      const fields = [
        { label:'Korpus', key:'bodyColor', options:()=>getMaterialNamesByType('laminat') },
        { label:'Materiał frontu', key:'frontMaterial', options:getMaterialTypes, onChange:d=>{ const z = d.zones[zoneKey]; if(!getMaterialNamesByType(z.frontMaterial || 'laminat').includes(z.frontColor)) z.frontColor = ''; } },
        { label:'Kolor frontu', key:'frontColor', options:d=>getMaterialNamesByType(d.zones[zoneKey].frontMaterial || 'laminat') },
        { label:'Plecy', key:'backMaterial', options:BACK_MATERIALS },
        { label:'Otwieranie', key:'openingSystem', options:api.OPENING_OPTIONS[meta.openingOptionsKey] },
        { label:'PCV korpusu', key:'bodyPcvMode', choices:()=>api.PCV_OPTIONS, format:api.pcvModeTitle }
      ];
      fields.forEach((cfg)=>{
        const field = makeChoiceField(Object.assign({},cfg,{ title:'Wybierz: ' + cfg.label + ' — ' + meta.shortLabel,
          get:d=>d.zones[zoneKey][cfg.key], set:(d,v)=>{ d.zones[zoneKey][cfg.key] = text(v); } }),draft,refreshAll);
        refreshers.push(field.refresh); grid.appendChild(field.wrap);
      });
      const custom = h('div', { class:'data-settings-default-field' });
      custom.appendChild(h('label', { class:'data-settings-default-label', text:'Kolor PCV korpusu', for:'defaultPcvColor_' + zoneKey }));
      const input = h('input', { id:'defaultPcvColor_' + zoneKey, type:'text', class:'investor-form-input', 'data-pcv-custom-zone':zoneKey });
      input.addEventListener('input', ()=>{ draft.zones[zoneKey].bodyPcvCustomColor = String(input.value || ''); });
      custom.appendChild(input); grid.appendChild(custom);
      refreshers.push(()=>{
        const zone = draft.zones[zoneKey];
        custom.hidden = !api.requiresCustomPcv(zone.bodyPcvMode, zone.frontMaterial || 'laminat');
        custom.style.display = custom.hidden ? 'none' : '';
        input.value = zone.bodyPcvCustomColor;
      });
      materialGrid.appendChild(dom.makeAccordion(meta.label, [grid], { open:false }));
    });

    const hardwareGrid = h('div', { class:'data-settings-defaults-grid' });
    [
      ['Domyślne zawiasy', 'hingesManufacturer'],
      ['Domyślne podnośniki', 'liftManufacturer'],
      ['Domyślne systemy przesuwne', 'slidingSystemManufacturer'],
      ['Domyślne cargo / organizery', 'cargoManufacturer'],
      ['Pozostałe akcesoria', 'accessoriesManufacturer']
    ].forEach(([label, key])=>{
      const field = makeChoiceField({ label, get:(d)=> d.hardware[key], set:(d,v)=>{ d.hardware[key] = text(v); }, catalogOnly:true, format:value=>text(value) || EMPTY_OPTION, options:()=>api.hardwareManufacturersForGroup(({ hingesManufacturer:'hinges', liftManufacturer:'lifts', slidingSystemManufacturer:'sliding', cargoManufacturer:'cargo', accessoriesManufacturer:'accessories' })[key]) }, draft, refreshAll);
      refreshers.push(field.refresh);
      hardwareGrid.appendChild(field.wrap);
    });

    const drawerWrap = h('div', { class:'data-settings-default-field' });
    drawerWrap.appendChild(h('div', { class:'data-settings-default-label', text:'Szuflady' }));
    const drawerBtn = makeChoiceButton('');
    drawerBtn.setAttribute('aria-label','Wybierz: Szuflady');
    drawerBtn.setAttribute('data-drawer-preference','');
    const refreshDrawer = ()=>setChoiceButtonLabel(drawerBtn, api.drawerPreferenceLabel(draft.hardware.drawerPreference, draft.hardware.drawerSystemManufacturer, draft.hardware.drawerSystemKey));
    drawerBtn.addEventListener('click', async ()=>{
      const result = await api.chooseDrawerPreference(openChoice, draft.hardware.drawerPreference, false);
      if(!result || !result.ok) return;
      draft.hardware.drawerPreference = result.value;
      delete draft.hardware.drawerSystemManufacturer;
      delete draft.hardware.drawerSystemKey;
      refreshAll();
    });
    drawerWrap.appendChild(drawerBtn); hardwareGrid.appendChild(drawerWrap); refreshers.push(refreshDrawer);

    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Materiały', [materialGrid], { open:false }) : materialGrid);
    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Okucia', [hardwareGrid], { open:false }) : hardwareGrid);

    const actions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
    const resetBtn = h('button', { type:'button', class:'btn btn-danger', text:'Wyczyść' });
    const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Anuluj zmiany' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    resetBtn.addEventListener('click', ()=>{
      syncDraftObject(draft, null);
      refreshAll();
    });
    cancelBtn.addEventListener('click', ()=> render(scroll));
    saveBtn.addEventListener('click', ()=>{
      if(!api.ZONE_KEYS.every(key=> !api.requiresCustomPcv(draft.zones[key].bodyPcvMode, draft.zones[key].frontMaterial || 'laminat') || text(draft.zones[key].bodyPcvCustomColor))){
        api.showCustomPcvRequired(); return;
      }
      const saved = FC.programDefaults.write(draft);
      if(!saved){ if(FC.infoBox) FC.infoBox.open({ title:'Nie zapisano ustawień', message:'Ustawienia pozostały w formularzu. Spróbuj ponownie.', okOnly:true }); return; }
      syncDraftObject(draft, saved);
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

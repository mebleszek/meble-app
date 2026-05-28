// js/app/material/price-modal-hardware-manufacturers.js
// Edycja listy producentów okuć w katalogu Akcesoria.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((key)=>{
        if(key === 'class') el.className = attrs[key];
        else if(key === 'text') el.textContent = attrs[key];
        else if(key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach((child)=> el.appendChild(child));
    return el;
  }

  function getStore(){ return ctx.catalogStore && ctx.catalogStore(); }
  function getManufacturers(){
    const store = getStore();
    return store && typeof store.getHardwareManufacturers === 'function' ? store.getHardwareManufacturers() : [];
  }
  function saveManufacturers(list){
    const store = getStore();
    if(store && typeof store.saveHardwareManufacturers === 'function') return store.saveHardwareManufacturers(list);
    return [];
  }
  function normalize(value){ return String(value == null ? '' : value).trim(); }

  function openHardwareManufacturersModal(){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    let list = getManufacturers();
    const body = h('div', { class:'panel-box-form hardware-manufacturer-form' });
    const listBox = h('div', { class:'hardware-manufacturer-list' });
    const input = h('input', { class:'investor-form-input', type:'text', placeholder:'Nowy producent, np. Blum' });
    const addBtn = h('button', { class:'btn-primary', type:'button', text:'Dodaj producenta' });
    const footer = h('div', { class:'panel-box-form__footer' });
    const backBtn = h('button', { class:'btn-primary', type:'button', text:'Wróć' });
    const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });

    function renderList(){
      listBox.innerHTML = '';
      if(!list.length){
        listBox.appendChild(h('div', { class:'muted', text:'Brak producentów w liście.' }));
        return;
      }
      list.forEach((name)=>{
        const row = h('div', { class:'list-item hardware-manufacturer-row' });
        const label = h('div', { class:'hardware-manufacturer-row__name', text:name });
        const remove = h('button', { class:'btn-danger', type:'button', text:'Usuń' });
        remove.addEventListener('click', ()=>{
          list = list.filter((item)=> String(item).toLowerCase() !== String(name).toLowerCase());
          renderList();
        });
        row.appendChild(label);
        row.appendChild(remove);
        listBox.appendChild(row);
      });
    }
    function addCurrent(){
      const value = normalize(input.value);
      if(!value) return;
      const exists = list.some((item)=> String(item).toLowerCase() === value.toLowerCase());
      if(!exists) list = list.concat(value);
      input.value = '';
      renderList();
    }

    addBtn.addEventListener('click', addCurrent);
    input.addEventListener('keydown', (event)=>{ if(event && event.key === 'Enter'){ event.preventDefault(); addCurrent(); } });
    backBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    saveBtn.addEventListener('click', ()=>{
      saveManufacturers(list);
      try{ ctx.syncFilterSelects && ctx.syncFilterSelects(); ctx.mountFilterChoices && ctx.mountFilterChoices(); ctx.renderPriceList && ctx.renderPriceList(); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ }
    });

    body.appendChild(h('div', { class:'hardware-manufacturer-add' }, [input, addBtn]));
    body.appendChild(listBox);
    footer.appendChild(backBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);
    renderList();

    FC.panelBox.open({
      title:'Producenci okuć',
      contentNode:body,
      width:'620px',
      boxClass:'panel-box--rozrys hardware-manufacturer-panel',
      dismissOnOverlay:false,
      dismissOnEsc:true,
    });
  }

  ctx.openHardwareManufacturersModal = openHardwareManufacturersModal;
  FC.priceModalHardwareManufacturers = { open:openHardwareManufacturersModal };
})();

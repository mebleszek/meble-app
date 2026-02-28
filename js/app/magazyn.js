/* magazyn.js — magazyn płyt (MVP)
   - Przechowuje typy płyt (materiał + format) i ilości
   - Dane w localStorage pod STORAGE_KEYS.sheets
   - UI renderowane w #magazynRoot
*/

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function sk(){
    return (FC.constants && FC.constants.STORAGE_KEYS) ? FC.constants.STORAGE_KEYS : (typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS : {});
  }

  function getAll(){
    try{
      const key = sk().sheets;
      const data = (FC.storage && FC.storage.getJSON) ? FC.storage.getJSON(key, { sheets: [] }) : { sheets: [] };
      if(!data || !Array.isArray(data.sheets)) return { sheets: [] };
      return data;
    }catch(_){
      return { sheets: [] };
    }
  }

  function saveAll(data){
    try{
      const key = sk().sheets;
      if(FC.storage && FC.storage.setJSON) FC.storage.setJSON(key, data);
    }catch(_){ }
  }

  function uid(){
    return 'sh_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36);
  }

  function upsertSheet(entry){
    const data = getAll();
    const e = entry || {};
    const id = e.id || uid();
    const norm = {
      id,
      material: String(e.material||'').trim(),
      width: Math.round(Number(e.width)||0),
      height: Math.round(Number(e.height)||0),
      qty: Math.round(Number(e.qty)||0),
    };
    if(!(norm.width>0 && norm.height>0)) return false;
    if(norm.qty < 0) norm.qty = 0;
    const idx = data.sheets.findIndex(s=>String(s.id)===String(id));
    if(idx>=0) data.sheets[idx] = norm;
    else data.sheets.unshift(norm);
    saveAll(data);
    return true;
  }

  function removeSheet(id){
    const data = getAll();
    data.sheets = data.sheets.filter(s=>String(s.id)!==String(id));
    saveAll(data);
  }

  function findForMaterial(material){
    const m = String(material||'').trim();
    const data = getAll();
    return data.sheets.filter(s=>String(s.material||'').trim()===m);
  }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k==='class') el.className = attrs[k];
        else if(k==='html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children||[]).forEach(ch=> el.appendChild(ch));
    return el;
  }

  function render(){
    const root = document.getElementById('magazynRoot');
    if(!root) return;

    const data = getAll();

    root.innerHTML = '';
    const card = h('div', { class:'card' });
    card.appendChild(h('h3', { style:'margin:0', html:'Magazyn płyt' }));
    card.appendChild(h('div', { class:'muted', style:'margin-top:6px', html:'Dodaj formaty płyt, żeby ROZRYS mógł je podpowiadać. (MVP)' }));

    // add form
    const form = h('div', { class:'grid-3', style:'margin-top:12px' });
    form.appendChild(h('div', null, [
      h('label', { html:'Materiał (klucz z Materiały)' }),
      h('input', { id:'magMat', placeholder:'np. Korpus: laminat • Egger W1100' })
    ]));
    form.appendChild(h('div', null, [
      h('label', { html:'Format płyty (mm)' }),
      h('div', { style:'display:flex;gap:8px' }, [
        h('input', { id:'magW', type:'number', placeholder:'2800' }),
        h('input', { id:'magH', type:'number', placeholder:'2070' }),
      ])
    ]));
    form.appendChild(h('div', null, [
      h('label', { html:'Ilość (szt.)' }),
      h('input', { id:'magQty', type:'number', placeholder:'0' })
    ]));

    card.appendChild(form);
    const btnRow = h('div', { style:'display:flex;gap:10px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap' });
    const addBtn = h('button', { class:'btn-primary', type:'button' });
    addBtn.textContent = 'Dodaj do magazynu';
    addBtn.addEventListener('click', () => {
      const mat = document.getElementById('magMat')?.value || '';
      const w = document.getElementById('magW')?.value;
      const hh = document.getElementById('magH')?.value;
      const qty = document.getElementById('magQty')?.value;
      if(!mat.trim()) return alert('Wpisz materiał (klucz)');
      if(!(Number(w)>0 && Number(hh)>0)) return alert('Podaj format płyty');
      upsertSheet({ material: mat.trim(), width: Number(w), height: Number(hh), qty: Number(qty||0) });
      render();
    });
    btnRow.appendChild(addBtn);
    card.appendChild(btnRow);

    card.appendChild(h('div', { class:'hr' }));

    if(!data.sheets.length){
      card.appendChild(h('div', { class:'muted', html:'Brak zapisanych płyt w magazynie.' }));
      root.appendChild(card);
      return;
    }

    // list
    const list = h('div', { style:'display:flex;flex-direction:column;gap:10px' });
    data.sheets.forEach(s=>{
      const row = h('div', { class:'card', style:'margin:0' });
      row.appendChild(h('div', { style:'font-weight:900', html: (s.material||'—') }));
      row.appendChild(h('div', { class:'muted xs', style:'margin-top:4px', html:`${s.width} × ${s.height} mm • ilość: ${s.qty}` }));
      const actions = h('div', { style:'display:flex;gap:8px;justify-content:flex-end;margin-top:8px' });
      const del = h('button', { class:'btn danger', type:'button' });
      del.textContent = 'Usuń';
      del.addEventListener('click', () => {
        if(!confirm('Usunąć z magazynu?')) return;
        removeSheet(s.id);
        render();
      });
      actions.appendChild(del);
      row.appendChild(actions);
      list.appendChild(row);
    });
    card.appendChild(list);
    root.appendChild(card);
  }

  FC.magazyn = {
    getAll,
    saveAll,
    upsertSheet,
    removeSheet,
    findForMaterial,
    render,
  };
})();

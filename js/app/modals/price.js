// js/app/modals/price.js
// Price/materials/services modal logic extracted from app.js
(function(){
  'use strict';
  window.FC = window.FC || {};
function closePriceModal(){ unlockModalScroll(); uiState.showPriceList = null; uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); document.getElementById('priceModal').style.display = 'none'; }

function saveMaterialFromForm(){
  const type = document.getElementById('formMaterialType').value;
  const manufacturer = document.getElementById('formManufacturer').value;
  const symbol = document.getElementById('formSymbol').value.trim();
  const name = document.getElementById('formName').value.trim();
  const price = parseFloat(document.getElementById('formPrice').value || 0);
  if(!name){ alert('Wprowadź nazwę'); return; }
  const data = { materialType: type, manufacturer, symbol, name, price };
  if(uiState.editingId){
    materials = materials.map(m => m.id === uiState.editingId ? Object.assign({}, m, data) : m);
    uiState.editingId = null;
  } else {
    const id = FC.utils.uid();
    materials.push(Object.assign({ id }, data));
  }
  FC.storage.setJSON(STORAGE_KEYS.materials, materials);
  renderPriceModal();
  renderCabinetModal();
}

function saveServiceFromForm(){
  const category = document.getElementById('formCategory').value.trim() || 'Montaż';
  const name = document.getElementById('formServiceName').value.trim();
  const price = parseFloat(document.getElementById('formServicePrice').value || 0);
  if(!name){ alert('Wprowadź nazwę'); return; }
  const data = { category, name, price };
  if(uiState.editingId){
    services = services.map(s => s.id === uiState.editingId ? Object.assign({}, s, data) : s);
    uiState.editingId = null;
  } else {
    const id = FC.utils.uid();
    services.push(Object.assign({ id }, data));
  }
  FC.storage.setJSON(STORAGE_KEYS.services, services);
  renderPriceModal();
}

function deletePriceItem(item){
  if(!confirm('Usunąć pozycję?')) return;
  if(uiState.showPriceList === 'materials'){ materials = materials.filter(m => m.id !== item.id); FC.storage.setJSON(STORAGE_KEYS.materials, materials); }
  else { services = services.filter(s => s.id !== item.id); FC.storage.setJSON(STORAGE_KEYS.services, services); }
  renderPriceModal();
  renderCabinetModal();
}

function renderPriceModal(){
  const modal = document.getElementById('priceModal'); const type = uiState.showPriceList;
  if(!type){ modal.style.display = 'none'; return; }
  modal.style.display = 'flex';
  const isMat = type === 'materials';
  document.getElementById('priceModalTitle').textContent = isMat ? 'Cennik Materiałów' : 'Cennik Usług';
  document.getElementById('priceModalSubtitle').textContent = isMat ? 'Dodaj/edytuj materiały' : 'Dodaj/edytuj usługi';
  document.getElementById('priceModalIcon').textContent = isMat ? '🧩' : '🔧';
  document.getElementById('materialFormFields').style.display = isMat ? 'block' : 'none';
  document.getElementById('serviceFormFields').style.display = isMat ? 'none' : 'block';
  document.getElementById('editingIndicator').style.display = uiState.editingId ? 'inline-block' : 'none';

  const formMaterialType = document.getElementById('formMaterialType'); formMaterialType.innerHTML = '';
  ['laminat','akryl','lakier','blat','akcesoria'].forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; formMaterialType.appendChild(o); });
  const formManufacturer = document.getElementById('formManufacturer');
  function populateManufacturersFor(typeVal){ formManufacturer.innerHTML=''; (MANUFACTURERS[typeVal]||[]).forEach(m=>{const o=document.createElement('option'); o.value=m; o.textContent=m; formManufacturer.appendChild(o)}); }
  populateManufacturersFor(formMaterialType.value);
  formMaterialType.onchange = () => populateManufacturersFor(formMaterialType.value);

  if(uiState.editingId){
    if(isMat){
      const item = materials.find(m => m.id === uiState.editingId);
      if(item){
        formMaterialType.value = item.materialType || 'laminat';
        populateManufacturersFor(formMaterialType.value);
        document.getElementById('formManufacturer').value = item.manufacturer || '';
        document.getElementById('formSymbol').value = item.symbol || '';
        document.getElementById('formName').value = item.name || '';
        document.getElementById('formPrice').value = item.price || '';
      }
    } else {
      const item = services.find(s => s.id === uiState.editingId);
      if(item){
        document.getElementById('formCategory').value = item.category || 'Montaż';
        document.getElementById('formServiceName').value = item.name || '';
        document.getElementById('formServicePrice').value = item.price || '';
      }
    }
    document.getElementById('cancelEditBtn').style.display = isMat ? 'inline-block' : 'none';
    document.getElementById('cancelServiceEditBtn').style.display = isMat ? 'none' : 'inline-block';
  } else {
    formMaterialType.value = 'laminat'; populateManufacturersFor('laminat');
    document.getElementById('formSymbol').value = '';
    document.getElementById('formName').value = '';
    document.getElementById('formPrice').value = '';
    document.getElementById('formCategory').value = 'Montaż';
    document.getElementById('formServiceName').value = '';
    document.getElementById('formServicePrice').value = '';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('cancelServiceEditBtn').style.display = 'none';
  }

  const q = document.getElementById('priceSearch').value.trim().toLowerCase();
  const list = isMat ? materials : services;
  const filtered = list.filter(item => {
    const name = (item.name||'').toLowerCase(); const symbol=(item.symbol||'').toLowerCase(); const manu=(item.manufacturer||'').toLowerCase();
    const mt=(item.materialType||'').toLowerCase(); const cat=(item.category||'').toLowerCase();
    return name.includes(q) || symbol.includes(q) || manu.includes(q) || mt.includes(q) || cat.includes(q);
  });

  const container = document.getElementById('priceListItems'); container.innerHTML = '';
  filtered.forEach(item => {
    const row = document.createElement('div'); row.className='list-item';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:900">${item.name}</div><div class="muted-tag xs">${isMat ? (item.materialType + ' • ' + (item.manufacturer||'') + (item.symbol ? ' • SYM: '+item.symbol : '')) : (item.category || '')}</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';
    const price = document.createElement('div'); price.style.fontWeight='900'; price.textContent = (Number(item.price)||0).toFixed(2) + ' PLN';
    const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='Edytuj';
    const delBtn = document.createElement('button'); delBtn.className='btn-danger'; delBtn.textContent='Usuń';
    right.appendChild(price); right.appendChild(editBtn); right.appendChild(delBtn);
    row.appendChild(left); row.appendChild(right); container.appendChild(row);

    editBtn.addEventListener('click', () => { uiState.editingId = item.id; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); });
    delBtn.addEventListener('click', () => deletePriceItem(item));
  });

  document.getElementById('savePriceBtn').onclick = saveMaterialFromForm;
  document.getElementById('saveServiceBtn').onclick = saveServiceFromForm;
  document.getElementById('cancelEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
  document.getElementById('cancelServiceEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
}

  // Export to global (app.js expects these names)
  window.renderPriceModal = renderPriceModal;
  window.closePriceModal = closePriceModal;
  window.deletePriceItem = deletePriceItem;
  window.saveMaterialFromForm = saveMaterialFromForm;
  window.saveServiceFromForm = saveServiceFromForm;
})();

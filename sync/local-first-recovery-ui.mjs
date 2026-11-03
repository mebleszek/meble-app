// Owner-approved read-only mode of the existing recovery panel. No repair UI.
let active=null;
export async function openLocalFirstRecovery({window:w,api,exclusive,authorize,parent,onClose=()=>{}}){
 authorize();active?.dispatchEvent(new w.Event('meble-rescue-revoke'));active?.remove();const d=w.document,element=(tag,text)=>{const el=d.createElement(tag);if(text)el.textContent=text;return el;};
 const overlay=element('div');overlay.setAttribute('data-storage-recovery','');overlay.setAttribute('data-local-first-rescue','');
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;color:#111';
 const box=element('section');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Tryb ratunkowy');
 box.style.cssText='width:100%;max-width:620px;max-height:calc(100dvh - 24px);overflow:auto;background:white;border-radius:16px;padding:16px;box-sizing:border-box';
 box.append(element('h2','Tryb ratunkowy'),element('p','Kopia LOCAL-FIRST. Wyłącznie odczyt; start i naprawa pozostają zablokowane. Dane prywatne pozostają na urządzeniu.'));
 const status=element('p','BACKUP_PENDING — pobierz plik i niezależnie wybierz go ponownie.');status.setAttribute('role','status');status.dataset.rescueStatus='BACKUP_PENDING';status.style.overflowWrap='anywhere';box.append(status);
 const label=element('label','Hasło prywatnego pliku (minimum 12 znaków). Zachowaj je osobno.');
 const password=element('input');password.type='password';password.autocomplete='new-password';password.setAttribute('aria-label','Hasło pliku ratunkowego');password.style.cssText='width:100%;min-height:44px;box-sizing:border-box';label.append(password);box.append(label);
 const download=element('button','Pobierz szyfrowaną kopię ratunkową');download.type='button';download.style.cssText='width:100%;min-height:44px;margin-top:12px';box.append(download);
 const file=element('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Pobrany plik ratunkowy');file.style.cssText='width:100%;margin:12px 0';box.append(file);
 const finish=element('button','Zamknij');finish.type='button';finish.style.cssText='width:100%;min-height:44px';box.append(finish);
 let token=null,receipt=null,privatePlan=null,busy=false;
 function cleanup(){password.value='';file.value='';token=null;receipt=null;privatePlan=null;overlay.remove();if(active===overlay)active=null;onClose();}
 overlay.addEventListener('meble-rescue-revoke',cleanup);
 async function run(operation){if(busy)return;busy=true;download.disabled=true;file.disabled=true;finish.disabled=true;
  try{authorize();await exclusive(operation);authorize();}
  catch(error){receipt=null;privatePlan=null;const code=error?.code||error?.message||'';status.dataset.rescueStatus='BLOCKED';status.textContent='STOP / '+(/^(?:RESCUE|CODE_REBUILD)_[A-Z_]+$/.test(code)?code:'RESCUE_OPERATION_FAILED')+'. Nie zmieniono danych.';}
  finally{busy=false;download.disabled=false;file.disabled=false;finish.disabled=false;}
 }
 download.addEventListener('click',event=>{if(!event.isTrusted)return;void run(async()=>{
  receipt=null;privatePlan=null;token=await api.prepare(password.value);await api.download(token);file.value='';
  status.dataset.rescueStatus='BACKUP_PENDING';status.textContent='BACKUP_PENDING — poczekaj na ukończenie pobierania. Wybierz pobrany plik poniżej, aby niezależnie odczytać i zweryfikować go bez importu.';
 });});
 file.addEventListener('change',event=>{if(!event.isTrusted)return;void run(async()=>{
  receipt=await api.verifySelection(file,event,password.value,token||undefined);
  if(receipt.status!=='BACKUP_PASS'){status.dataset.rescueStatus=receipt.status;status.textContent='FILE_VERIFIED_STALE — plik odszyfrowany, ale RAM lub sesja bieżącej karty nie są potwierdzone. BACKUP_PENDING / REPAIR_BLOCKED.';return;}
  status.dataset.rescueStatus='VERIFYING';
  const {codeCandidate}=await import('./code-global-catalogs.generated.mjs');
  privatePlan=await api.planRebuild(receipt,codeCandidate);
  status.dataset.rescueStatus='BACKUP_PASS';
  status.textContent='BACKUP_PASS — niezależny odczyt pliku, SHA-256, odszyfrowanie i zakres potwierdzone. Prywatny plan 14 domen zachowuje różnice obu warstw. REPAIR_BLOCKED — bez zapisu. RAM innych kart i kopia chmurowa nie są potwierdzone.';
 });});
 finish.addEventListener('click',()=>{if(!busy)cleanup();});
 overlay.append(box);parent.append(overlay);active=overlay;return overlay;
}

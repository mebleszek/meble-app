import {confirmQuoteSources} from './quote-ui-actions.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { doc, getDoc } from 'firebase/firestore';
import { digest, json } from '../../sync/local-first-values.mjs';
import { runNormalApplication } from './normal-application.cases.mjs';

async function image(device) {
  const result = await device.page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open('meble-lf-test-normal-' + name);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['control', 'outbox'], 'readonly');
      const state = tx.objectStore('control').get('application');
      const queue = tx.objectStore('outbox').getAll();
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.oncomplete = () => { db.close(); resolve({ state: state.result, queue: queue.result }); };
    };
  }), device.name);
  assert.equal(result.state.hash, await digest(json(result.state.rows)));
  return result;
}

const rows = (record, key) => JSON.parse(record.state.rows[key] || '[]');
const idle = page => page.waitForFunction(() => !window.FC.applicationStartup.inspect().transactionPending);

async function list(page) {
  const listView = page.locator('#investorsListView');
  if(await listView.isVisible()){await idle(page);return;}
  if(await page.locator('#homeView').isVisible()){
    await page.locator('#openFurnitureProjectsBtn').click();
    // A click dispatches an async, transactional transition. Check the actual
    // destination instead of clicking a hidden hub button for 30 seconds.
    try{
      await page.waitForFunction(()=>['modeHub','investorsList'].includes(window.uiState?.entry)
        && !window.FC.applicationStartup.inspect().transactionPending,null,{timeout:10000});
    }catch(_){
      const observed=await page.evaluate(()=>({
        entry:window.uiState?.entry,transactionPending:window.FC.applicationStartup.inspect().transactionPending,
        code:window.FC.applicationStartup.inspect().lastCode,
        hubVisible:getComputedStyle(document.getElementById('modeHubView')).display,
        notice:document.querySelector('.info-box')?.innerText
      }));
      throw Error('MODE_HUB_NAVIGATION_UNCONFIRMED: '+JSON.stringify(observed));
    }
  }
  if(await page.locator('#modeHubView').isVisible()){
    await page.locator('#modeHubRoot [data-action="open-investors-list"]').click();
  }else if(!await listView.isVisible() && await page.locator('#sessionCancel').isVisible()){
    await page.locator('#sessionCancel').click();
  }
  await listView.waitFor({state:'visible'});
  await idle(page);
}

async function openInvestor(page, id) {
  await list(page);
  await page.locator('[data-action="open-investor"][data-inv-id="' + id + '"]').click();
  await page.locator('[data-investor-action="add-room"]').waitFor();
  await idle(page);
}

async function evidence(t, label, device, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'meble-sync-ui-' + label + '-'));
  let context = device.page.context();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  async function checkpointTrace(restart) {
    await context.tracing.stop({ path: path.join(dir, 'before-restart.zip') });
    await restart(device);
    context = device.page.context();
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }
  try {
    await device.page.evaluate(() => {
      const writer = window.FC.applicationWrite;
      const protectedKeys = ['fc_investors_v1', 'fc_projects_v1', 'fc_quote_snapshots_v1'];
      const readRows = key => JSON.parse(localStorage.getItem(key) || '[]');
      for (const kind of ['auto', 'project', 'offerDraft']) {
        const write = writer[kind];
        writer[kind] = async (...args) => {
          try {
            if (kind !== 'auto') return await write(...args);
            const [operation, ...options] = args;
            return await write(async () => {
              const before = Object.fromEntries(protectedKeys.map(key => [key, readRows(key)]));
              const result = await operation();
              window.testChangedExisting = Object.fromEntries(protectedKeys.map(key => {
                const after = readRows(key);
                return [key, before[key].filter(row => JSON.stringify(row) !== JSON.stringify(after.find(next => next.id === row.id))).length];
              }));
              return result;
            }, ...options);
          }
          catch (error) {
            if (/^(LF_|SESSION_|CLOUD_)[A-Z_]+$/.test(error.code || error.message)) {
              window.testSyncUiRefusal = error.code || error.message;
            }
            throw error;
          }
        };
      }
    });
    await run(checkpointTrace);
    await context.tracing.stop();
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    const page = device.page;
    const persisted = await image(device).catch(() => null);
    const codes = await page.evaluate(() => ({
      write: window.FC.storage?.getLastWriteError()?.error?.code,
      refusal: window.testSyncUiRefusal,
      changedExisting: window.testChangedExisting,
      startup: window.FC.applicationStartup.inspect().code,
      diagnostics: window.FC.applicationStartup.diagnostics().firstError?.code,
      notice: document.querySelector('.info-box')?.innerText,
      history: document.querySelectorAll('[data-quote-history-id]').length,
    })).catch(() => null);
    await writeFile(path.join(dir, 'evidence.json'), JSON.stringify({
      label, codes, applicationHash: persisted?.state.hash,
      historyIds: persisted && rows(persisted, 'fc_quote_snapshots_v1').map(row => row.id),
      outbox: persisted?.queue.map(({ scope, phase }) => ({ scope, phase })),
    }, null, 2));
    await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 5000 }).catch(() => {});
    await context.tracing.stop({ path: path.join(dir, 'failure.zip') }).catch(() => {});
    t.diagnostic(JSON.stringify({ artifacts: dir, codes }));
    throw error;
  }
}

async function abortNextWrite(device) {
  await device.page.evaluate(name => {
    const original=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode,...rest){
      const tx=original.call(this,stores,mode,...rest);
      if(this.name==='meble-lf-test-normal-'+name && mode==='readwrite' && Array.from(stores).includes('control')){
        IDBDatabase.prototype.transaction=original;
        queueMicrotask(()=>tx.abort());
      }
      return tx;
    };
  },device.name);
}

function protectedRows(before, after, allowed) {
  for (const key of Object.keys(before.state.rows)) {
    if (!allowed.includes(key)) assert.equal(after.state.rows[key],before.state.rows[key],key);
  }
}

test('E1 signed DEMO synchronized UI', async t => {
  await runNormalApplication(t, { deployment: true, runUi: async ({ phone, computer, pid, ids, room, room2, uid, ownerClient, restart }) => {
    const head = scope => doc(ownerClient, 'users', uid, 'localFirstProjects', scope);
    async function confirmAck(writer, reader, projectId, predicate) {
      const remote = await getDoc(head(projectId));
      assert.ok(remote.exists(), 'Project must have a server head');
      const revision=remote.data().currentRevisionId;
      await writer.page.waitForFunction(({name,scope,revision})=>new Promise((resolve,reject)=>{
        const request=indexedDB.open('meble-lf-test-normal-'+name);
        request.onupgradeneeded=()=>request.transaction.abort();
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
          const db=request.result;
          const read=db.transaction('outbox').objectStore('outbox').getAll();
          read.onerror=()=>{db.close();reject(read.error);};
          read.onsuccess=()=>{
            db.close();
            resolve(read.result.some(op=>op.scope===scope&&op.phase==='verified'&&op.receipt?.currentRevisionId===revision));
          };
        };
      }),{name:writer.name,scope:projectId,revision});
      const written = await image(writer);
      assert.ok(written.queue.some(op => op.scope === projectId && op.phase === 'verified'
        && op.receipt?.currentRevisionId === remote.data().currentRevisionId), 'Outbox requires a verified ACK for the server revision');
      assert.ok(predicate(await image(reader)), 'Second profile must contain the same business record in IndexedDB');
    }

    async function openQuote(page) {
      await openInvestor(page, ids[0]);
      await page.locator('.investor-room-quick-btn[data-room="' + room + '"]').click();
      await idle(page);
      await page.locator('[data-action="tab"][data-tab="wycena"]').click();
      await page.locator('[data-action="wycena-generate"]').waitFor();
      await idle(page);
    }

    async function dismissFailure(page, text) {
      const dialog=page.locator('.info-box').filter({hasText:text});
      await dialog.locator('.is-success').click();
      await idle(page);
    }

    // The second profile may start before its first independently verified
    // project is received. Do not navigate against an unfinished initial read.
    await computer.page.waitForFunction(id => !!window.FC.investors.getById(id)
      && !window.FC.applicationStartup.inspect().transactionPending, ids[0]);

    await t.test('new investor save, ACK and reopen after restart', async sub => {
      await evidence(sub, 'investor', computer, async restartWithTrace => {
        const { page } = computer;
        await list(page);
        const beforeForm = await image(computer);
        await page.locator('#investorsListView [data-action="create-investor"]').click();
        const name = 'DEMO synchronized investor';
        for (const [id, value] of Object.entries({
          invName: name, invPhone: '123456789', invCity: 'Test City',
          invEmail: 'sync-ui@example.invalid', invAddress: 'Synthetic address',
          invTransportDistanceKm: '12', invTransportDurationMin: '30', invCarryingFloorNumber: '0',
        })) await page.locator('#' + id).fill(value);
        await page.locator('#invSourceLaunch button').click();
        await page.locator('.rozrys-choice-modal .rozrys-choice-option:not([disabled])').nth(1).click();
        // Setup intentionally opens the editor through a queued UI checkpoint.
        // Capture the abort boundary only after that user transition is durable;
        // still prove that setup changed no business row or outbox operation.
        await idle(page);
        const before = await image(computer);
        protectedRows(beforeForm,before,['fc_ui_v1']);
        assert.deepEqual(before.queue,beforeForm.queue);
        sub.diagnostic(JSON.stringify({setupBeforeVersion:beforeForm.state.version,beforeAbortVersion:before.state.version,setupChangedKeys:Object.keys(before.state.rows).filter(key=>before.state.rows[key]!==beforeForm.state.rows[key])}));
        const save=async()=>{
          await page.locator('#investorActionBar [data-investor-action="save"]').click();
          await page.locator('.confirm-box .is-success').click();
          await idle(page);
        };
        await abortNextWrite(computer);
        await save();
        await dismissFailure(page,'Nie zapisano inwestora');
        assert.equal(await page.evaluate(()=>window.testSyncUiRefusal),'LF_IDB_ABORTED');
        assert.deepEqual(await image(computer),before);
        assert.equal(await page.locator('input#invName:not([readonly]):not([disabled])').inputValue(),name);
        assert.equal(await page.locator('#invAddress').inputValue(),'Synthetic address');
        await save();
        await page.locator('input#invName:not([readonly]):not([disabled])').waitFor({state:'hidden'});
        await idle(page);
        const after = await image(computer);
        const investor = rows(after, 'fc_investors_v1').find(row => row.name === name);
        for (const key of ['fc_investors_v1', 'fc_projects_v1', 'fc_quote_snapshots_v1']) {
          for (const old of rows(before, key)) assert.deepEqual(rows(after, key).find(row => row.id === old.id), old);
        }
        if (!investor) {
          assert.deepEqual(after.queue, before.queue);
          const field = page.locator('#invName');
          assert.equal(await field.evaluate(el => el.value ?? el.textContent), name, 'Refused save must retain the entered name');
          assert.equal(await page.locator('input#invName:not([readonly]):not([disabled])').count(), 1, 'Refused save must preserve edit mode');
        }
        assert.ok(investor, 'UI save did not persist the new investor');
        const project = rows(after, 'fc_projects_v1').find(row => row.investorId === investor.id);
        assert.ok(project);
        await phone.page.waitForFunction(id => !!window.FC.investors.getById(id), investor.id);
        await confirmAck(computer, phone, project.id, received => rows(received, 'fc_investors_v1').some(row => row.id === investor.id));
        await restartWithTrace(restart);
        await openInvestor(computer.page, investor.id);
        assert.equal(await computer.page.locator('#invName').textContent(), name);
        assert.deepEqual(rows(await image(computer), 'fc_investors_v1').find(row => row.id === investor.id), investor);
      });
    });

    let generated;
    await t.test('Wyceń refuses an aborted write, then persists history, restart, second profile and ACK', async sub => {
      await evidence(sub, 'quote', phone, async restartWithTrace => {
        const { page } = phone;
        await openQuote(page);
        const calculate = page.locator('[data-action="wycena-generate"]');
        const before = await image(phone);
        await abortNextWrite(phone);
        await calculate.click();
        await dismissFailure(page,'LF_IDB_ABORTED');
        assert.deepEqual(await image(phone),before);
        assert.equal(await page.locator('[data-quote-history-id]').count(),rows(before,'fc_quote_snapshots_v1').length);
        await calculate.click();
        await page.locator('[data-quote-history-id]').first().waitFor();
        await idle(page);
        const after = await image(phone);
        const oldOffers = rows(before, 'fc_quote_snapshots_v1');
        const offers = rows(after, 'fc_quote_snapshots_v1');
        const added = offers.find(offer => offer.project?.id === pid && !oldOffers.some(old => old.id === offer.id));
        assert.deepEqual(rows(after, 'fc_projects_v1').filter(row => row.id !== pid), rows(before, 'fc_projects_v1').filter(row => row.id !== pid));
        for (const old of oldOffers) assert.deepEqual(offers.find(row => row.id === old.id), old);
        assert.equal(after.state.rows.fc_investors_v1, before.state.rows.fc_investors_v1);
        if (!added) {
          assert.deepEqual(after.queue, before.queue, 'Failed offer must not enqueue an operation');
          const history = await page.locator('[data-quote-history-id]').evaluateAll(items => items.map(item => item.dataset.quoteHistoryId));
          assert.ok(history.every(id => oldOffers.some(row => row.id === id)), 'A refused offer must not appear in history');
        }
        assert.ok(added, 'Wyceń did not create a durable history record');
        await page.locator('[data-quote-history-id="' + added.id + '"]').waitFor();
        await computer.page.waitForFunction(({ pid, id }) => window.FC.quoteSnapshotStore.listForProject(pid).some(row => row.id === id), { pid, id: added.id });
        await confirmAck(phone, computer, pid, received => rows(received, 'fc_quote_snapshots_v1').some(row => row.id === added.id));
        await restartWithTrace(restart);
        await openInvestor(phone.page, ids[0]);
        await phone.page.locator('.investor-room-quick-btn[data-room="' + room + '"]').click();
        await idle(phone.page);
        await phone.page.locator('[data-action="tab"][data-tab="wycena"]').click();
        await phone.page.locator('[data-quote-history-id="' + added.id + '"]').waitFor();
        assert.deepEqual(rows(await image(phone), 'fc_quote_snapshots_v1').find(row => row.id === added.id), added);
        generated=added;
      });
    });

    await t.test('offer settings checkpoint, scope refusal, abort, restart and accepted history', async sub => {
      await evidence(sub, 'settings', phone, async restartWithTrace => {
        assert.ok(generated,'A real generated snapshot is required to seed accepted history');
        const {page}=phone;
        await list(page);
        // Prepare accepted-history fixture with the domain command and real persistence.
        // Acceptance itself is outside this UI regression.
        await openInvestor(page,ids[0]);
        assert.equal(await page.evaluate(id=>window.FC.applicationWrite.project(()=>{
          const fc=window.FC;
          return fc.projectStatusSync.commitAcceptedSnapshot(fc.quoteSnapshotStore.getById(id),'zaakceptowany',{refreshUi:false}).ok;
        }),generated.id),true);
        await page.waitForFunction(() => !window.FC.applicationStartup.inspect().transactionPending);
        await openQuote(page);
        await page.waitForFunction(() => !window.normalPendingRpc?.length);
        await computer.page.waitForFunction(id=>Number(window.FC.quoteSnapshotStore.getById(id)?.meta.acceptedAt)>0,generated.id);
        await confirmAck(phone,computer,pid,received=>rows(received,'fc_quote_snapshots_v1').some(row=>row.id===generated.id&&row.meta.acceptedAt>0));
        const before = await image(phone);
        const remoteBefore=(await getDoc(head(pid))).data();
        const accepted = rows(before,'fc_quote_snapshots_v1').find(row=>row.id===generated.id);
        assert.ok(accepted.meta.acceptedAt>0);
        const selected=()=>page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
        const draft=record=>rows(record,'fc_quote_offer_drafts_v1').find(row=>row.projectId===pid);
        const openCommercial=async()=>{
          if(!await page.locator('[data-bill-breaks]').isVisible()){
            await page.locator('.quote-offer-accordion__trigger').filter({hasText:'Ustawienia'}).click();
          }
        };
        await openCommercial();
        await abortNextWrite(phone);
        await page.getByText('Naliczaj klientowi koszt przerw',{exact:true}).click();
        await dismissFailure(page,'Nie potwierdzono zmiany kosztu przerw');
        assert.equal(await page.locator('[data-bill-breaks]').isChecked(),false);
        assert.equal(await page.evaluate(()=>window.testSyncUiRefusal),'LF_IDB_ABORTED');
        assert.deepEqual(await image(phone),before);
        await page.getByText('Naliczaj klientowi koszt przerw',{exact:true}).click();
        await selected();
        await page.getByText('Naliczaj klientowi koszt przerw',{exact:true}).click();
        await selected();
        await openCommercial();
        assert.equal(draft(await image(phone)).commercial.billBreaks,false);
        await page.locator('.quote-selection-launch--rooms').click();
        const roomPicker=page.locator('.panel-box-backdrop');
        const second=roomPicker.locator('label').filter({has:page.getByText('Normal second kitchen',{exact:true})});
        const first=roomPicker.locator('label').filter({has:page.getByText('Normal kitchen',{exact:true})});
        if(!await second.locator('input').isChecked())await second.locator('.rozrys-room-chip__label').click();
        if(await first.locator('input').isChecked())await first.locator('.rozrys-room-chip__label').click();
        await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();
        await selected();
        await page.locator('.panel-box-backdrop').waitFor({state:'hidden'});
        await page.getByText('Wstępna wycena (bez pomiaru)',{exact:true}).click();
        await selected();
        await openCommercial();
        const field=label=>page.locator('.quote-offer-field').filter({has:page.getByText(label,{exact:true})}).locator('input,textarea');
        for(const [label,value] of [
          ['Nazwa wersji oferty','DEMO ustawienia'],['Rabat kwotowy','25'],['Rabat kwotowy','0'],['Rabat %','3'],['Ważność oferty','10 dni'],
          ['Termin realizacji','12 tygodni'],['Warunki montażu / transportu','DEMO warunki'],['Notatka dla klienta','DEMO notatka'],
        ]){
          const control=field(label);
          await control.fill(value);
          await control.blur();
          await selected();
        }
        await page.locator('[data-action="tab"][data-tab="czynnosci"]').click();
        await idle(page);
        if(!await page.getByRole('button',{name:'Dodaj czynność',exact:true}).isVisible()){
          await page.getByText('Czynności dodane ręcznie',{exact:true}).click();
        }
        await page.getByRole('button',{name:'Dodaj czynność',exact:true}).click();
        await page.locator('.quote-labor-picker__step').filter({hasText:'+'}).first().click();
        await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();
        await selected();
        await page.locator('.quote-labor-picker__footer').waitFor({state:'hidden'});
        await page.locator('[data-action="tab"][data-tab="wycena"]').click();
        await idle(page);
        await page.locator('[data-service-scope]').click();
        await page.locator('.panel-box-backdrop').getByText('Dostawa',{exact:true}).click();
        await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();
        await page.locator('[data-service="delivery"]').waitFor({state:'hidden'});
        await page.getByText('HARMONOGRAM',{exact:true}).first().click();
        await page.locator('[data-helper-hours]').fill('2.5');
        await page.locator('[data-helper-save]').click();
        await selected();
        await page.locator('.quote-selection-launch--scope').click();
        await page.locator('.panel-box-backdrop').getByText('Fronty',{exact:true}).click();
        await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();
        await selected();
        const after=await image(phone);
        const saved=draft(after);
        assert.equal(saved.investorId,ids[0]);
        assert.equal(saved.helperHours,2.5);
        assert.equal(saved.services.delivery,false);
        assert.equal(saved.selection.materialScope.includeFronts,false);
        assert.deepEqual(saved.selection.selectedRooms,[room2]);
        assert.equal(saved.rateSelections.length,1);
        assert.equal(saved.rateSelections[0].qty,1);
        assert.deepEqual(saved.commercial,{
          versionName:'DEMO ustawienia',preliminary:true,billBreaks:false,
          discountPercent:3,discountAmount:0,offerValidity:'10 dni',leadTime:'12 tygodni',
          deliveryTerms:'DEMO warunki',customerNote:'DEMO notatka',
        });
        protectedRows(before,after,['fc_quote_offer_drafts_v1','fc_ui_v1']);
        assert.deepEqual(after.queue,before.queue);
        assert.deepEqual((await getDoc(head(pid))).data(),remoteBefore);
        assert.deepEqual(rows(after,'fc_quote_snapshots_v1').find(row=>row.id===accepted.id),accepted);
        await assert.rejects(page.evaluate(()=>{
          const fc=window.FC;
          const key=fc.quoteOfferStore.DRAFT_KEY;
          return fc.applicationWrite.offerDraft(()=>{
            const values=fc.storage.getJSON(key,[]);
            values[0].investorId='foreign-owner';
            return fc.storage.setJSON(key,values);
          });
        }),/LF_APPLICATION_SCOPE_REFUSED/);
        assert.deepEqual(await image(phone),after);
        await restartWithTrace(restart);
        assert.deepEqual(draft(await image(phone)),saved);
        await openQuote(phone.page);
        assert.deepEqual(rows(await image(phone),'fc_quote_snapshots_v1').find(row=>row.id===accepted.id),accepted);
        await list(phone.page);
      });
    });

    await t.test('room operations preserve history and publish only confirmed changes after relogin', async sub => {
      await evidence(sub,'rooms',phone,async restartWithTrace=>{
        const {page}=phone;
        const project=record=>rows(record,'fc_projects_v1').find(row=>row.id===pid);
        const history=record=>rows(record,'fc_quote_snapshots_v1').find(row=>row.project.id===pid&&row.meta.acceptedAt>0);
        if(!history(await image(phone))){
          await openQuote(page);
          await page.locator('[data-action="wycena-generate"]').click();await confirmQuoteSources(page);
          const generated=page.locator('[data-quote-history-id]').first();
          await generated.waitFor();
          const offerId=await generated.getAttribute('data-quote-history-id');
          await openInvestor(page,ids[0]);
          assert.equal(await page.evaluate(id=>window.FC.applicationWrite.project(()=>{
            const fc=window.FC;
            return fc.projectStatusSync.commitAcceptedSnapshot(fc.quoteSnapshotStore.getById(id),'zaakceptowany',{refreshUi:false}).ok;
          }),offerId),true);
          await computer.page.waitForFunction(id=>Number(window.FC.quoteSnapshotStore.getById(id)?.meta.acceptedAt)>0,offerId);
          await confirmAck(phone,computer,pid,record=>!!history(record));
        }else await openInvestor(page,ids[0]);

        const baseline=await image(phone),oldProject=project(baseline);
        const panel=p=>p.locator('.panel-box-backdrop').filter({has:p.locator('.room-registry-modal')});
        const manage=async p=>{
          await p.locator('[data-investor-action="manage-rooms"]').click();
          return panel(p);
        };
        const roomRow=(p,name)=>panel(p).locator('.room-registry-manage-row').filter({has:p.locator('input[value="'+name+'"]')});
        const saveRooms=async p=>{
          await panel(p).getByRole('button',{name:'Zapisz',exact:true}).click();
          await p.locator('.confirm-box .is-success').click();
        };
        async function receiveRoom(id,name){
          await computer.page.waitForFunction(({pid,id,name})=>{
            const def=window.FC.projectStore.getById(pid)?.projectData.meta.roomDefs[id];
            return name===null?!def:def?.name===name;
          },{pid,id,name});
          await confirmAck(phone,computer,pid,record=>{
            const def=project(record).projectData.meta.roomDefs[id];
            return name===null?!def:def?.name===name;
          });
        }

        await page.locator('[data-investor-action="add-room"]').click();
        await panel(page).locator('input').fill('Kuchnia DEMO');
        await panel(page).getByRole('button',{name:'Dodaj',exact:true}).click();
        await panel(page).waitFor({state:'hidden'});
        const added=Object.values(project(await image(phone)).projectData.meta.roomDefs).find(def=>def.name==='Kuchnia DEMO');
        assert.ok(added);
        await receiveRoom(added.id,'Kuchnia DEMO');

        await manage(page);
        const input=roomRow(page,'Kuchnia DEMO').locator('input');
        await input.fill('Kuchnia');
        const beforeAbort=await image(phone);
        await abortNextWrite(phone);
        await saveRooms(page);
        await dismissFailure(page,'LF_IDB_ABORTED');
        assert.equal(await input.inputValue(),'Kuchnia','Abort keeps the edited form available');
        assert.deepEqual(await image(phone),beforeAbort);
        await saveRooms(page);
        await panel(page).waitFor({state:'hidden'});
        await receiveRoom(added.id,'Kuchnia');

        await restartWithTrace(restart);
        const reopened=phone.page;
        await openInvestor(reopened,ids[0]);
        await manage(reopened);
        const remove=roomRow(reopened,'Kuchnia').getByRole('button',{name:'Usuń',exact:true});
        const beforeDelete=await image(phone);
        await remove.click();
        await reopened.locator('.confirm-box .is-neutral').click();
        assert.ok(await remove.isVisible());
        assert.deepEqual(await image(phone),beforeDelete);
        await remove.click();
        await reopened.locator('.confirm-box .is-danger').click();
        await saveRooms(reopened);
        await panel(reopened).waitFor({state:'hidden'});
        const after=await image(phone);
        assert.equal(project(after).projectData[added.id],undefined);
        assert.equal(project(after).meta.pendingDomainOperation,undefined);
        assert.deepEqual(project(after).projectData[room],oldProject.projectData[room]);
        assert.deepEqual(project(after).projectData[room2],oldProject.projectData[room2]);
        assert.deepEqual(rows(after,'fc_projects_v1').filter(row=>row.id!==pid),rows(baseline,'fc_projects_v1').filter(row=>row.id!==pid));
        assert.equal(after.state.rows.fc_quote_snapshots_v1,baseline.state.rows.fc_quote_snapshots_v1);
        assert.ok(history(after));
        await receiveRoom(added.id,null);
        assert.deepEqual(history(await image(computer)),history(baseline));

        // The standalone panel deletes immediately after its confirmation.
        // Use a room actually referenced by the accepted historical offer.
        const archived=history(after);
        const standaloneRoom=archived.scope.selectedRooms.find(id=>project(after).projectData.meta.roomDefs[id]);
        assert.ok(standaloneRoom,'The standalone target must be linked to the accepted offer');
        await reopened.evaluate(()=>{void window.FC.roomRegistry.openRemoveRoomModal();});
        const standalone=panel(reopened).filter({has:reopened.locator('.room-registry-remove-list')});
        const selection=standalone.locator('[data-room-id="'+standaloneRoom+'"]');
        await selection.click();
        const removeStandalone=async()=>{
          await standalone.getByRole('button',{name:'Usuń',exact:true}).click();
          await reopened.locator('.confirm-box .is-danger').click();
        };
        const beforeStandalone=await image(phone),remoteBefore=(await getDoc(head(pid))).data();
        await abortNextWrite(phone);
        await removeStandalone();
        await dismissFailure(reopened,'LF_IDB_ABORTED');
        assert.ok(await standalone.isVisible(),'The failed standalone write leaves its panel open');
        assert.ok(await selection.evaluate(button=>button.classList.contains('is-selected')));
        assert.deepEqual(await image(phone),beforeStandalone);
        assert.deepEqual((await getDoc(head(pid))).data(),remoteBefore);
        await removeStandalone();
        await standalone.waitFor({state:'hidden'});
        const checkStandalone=record=>{
          const saved=project(record);
          assert.equal(saved.projectData[standaloneRoom],undefined);
          assert.equal(saved.projectData.meta.roomDefs[standaloneRoom],undefined);
          assert.equal(saved.meta.pendingDomainOperation,undefined);
          assert.ok(!rows(record,'fc_investors_v1').find(row=>row.id===saved.investorId).rooms.some(room=>room.id===standaloneRoom));
          assert.equal(record.state.rows.fc_quote_snapshots_v1,beforeStandalone.state.rows.fc_quote_snapshots_v1);
        };
        const committed=await image(phone);
        checkStandalone(committed);
        const operations=committed.queue.filter(op=>!beforeStandalone.queue.some(old=>old.key===op.key));
        assert.equal(operations.length,1);
        assert.equal(operations[0].scope,pid);
        await receiveRoom(standaloneRoom,null);
        assert.equal((await getDoc(head(pid))).data().generation,remoteBefore.generation+1);
        assert.deepEqual(history(await image(computer)),archived);
        await restartWithTrace(restart);
        await openInvestor(phone.page,ids[0]);
        const reopenedImage=await image(phone);
        checkStandalone(reopenedImage);
        assert.ok(reopenedImage.queue.some(op=>op.key===operations[0].key&&op.phase==='verified'));
      });
    });
  } });
});

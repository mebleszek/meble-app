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
  const home = page.locator('#openFurnitureProjectsBtn');
  if (await home.isVisible()) {
    await home.click();
    await idle(page);
    await page.locator('#modeHubRoot [data-action="open-investors-list"]').click();
  } else if (await page.locator('#sessionCancel').isVisible()) {
    await page.locator('#sessionCancel').click();
  }
  await page.locator('#investorsListView').waitFor();
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
      for (const kind of ['auto', 'project']) {
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

test('E1 signed DEMO synchronized UI', async t => {
  await runNormalApplication(t, { deployment: true, runUi: async ({ phone, computer, pid, ids, room, uid, ownerClient, restart }) => {
    const head = scope => doc(ownerClient, 'users', uid, 'localFirstProjects', scope);
    async function confirmAck(writer, reader, projectId, predicate) {
      const remote = await getDoc(head(projectId));
      assert.ok(remote.exists(), 'Project must have a server head');
      const written = await image(writer);
      assert.ok(written.queue.some(op => op.scope === projectId && op.phase === 'verified'
        && op.receipt?.currentRevisionId === remote.data().currentRevisionId), 'Outbox requires a verified ACK for the server revision');
      assert.ok(predicate(await image(reader)), 'Second profile must contain the same business record in IndexedDB');
    }

    await t.test('quote settings and Wyceń commit a history record, then restart and receive', async sub => {
      await evidence(sub, 'quote', phone, async restartWithTrace => {
        const { page } = phone;
        await openInvestor(page, ids[0]);
        await page.locator('.investor-room-quick-btn[data-room="' + room + '"]').click();
        await idle(page);
        await page.locator('[data-action="tab"][data-tab="wycena"]').click();
        await idle(page);
        const calculate = page.locator('[data-action="wycena-generate"]');
        await calculate.waitFor();
        const before = await image(phone);
        const settings = page.locator('.quote-offer-accordion__trigger');
        if (!await page.locator('[data-bill-breaks]').isVisible()) await settings.click();
        await page.getByText('Naliczaj klientowi koszt przerw', { exact: true }).click();
        await idle(page);
        const settingsSaved = rows(await image(phone), 'fc_quote_offer_drafts_v1').some(row => row.projectId === pid && row.commercial.billBreaks === false);
        if (!settingsSaved) {
          const code = await page.evaluate(() => window.FC.storage.getLastWriteError()?.error?.code);
          assert.deepEqual((await image(phone)).queue, before.queue);
          sub.diagnostic('RED: billBreaks did not reach IndexedDB (' + code + ')');
          const refusal = page.locator('.info-box .is-success');
          if (await refusal.isVisible()) await refusal.click();
        }
        await calculate.click();
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
        sub.diagnostic('PASS: Wyceń, durable history after restart, second profile and verified ACK');
        assert.ok(settingsSaved, 'The offer settings did not reach IndexedDB');
      });
    });

    await t.test('new investor save, ACK and reopen after restart', async sub => {
      await evidence(sub, 'investor', computer, async restartWithTrace => {
        const { page } = computer;
        await list(page);
        await page.locator('#investorsListView [data-action="create-investor"]').click();
        const before = await image(computer);
        const name = 'DEMO synchronized investor';
        for (const [id, value] of Object.entries({
          invName: name, invPhone: '123456789', invCity: 'Test City',
          invEmail: 'sync-ui@example.invalid', invAddress: 'Synthetic address',
          invTransportDistanceKm: '12', invTransportDurationMin: '30', invCarryingFloorNumber: '0',
        })) await page.locator('#' + id).fill(value);
        await page.locator('#invSourceLaunch button').click();
        await page.locator('.rozrys-choice-modal .rozrys-choice-option:not([disabled])').nth(1).click();
        await page.locator('#investorActionBar [data-investor-action="save"]').click();
        await page.locator('.confirm-box .is-success').click();
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
  } });
});

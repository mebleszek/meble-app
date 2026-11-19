import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { canonical, digest, json } from '../../sync/local-first-values.mjs';
import { startBrowser } from '../helpers/chromium-runtime.js';
import { injection } from '../trusted-session-browser-smoke.js';
import shellManifest from '../offline-assets.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const name = 'meble-lf-test-playwright-ui';
const uid = 'synthetic-phone-owner';
const publicShell = new Set(shellManifest.manifest().files.map(file => '/' + file.path));

async function signedRelease(origin) {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKeySpki = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey));
  const decision = {
    activationId: 'synthetic-playwright', database: '(default)',
    domain: 'MEBLE_APPLICATION_DEPLOYMENT_V1', globalDomains: 14,
    migrationApproved: true, origin: origin + '/', ownerUid: uid,
    profile: 'business-project-v1', projectId: 'demo-meble-app', protocol: 2,
    rulesApproved: true, rulesSha256: 'a'.repeat(64), sourcePreserved: true,
  };
  const signature = await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode(canonical(decision)));
  return {
    name, localOnly: true,
    trustedKeySha256: Buffer.from(await crypto.subtle.digest('SHA-256', publicKeySpki)).toString('hex'),
    envelope: { decision, publicKeySpki: [...publicKeySpki], signature: [...new Uint8Array(signature)] },
  };
}

async function withApp(scenario) {
  const dir = await mkdtemp(path.join(tmpdir(), 'meble-playwright-ui-'));
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === '/fixture-host.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>DEMO bootstrap</title>');
      return;
    }
    if (!publicShell.has(pathname) && !/^\/(?:index\.html|offline-[\w-]+\.js|(?:assets|css|js|sync)\/[\w./-]+)$/.test(pathname)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(root, '.' + pathname);
    try {
      if (!file.startsWith(root)) throw Error('Path outside fixture');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(bytes);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
  let device, context, page, recording = false, failed = false;
  const profileDir = path.join(dir, 'profile');
  async function closeBrowser() {
    if (recording) {
      await context.tracing.stop();
      recording = false;
    }
    if (!device) return;
    const cdp = await device.browser.newBrowserCDPSession();
    await cdp.send('Browser.close');
    assert.equal((await device.owner.exited).code, 0);
    await device.owner.close();
    device = null;
  }
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const release = await signedRelease(origin);
    const external = [];
    async function open() {

      const owner = await startBrowser({ profileDir });
      device = { owner };
      const browser = await chromium.connectOverCDP(owner.endpoint);
      device.browser = browser;
      context = browser.contexts()[0];
      page = context.pages()[0] || await context.newPage();
      for (const other of context.pages()) if (other !== page) await other.close();
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        external.push(new URL(route.request().url()).origin);
        return route.abort();
      });
      await context.addInitScript({ content: injection });
      await context.addInitScript(release => {
        const fc = window.FC ||= {};
        Object.defineProperty(fc, 'applicationStartup', {
          configurable: true,
          set(value) {
            Object.defineProperty(fc, 'applicationStartup', { value, writable: true, configurable: true });
            release.envelope.publicKeySpki = new Uint8Array(release.envelope.publicKeySpki);
            release.envelope.signature = new Uint8Array(release.envelope.signature);
            window.testReleaseReady = value.configureReleaseEmulator(release);
          },
        });
      }, release);
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      recording = true;
      await page.goto(origin + '/fixture-host.html');
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.register('/offline-worker.js');
        if (!registration.active) {
          const worker = registration.installing || registration.waiting;
          if (!worker) throw Error('FIXTURE_WORKER_MISSING');
          await new Promise((resolve, reject) => {
            const inspect = () => {
              if (worker.state === 'redundant') { worker.removeEventListener('statechange', inspect); reject(Error('FIXTURE_WORKER_INSTALL_REFUSED')); }
              else if (['installed','activating','activated'].includes(worker.state)) { worker.removeEventListener('statechange', inspect); resolve(); }
            };
            worker.addEventListener('statechange', inspect); inspect();
          });
        }
        const ready = await navigator.serviceWorker.ready;
        if (!ready.active) throw Error('FIXTURE_WORKER_NOT_ACTIVE');
      });
      await page.goto(origin + '/index.html');
      await page.evaluate(() => window.testReleaseReady);
      await page.locator('#auth-google').click();
      await page.waitForFunction(() => ['profile-pending', 'error'].includes(document.body.dataset.authState) || document.body.dataset.businessState === 'ready');
      assert.notEqual(await page.locator('body').getAttribute('data-auth-state'), 'error', await page.locator('#auth-error').textContent());
      if (await page.locator('#auth-profile-admission').isVisible()) {
        await page.locator('#auth-profile-backup').check();
        await page.locator('#auth-profile-owner').check();
        await page.locator('#auth-profile-confirm').click();
      }
      await page.waitForFunction(() => document.body.dataset.businessState === 'ready'
        && window.FC.applicationStartup.inspect().state === 'local-only');
      return page;
    }
    await open();
    await scenario(page, async () => {
      // Keep the pre-restart trace until the whole scenario succeeds.
      await context.tracing.stop({ path: path.join(dir, 'before-restart.zip') });
      recording = false;
      await closeBrowser();
      return open();
    });
    assert.deepEqual(external, [], 'The demo must stay on loopback');
  } catch (error) {
    failed = true;
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 5000 }).catch(e => console.error(e.message));
    }
    if (recording) {
      await context.tracing.stop({ path: path.join(dir, 'failure.zip') }).catch(e => console.error(e.message));
      recording = false;
    }
    console.error('Failure artifacts:', dir);
    throw error;
  } finally {
    try {
      if (device?.browser) await closeBrowser();
    } finally {
      await device?.owner.close();
      await new Promise(resolve => server.close(resolve));
      if (!failed) await rm(dir, { recursive: true, force: true });
    }
  }
}

async function readImage(page) {
  const { image, outbox } = await page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['control', 'outbox'], 'readonly');
      const state = tx.objectStore('control').get('application');
      const queue = tx.objectStore('outbox').getAll();
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.oncomplete = () => { db.close(); resolve({ image: state.result, outbox: queue.result }); };
    };
  }), name);
  assert.equal(image.hash, await digest(json(image.rows)));
  assert.deepEqual(outbox, []);
  return image.rows;
}

async function idle(page) {
  await page.waitForFunction(() => !window.FC.applicationStartup.inspect().transactionPending);
}

async function addInvestor(page, name) {
  await page.locator('#openFurnitureProjectsBtn').click();
  await idle(page);
  await page.locator('#modeHubRoot [data-action="new-investor"]').click();
  for (const [id, value] of Object.entries({
    invName: name, invPhone: '123456789', invCity: 'Test City',
    invEmail: 'local@example.invalid', invAddress: 'Synthetic address',
    invTransportDistanceKm: '12', invTransportDurationMin: '30', invCarryingFloorNumber: '0',
  })) await page.locator('#' + id).fill(value);
  await page.locator('#invSourceLaunch button').click();
  await page.locator('.rozrys-choice-modal .rozrys-choice-option:not([disabled])').nth(1).click();
  await page.locator('#investorActionBar [data-investor-action="save"]').click();
  await page.locator('.confirm-box .is-success').click();
  await page.locator('[data-investor-action="add-room"]').waitFor();
  await idle(page);
  const rows = await readImage(page);
  const investor = JSON.parse(rows.fc_investors_v1).find(row => row.name === name);
  assert.ok(investor);
  assert.equal(investor.transport.durationMin, '30');
  const project = JSON.parse(rows.fc_projects_v1).find(row => row.investorId === investor.id);
  assert.ok(project);
  return { investor, project };
}

async function reopenInvestor(page, investor) {
  await page.locator('#sessionCancel').click();
  await idle(page);
  await page.locator('[data-action="open-investor"][data-inv-id="' + investor.id + '"]').click();
  await page.locator('[data-investor-action="add-room"]').waitFor();
  assert.equal(await page.locator('#invName').textContent(), investor.name);
  await idle(page);
}

test('investor form saves to IndexedDB and survives Chromium restart', () => withApp(async (page, restart) => {
  const { investor, project } = await addInvestor(page, 'DEMO Playwright Investor');
  page = await restart();
  await reopenInvestor(page, investor);
  const rows = await readImage(page);
  assert.deepEqual(JSON.parse(rows.fc_investors_v1).find(row => row.id === investor.id), investor);
  assert.deepEqual(JSON.parse(rows.fc_projects_v1).find(row => row.id === project.id), project);
}));

test('cabinet and fronts survive confirmed project save and Chromium restart', () => withApp(async (page, restart) => {
  const { investor, project } = await addInvestor(page, 'DEMO Playwright Cabinet');
  await page.locator('[data-investor-action="add-room"]').click();
  await page.locator('.panel-box input[placeholder]').fill('DEMO Kitchen');
  await page.locator('.panel-box .btn-success').click();
  await idle(page);
  await page.locator('.investor-room-quick-btn[data-action="open-room"][data-room^="room_"]').click();
  await idle(page);
  await page.locator('#floatingAdd').click();
  await page.locator('#cabinetTypeChoices .choice-tile').first().click();
  for (const [id, value] of Object.entries({ cmWidth: '66', cmHeight: '82', cmDepth: '50' })) {
    await page.locator('#' + id).fill(value);
  }
  await page.locator('#cabinetModalSave').click();
  await page.locator('#cabinetModal').waitFor({ state: 'hidden' });
  const draft = await readImage(page);
  assert.equal(JSON.parse(draft.fc_edit_session_v1).active, true);
  await page.locator('#sessionSave').click();
  await page.waitForFunction(() => !window.FC.session.active && !window.FC.applicationStartup.inspect().transactionPending);
  const saved = await readImage(page);
  assert.equal(saved.fc_edit_session_v1, null);
  const record = JSON.parse(saved.fc_projects_v1).find(row => row.id === project.id);
  const roomId = record.roomKeys.find(key => record.projectData[key]?.cabinets.length === 1);
  assert.ok(roomId);
  const room = record.projectData[roomId];
  const [cabinet] = room.cabinets;
  assert.deepEqual([cabinet.width, cabinet.height, cabinet.depth], [66, 82, 50]);
  assert.ok(room.fronts.some(front => front.cabId === cabinet.id));
  page = await restart();
  await reopenInvestor(page, investor);
  await page.locator('.investor-room-quick-btn[data-action="open-room"][data-room="' + roomId + '"]').click();
  await page.locator('#cab-' + cabinet.id).waitFor();
  await idle(page);
  const reopened = await readImage(page);
  assert.deepEqual(JSON.parse(reopened.fc_projects_v1).find(row => row.id === project.id), record);
}));

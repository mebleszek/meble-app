# LOCAL-FIRST application end-to-end — 30.10.2026

## Revision and scope

Product branch: `integration/android-local-first-20261030`. Continued input
`f3ae3374dfa581ea93d4bffa80f6d338070ff898`, reconciled with released main
`6588cac972fc1ebbfe57f80ad55b4d22620a7647` through merge
`6db5164c433d1cded5b3cd47cb9f79895b2d1be0`. No force push or release merge.

PR #87 is MERGED, head `c220ac506ca345077f13eec26a695d8e6d6f42ca`.
GitHub read-only evidence: run [41038339355](https://github.com/mebleszek/meble-app/actions/runs/41038339355)
completed successfully, including safety, Preflight, Firebase current, CLOUD
historical, auto-merge and exact-merge Pages verification. These are documentation
release proofs, not CI evidence for this product branch. Compact documentation
and complete archives were retained; no archive was rewritten.

## Implemented application path

- `application-authority.mjs` explicitly installs an emulator-only application
  image in the existing LOCAL-FIRST IDB control store. It is not the backup archive.
  Current repositories read this image; original covered localStorage bytes remain
  untouched recovery sources. Approved Save commits the image, replica and outbox
  atomically, with a version CAS and hashes. No local/cloud success before commit.
- Writes of covered keys outside an asynchronous transaction refuse. Concurrent
  transactions, source changes/old-tab storage events and clear() refuse. The
  controlled installer requires loopback, the exact demo connection, test database,
  matching UID and valid existing local access. A production-name initialization
  refuses with `LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN`.
- Existing Save/Cancel and clean Exit have optional bindings. Save notices wait
  for local durability. Cancel keeps its real confirmation and native proof/owner
  checks; rollback must match the approved local replica and may not add an outbox
  operation. Clean Exit first confirms durable session closure. Failed transactions
  restore the previous image, RAM/session/UI state instead of acknowledging success.
- Draft transactions retain session proof and local draft bytes without approving
  their publication. Explicit adapter resume uses the existing session validator;
  it does not create a missing snapshot, repair proof, retry begin or replay WRITE.
  A corrupt/missing proof remains blocked. Startup hydrates the IDB image and shows
  the verified investor; remembered UI alone does not grant a new room edit.
- `application-replication.mjs` composes the existing channels and coordinator.
  Verified remote content is projected into the application image in the same IDB
  transaction as the replica CAS. Active RAM/session, dirty local data/outbox,
  wrong owner, conflicting aliases and stale application version prevent apply.
  Rendering follows commit and the unchanged-RAM witness. Company transport.apiKey
  remains local and is never included in the network model.
- Head listeners and online/local-commit signals wake synchronization. A confirmed
  commit joining a cycle in progress now requests another outbox scan; otherwise a
  queued operation could remain unpublished after the last listener event. This
  is queue scheduling, not retrying an uncertain WRITE. Uncertain operations still
  resolve from an independent server read and the durable expected revision.
- Owner-scoped project discovery registers channels only after the same independent
  chunk/hash/dependency validation. A fresh receiver needs no preconfigured project
  inventory. Its emulator-only Rules fragment permits owner-approved head queries
  bounded to 100 results per request; pagination reads the full inventory. Unbounded
  queries, foreign UID, deletes, and revision/chunk/editor listing remain denied.
  No deployed/production Rules or grant was changed.
- Android fixes from the input commit remain. A newly reproduced defect was in
  project-bootstrap: rendering called project.save() even when normalization made
  no content change. The observed difference on investor switch was only
  `projects[1].updatedAt`; the captured stack proved refresh -> normalize -> save.
  Normalization now fills RAM defaults without implicitly committing a revision.

## Supported data and explicit refusals

The single existing CLOUD-3 contract still defines all 14 globals: materials,
hardware, manufacturers, suppliers, categories, types, technicalParams,
hardwareSettings, labor, workshopServices, stock, programDefaults, company and
businessCosts. Primary sources and historical aliases use that contract; a
conflicting alias refuses without erasing either source. No second data register.

`business-project-v1` carries the exact selected investor, full owned project
record and its unambiguously owned frozen offers. It retains IDs, values, unknown
allowed fields, project-local PCV and layouts. It reuses existing geometry,
relationship, PCV and dependency validators, immutable chunks, revision hashes,
CAS and editor epochs. No synthetic eligibility flags are stamped onto real
records. Historical `native-project-v1` pilot validation remains unchanged.

Unsupported structures return `LF_PROJECT_SCHEMA_BLOCKED` with the original
validator reason. In particular, this does not claim support for constructions
outside the existing room-validator coverage (standard cabinets/drawers and
supported set layouts). A whole dependent project refuses, rather than silently
omitting its cabinets or treating a partial project as complete.

Nonempty fc_edge_v1, fc_material_part_options_v1, fc_rozrys_grain_state_v1,
fc_rozrys_overrides_v1 and unresolved quote drafts remain protected and block the
dependent project. Unowned history, pending domain operations, incomplete room
ownership and missing catalog dependencies refuse. Issue #47 stays deferred.
Old RAW, backups, source keys and previously protected versions are not deleted.

## Targeted checks and mandatory CI

No full local Preflight or full Firebase regression suite was run. Development
failures were diagnosed and fixed within the new E2E, including inconsistent
fixture aliases, the queue wake-up race and implicit normalization Save. Final targeted E2E: **1/1 PASS**, 0 skipped, on Node 22.23.3/native Chromium;
74.06 s scenario / 76.39 s TAP lifetime. The receiver started with only its global
channel; both project scopes were discovered after publication. It is not inherited
from an earlier CI SHA.

| Check | Evidence / CI owner |
| --- | --- |
| application-e2e.test.mjs | Real native Chromium profiles, real IDB, pinned Web SDK and Auth/Firestore emulators. Full index/bootstrap/repositories, original Save and Cancel controls. UI Google popup/admission is an explicit fixture; transport Auth and Firestore are real emulator SDKs, not mocked network transports. |
| Round trip | Phone -> publication -> previously empty receiver -> computer edit -> phone; automatic commit wake, head-listener receive and online wake, without manual synchronize control. |
| Actual data | Two independently owned investors/projects, nonempty cabinet, real room creation, 14 domains, stock updates, frozen offer, exact unknown field, identical cut-list and labor result 21.375. |
| Offline / editor | Genuine SDK disableNetwork, locally durable edit, online reconciliation, second editor refusal, confirmed handover and stale editor refusal. |
| Draft / crash | Real SIGKILL and same-profile IDB/session recovery; explicit Save after draft resume. Another real SIGKILL after a successful server publication loses its ACK; recovery resolves with independent READ and exactly one WRITE. |
| RAM / Cancel / Exit | A remote catalog cannot replace an active local draft; original cancellation confirmation, unchanged approved RAW/outbox, clean Exit without logout, logout preserving IDB. |
| Security | Foreign UID denied; unbounded head inventory denied; old-writer fence refuses; no automatic LIVE startup. |
| application-authority-store-smoke.js | Real IDB image+outbox atomicity, quota abort rollback, application CAS, duplicate payload binding, SIGKILL persistence and production-name migration refusal. |
| business-project-contract-smoke.js | Whole owned payload/hashes/frozen fields, invalid owner/geometry/references, pending operation, ambiguous RAW, secret exclusion and conflicting alias preservation. |
| application-session-resume-smoke.js | Valid durable proof resume without writes; missing/corrupt proof or replacement of active session refused. |
| project-bootstrap-readonly-smoke.js | Both normalized and missing-default RAM paths perform no implicit Save or stored RAW/timestamp change. |
| empty-installation-browser-smoke.js | Native empty startup, actual investor/room Save, two-investor isolation, logout/reauthentication and document restart. |
| Restored-proof baseline | Existing project-session-restored-proof-smoke: **8/8 PASS**, including missing proof refusal, lost ACK attribution and safe Cancel cleanup. |
| Offline/load order/syntax/diff | Exact generated public asset hashes, coherent offline-shell contract, ordered classic script registration, syntax and scoped diff checks. |

Mandatory routing: `.github/workflows/preflight-js.yml` -> firebase-current ->
`tools/cloud-ci-emulators.js --context=current` -> cloud-sync-global.test.mjs ->
separate top-level application E2E. Existing LOCAL-FIRST 01–08 and all CLOUD-SYNC-1
assertions remain. New *-smoke.js files are automatically discovered by mandatory
Preflight; routing itself has a regression. Historical checkout
`306f90a4cfd8bcb4277aa8b4d140e911493ddd60` and its 425 pins are unchanged.
No workflow, dependency pins, Chromium launcher, business calculator or backup
archive implementation changed. Final changed/new JS/MJS syntax: **21/21 PASS** on Node 22.23.3. New store/contract/resume/readiness/RAM-normalization smoke controls and manifest/load order passed. The targeted empty-installation Chromium check passed on the available host Node 24; the real SDK E2E and final technical controls used pinned Node 22. Full CI and physical Android remain pending.

## Remaining activation conditions, separated by cause

**Code/integration boundary:** this is a controlled application composition, not
an automatic production cutover. All covered synchronous UI callbacks must either
enter its asynchronous transaction boundary or refuse. Their wholesale production
conversion/initialization and offline creation of a brand-new server-unknown
project are not declared complete. Existing, durably owned editor scopes can save
offline and resume. Unsupported construction contracts and ambiguous RAW do not
become supported because transport succeeds. These are concrete remaining code
boundaries, not missing Firebase credentials and not a request for another audit.

**Migration/environment proof:** production activation must demonstrate exclusion
of old/incompatible writers and a lossless versioned source/image handoff. Storage
event detection does not prove that every old device stopped writing. No such
proof or owner-data migration was fabricated. Normal application startup remains
unchanged and cannot activate this composition by a flag.

**LIVE/operator:** existing C/D/E code, executeProduction() refusal, six signed
decisions, private journal/fence/recovery and STOP protocol remain the basis.
No new operator or production launcher. Private host and independent STOP after
loss of the entire primary host still require actual separate availability,
journal/fence recovery, identities and permissions. Original private rollback is
635 B / SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91;
no copy/template was fetched, reconstructed or committed. Historical billingEnabled:false
from the owner's 30.10 evidence was not re-audited. Fresh Rules/read-back,
effective IAM/publishers/exclusivity, Spark/limits and named STOP operator belong
to the separately authorized execution window, not this emulator task.

## Delivery status and next action

Controlled emulator integration is **CODE_READY** for independent review; the entire
production application cutover is explicitly INTEGRATION_PARTIAL. CI_PENDING /
PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Next: review this branch's exact
HEAD/BASE and the mandatory coverage, then obtain a separate approval for one CI
attempt. No PR, Ready/Draft change, workflow invocation, release merge, Pages or
Firebase production operation was performed.

## Jedna aplikacja — normalny startup 01.11.2026

Branch: `integration/one-app-local-first-20261101`. Exact requested BASE:
`864250c28bd52969859d3ef579cc3d1c98c3e796`, from
`docs/free-first-sync-priority-20261101`. Its FREE-FIRST decisions are preserved.
Read-only GitHub verification confirmed PR #95 merged at
`6ec80ef026eeacfdd8bc9dadf44972c342305776`, CI 41287514243 and Pages
41287757034 PASS; those are release evidence for #95, not for this package.
One new delivery commit contains this section; its full HEAD is in the handoff.

### Implemented path and authority

Normal `main-login` now calls the application bootstrap before business scripts
and after admission. On an explicitly configured loopback/demo installation the
existing application runs with browser-owned SDK connections and coordinator,
not a Node transport proxy. The public deployment remains inert and LIVE_BLOCKED.
No new UI or synchronize button, dependencies, workflow, operator or Rules.

Before legacy initializers execute, the boot adapter reads a lossless source
image or restores the verified IDB image. A versioned source receipt binds UID,
database, device and instance; missing receipt/image, different owner or source
hash refuses. Web Lock, exact SW single-window acknowledgement and source checks
refuse concurrent/stale clients. Original source keys, backups and unresolved RAW
are retained, with no automatic normalization or clearing. This is demonstrated
in disposable emulator profiles; it is not proof that every production old writer
is excluded. Production cutover remains refused.

Covered Save/Cancel, investor/room forms, price save/delete, supplier/dictionary
forms, company/default/cost settings, stock and offer-generation entry points await
the existing atomic IDB image+outbox transaction. Failed commits restore RAM,
session/editor state and form view; success notices and dialog results wait for
confirmed durability. A whole-store archive restore refuses before changing any
key or journal; export/retained backups remain available. Other covered writes
outside this boundary refuse instead of becoming a second localStorage authority.

Explicit global edits mirror the exact value to the aliases already declared in
CLOUD-3. Conflicting historical aliases or two different writes refuse; the helper
does not repair source RAW or infer ownership. Project/investor/offer transfer
uses the existing `business-project-v1` validation, immutable chunks, hashes,
pinned complete catalog revision and CAS. Unknown allowed fields remain exact;
unresolved grain/rotation/edge/drafts block the dependent project. No partial
project is published as complete and Issue #47 is not changed.

Real Google SDK contexts use the authenticated owner with a distinct in-memory
reader. Only explicit trusted local admission permits the SDK's own persistent
writer Auth; application code never exports or persists provider tokens. Offline
cold startup uses local proof + IDB without creating Google Auth. Online return
obtains a fresh cloud access proof. Confirmed denial invokes the existing local
revocation path; network uncertainty does not revoke local trust. Logout seals
writes and signs out the independent SDK contexts while retaining IDB/outbox.

A confirmed editor can save offline and resume the queue. Handover never uses a
timeout as permission to take over. A clean offline Exit keeps remote ownership;
a subsequent verified reconnect can release it only from the clean investor list.
A busy marker covers local commit **and** confirmed handover, so the next navigation
cannot race the remote release.

### Bugs found while integrating, and regression coverage

- Initial discovery could receive its only signal before startup was ready.
  `notify()` now wakes discovery too, including a pending wake during settling.
- Legacy boot could normalize source catalogs before the authority existed.
  Pre-business hydration/read-only source protection now precedes these scripts.
- Initial metadata seeding and remote application could race their IDB CAS.
  Seeding uses the same existing store exclusion boundary.
- Local checkpoint completion was earlier than asynchronous handover. The
  application operation remains reserved through its full completion; dialog
  results wait until reservation release.
- Cloud leases can be revoked on offline/background events while trusted local
  work continues. Reconnect renews the SDK proof, replaces channels and retires
  the previous reader; it does not republish uncertain operations.
- Reconnect assertions first await a new, authorized SDK connection generation
  and completed runtime binding, then check independent data delivery. This
  separates real asynchronous prerequisites without extending either deadline.
- A test-only network setup briefly exposed online before its other CDP layer
  allowed transport. Cold-start emulation now uses one target network controller,
  with actual offline established before the first script. No navigator shim,
  longer timeout, action retry or weakened assertion.

### Actual targeted evidence

Node 22.23.3, native Chromium, real IndexedDB and Firebase Auth/Firestore Emulator
Suite, project `demo-meble-app`. No full local Preflight, full Firebase suite or
GitHub Actions run was invoked.

| Check | Actual result |
| --- | --- |
| Existing actual-application E2E | PASS, 67.51 s. Kept original native Save/Cancel, SIGKILL/durable draft, lost ACK resolved by independent READ and one committed WRITE, foreign UID and CAS/editor/RAW protections. |
| New normal-startup two-profile E2E | PASS, 150.54 s (final exact-value and reconnect-readiness assertions); earlier combined targeted run 2/2 PASS, no skip/cancel/todo. Phone → Firestore → computer → Firestore → phone, real browser-owned SDK/coordinator, two investors, owned kitchen/cabinet/frozen offer, whole-project equality, exact values in all 14 domains, price 47.125 and stock 29, labor 21.375 and identical cut list, native touch Save/room gestures, original Cancel, second editor refusal and handover, same-window offline reconnect, natural browser restart/cold offline recovery without Google login, offline logout with IDB retained. |
| New startup boundary regressions | 8/8 PASS. Public-origin refusal/no unapproved IO, one asynchronous writer, promise completion, required CI routing, lost initial discovery wake, handover reservation, alias integrity and archive-restore refusal before side effects. |
| Real IDB authority store | PASS. Application+outbox atomicity, quota abort rollback, local CAS, duplicate integrity, real SIGKILL persistence and production migration refusal. |
| LOCAL-FIRST activation contract | PASS. Synthetic signatures only: exact artifact/UID/Rules and revocation; a global-only permit cannot open project scope, altered image/absent exclusivity/bad signature refuse before network. No actual production HTTP or owner signing. |
| Business-project / session-resume / readiness | PASS. Owned RAW/frozen fields, unknown fields, local-only company credential, ambiguous RAW refusal, valid durable proof reuse and missing/corrupt proof refusal; old and new suites remain mandatory. |
| Trusted main login | PASS. Desktop idle/bfcache/reauth, trusted offline cold access/logout, real denied grant vs network uncertainty, existing event guards and unsaved RAM. |
| Four affected quote/cache-version regressions | PASS: duplicate-offer guard, generate single flow, orphan edit cleanup, snapshot clean store. Expected versions come from the canonical register; cache checks remain. |
| Offline/versions/load order | PASS: generated manifest equals actual public bytes, shell integrity/no takeover, exact HTML versions and ordered auth/business groups. |
| Syntax / growth / diff | 37/37 changed/new JS/MJS syntax PASS; 35 changed modules checked for growth, 0 blocked; scoped diff clean. |
| Original CLOUD-4 / historical isolation | PASS: original 6797 B, payload SHA 711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3, unchanged document pin and 425 historical sources. Current stale operator packages still refuse as designed. |

The new SDK observer returns the original SDK promises, never changes results,
retries input or waits for an artificial PASS. UI Google popup/admission remains
an explicit fixture; data transport, independent SDK readers, Firestore Rules,
IDB and native input are real emulators/browser mechanisms. The new cold restart
is a confirmed normal browser shutdown; the earlier E2E separately retains genuine
SIGKILL cases. No claim of a physical Android test.

Mandatory routing: Preflight's existing `*-smoke.js` discovery includes
`one-app-startup-smoke.js`; Firebase Current's existing batch-3 entry
`cloud-sync-global.test.mjs` invokes both old application E2E and the new normal
startup case. No prior test was removed. Other current files, seven smoke shards,
three emulator batches and the frozen 425-pin historical job remain unchanged.
The rest of their regression results remain **CI_PENDING** for this new HEAD.

### Exact remaining limits and first real Firebase activation

1. **Code boundary:** this package connects the normal application in a controlled
   demo installation. Production image initialization/cutover still refuses and
   needs a separately approved binding to a proven versioned source handoff.
   `authorizeApplicationFirebase` prepares a separately signed project/global
   scope, image/owner/Rules binding and revocation; its short permit is not a
   permanent automatic production policy. Credentials alone do not remove this
   code boundary. No flag, environment switch or `executeProduction()` bypass.
2. **Explicitly unsupported scope:** a brand-new server-unknown project needs its
   first online editor confirmation. Bulk deletion/tombstones, archive import or
   restore and unsupported/ambiguous project RAW cannot be called fully synced.
   They refuse without erasing their existing data. Existing durable editors work
   offline; losing their device is a conflict/recovery question, not a lease
   timeout permitting another editor.
3. **Release/environment:** review this exact HEAD/BASE, separately approve CI and
   release, then check Android with the deployed version. Before any owner-data
   cutover prove old-writer exclusion and source/recovery agreement in the real
   profiles; do not infer it from emulator single-window evidence.
4. **LIVE authority:** separately authorize current owner-only Rules/grants,
   actual target/database/UID and the first limited Firebase operation. Historical
   Spark/billing/Rules evidence was not re-audited; check genuinely required fresh
   state at that authorized window. Keep mandatory cost 0 zł; exceeding Spark
   limits must refuse, never enable billing. No VPS/CLOUD-4.6G/distributed STOP
   dependency was added to ordinary product sync. The existing pilot's execution
   blocks remain unchanged.

Implementation is **CODE_READY for the controlled emulator scope**;
production cutover is **INTEGRATION_PARTIAL / LIVE_BLOCKED**. CI_PENDING /
PHONE_PENDING / RELEASE_BLOCKED. No PR, Ready/Draft change, workflow invocation,
merge, Pages, production GET/WRITE, Rules/IAM/billing/grant change or owner-data
migration was performed.

## Produkcyjna synchronizacja — pakiet 01.11.2026

Gałąź `integration/production-local-first-20261101`, BASE `6d6513775ef1e6535503304d5a9540eda33a243c`; HEAD to końcowy commit zawierający ten wpis (pełny SHA w przekazaniu). PR #97 wydany: HEAD `1eb641d5e137eaebfd2f980925b23b686337c92c`, BASE `6ec80ef026eeacfdd8bc9dadf44972c342305776`, merge równy bieżącemu BASE. [CI #41337773213](https://github.com/mebleszek/meble-app/actions/runs/41337773213): 21/21 zadań PASS, w tym auto-merge i weryfikacja Pages dokładnego merge. To dowód poprzedniego wydania, nie PASS nowych zmian.

### Zrealizowane wiązanie produktu

- Istniejący `main-login → application-bootstrap → application-runtime` obsługuje teraz zarówno demonstracyjny startup, jak i zweryfikowane wdrożenie produkcyjne. Nie powstał drugi synchronizator lub operator. Publiczny `application-release.js` ma **null/null**, więc zwykły import/start nadal nie uruchamia migracji ani chmury.
- Trwała publiczna decyzja Ed25519 `MEBLE_APPLICATION_DEPLOYMENT_V1` wiąże konkretny UID, projekt/bazę/origin, activationId, profil, 14 domen, SHA Rules i osobną zgodę na zachowanie źródła/cutover. Nie ma krótkiego terminu administracyjnego. Weryfikacja offline nie przyznaje prawa do danych; każda operacja nadal sprawdza rzeczywisty Google UID, kontekst SDK oraz krótką serwerową lease. Odnowienie tej lease jest zwykłym odczytem Rules, nie podpisywaniem kolejnych zgód.
- Ten sam rzeczywisty SDK Google writer i osobny reader z pamięciowym Auth; trwały SDK login wyłącznie na wcześniej świadomie zaufanej instalacji. Bez wydobywania tokenów przez aplikację, ADC, kluczy usługowych czy prywatnego OAuth operatora. Zwykła sesja tymczasowa nadal wymaga ponownego logowania po zamknięciu; zaufana instalacja odtwarza lokalne dane offline bez Google.
- Protokół 2 Service Workera + Web Lock i trwały techniczny fence IDB potwierdzają pojedynczego klienta przed modułami biznesowymi. Kolejne niezgodne klienty/skrypty otrzymują 423. Nawigacja właściciela może przenieść fence; restart wymaga potwierdzenia nieobecności starego klienta, nie timeoutu. Nie wymusza to aktualizacji otwartej karty, `skipWaiting` ani przejęcia starego aktywnego edytora projektu. Stary worker bez protokołu powoduje odmowę do istniejącej bezpiecznej aktualizacji po zamknięciu kart.
- Oryginalne objęte klucze localStorage pozostają nietknięte. Źródło/hash/activationId i obraz są zatwierdzane w tej samej transakcji IDB. Zapis obrazu/outboxu i potwierdzonego odbioru/CAS używa istniejącego magazynu. Brak receipt po utraconym potwierdzeniu odzyskuje się tylko z kompletnego, zgodnego obrazu/źródła i bindingu; brak/utrata/uszkodzenie dowodów oznacza odmowę. Nie otwierano danych właściciela ani nie wykonywano rzeczywistej migracji.
- Odbiór aktualizuje także prawdziwy cache katalogów, więc UI i obliczenia korzystają z potwierdzonych danych zamiast starej kopii RAM. Nowe materiały mogą wejść do kolejnej jawnie zapisanej rewizji projektu dopiero po potwierdzeniu kompletnego katalogu. Nierozstrzygnięta publikacja nie zmienia przypiętych zależności; stare rewizje i zamrożone oferty pozostają niezmienne. Lokalna wtórna kopia `fc_materials_v1` jest objęta obrazem/transakcją i musi odpowiadać jawnie zapisanej głównej liście; nie jest nowym źródłem prawdy ani domeną synchronizacji.
- Świeże puste urządzenie pobiera istniejące katalogi/projekty; nie publikuje fabrycznych lub pustych wartości zamiast serwera. Niepuste odmienne źródło urządzenia daje jawny konflikt początkowy, bez heurystycznego scalania. Wszystkie 14 domen pozostają istniejącym kontraktem: materiały, okucia, producenci, dostawcy, kategorie, typy, parametry techniczne, ustawienia okuć, robocizna, usługi warsztatowe, magazyn, defaults, firma i koszty. `transport.apiKey` pozostaje lokalny.

### Kandydat Rules i gotowy artefakt aktywacji — niczego nie wdrożono

`tools/firebase-pilot/application-owner.rules` powstaje deterministycznie z publicznych istniejących Rules i fragmentu LOCAL-FIRST, z oryginalnymi walidatorami, immutable rekordami, CAS i epoką edytora. Ograniczenie: dokładny Google UID z verified email, zgodne administracyjne `syncConfig/owner` i `syncAccess/{UID}`; stary pilot wyłączony. Klient nie może edytować/listować grantów, nadpisać immutable rekordu ani usunąć projektu. Nie ma dostępu innego UID. Nie skopiowano prywatnego rollbacku 635 B; kandydat nie jest jego zamiennikiem.

`tools/application-release-package.js` sprawdza wyłącznie dostarczony **publiczny** JSON `{trustedKeySha256,envelope:{decision,publicKeySpki,signature}}` (bajty publicSPKI i podpisu jako tablice). Weryfikuje podpis, niezależnie ustalony fingerprint i hash dokładnego kandydata Rules. Nie generuje klucza, nie podpisuje za właściciela, nie loguje UID/podpisu, nie łączy się z Firebase. Zapisuje nowy publiczny JS wyłącznie poza repo (0600, bez nadpisania). Nie uruchomiono go z prawdziwymi danymi. Publikacja wyniku w slocie aktywacji wymaga osobnej zgody i ponownego powiązania wersji/manifestu; nie jest prostą flagą środowiskową.

### Kontrole i obowiązkowe CI

Wykonane celowane kontrole (Node 22.23.3, rzeczywisty natywny Chromium, Auth/Firestore wyłącznie `demo-meble-app` na loopback):

- Granice wdrożenia/Google/Rules, odnowienie lease, realne fabryki 14 domen, opakowanie podpisu i nowe zależności: **8/8 PASS** (`node tools/production-application-smoke.js`). Dotychczasowe granice startupu: **8/8 PASS**.
- Prawdziwe IDB: atomowość image/outbox przy quota/abort, CAS, duplikat, SIGKILL/persistencja i odmowa niezatwierdzonej produkcyjnej migracji: **PASS**, `node tools/application-authority-store-smoke.js`. Pierwsze wykonanie wykazało 404 nowych zależności ESM w ścisłym serwerze fixture; dodano wyłącznie dwa wymagane moduły, bez zmiany asercji lub czasu oczekiwania.
- Ochrona rzeczywistych zapisów globalnych: **30/30 PASS**, `node tools/global-data-write-safety-smoke.js`. CLOUD-4: niezmienione **6797 B**, SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`; kontrola boundary/historycznych pinów PASS. Nie zmieniono historycznych manifestów ani odmowy `executeProduction()`.
- Końcowy celowany przebieg `node --test --test-name-pattern='LOCAL-FIRST (normal application startup|approved deployment)' cloud-sync-global.test.mjs` w `firebase emulators:exec --project demo-meble-app --only auth,firestore`: **2/2 PASS**, zero skip/cancel/todo, 142,36 s + 127,39 s (łącznie 270,20 s). Obejmuje także nowy jawny zapis materiału przez rzeczywisty katalog, następnie projekt korzystający z niego na drugim urządzeniu i niezmienną zamrożoną ofertę. Komentarze porządkujące opis wspólnego runtime po tym teście nie zmieniają zachowania. Składnia 28 JS/MJS, kanoniczne wersje HTML, routing CI i dokładna integralność offline: PASS. Podczas prac wykryto rzeczywiste przerwanie ważnej lease w chwili odnowienia (naprawione i pokryte regresją), a także zbyt późną asynchroniczną konfigurację podpisanego fixture przy zimnym starcie (rozpoczęcie przed `main-login`, zachowane wszystkie asercje). Jedno celowane wykonanie starszej ścieżki po online zgłosiło odmowę; diagnostyczny przebieg tej samej ścieżki przeszedł. Nie uznano tego za PASS całego pakietu; końcowa kontrola obejmuje obie ścieżki bez diagnostycznego zatrzymywania JS.

Nowy `production-application-smoke.js` jest automatycznie obowiązkowy przez wykrywanie `*-smoke.js` w siedmiu shardach Preflight. Nowa podpisana ścieżka browser/SDK jest osobnym testem w **istniejącym** `cloud-sync-global.test.mjs`, należącym do obowiązkowego Firebase CURRENT batch 3. Dotychczasowe normal-startup, application E2E, LOCAL-FIRST, Auth/Rules i historyczne regresje zachowane. Bez zmian workflow, liczby ośmiu plików CURRENT ani 425 historycznych pinów. Pełnych lokalnych zestawów, Actions i wydania nie uruchamiano.

### Jedna konkretna droga uruchomienia po osobnej zgodzie

1. Niezależna kontrola dokładnych HEAD/BASE, osobna zgoda na PR/CI, PASS i wydanie; Android musi otrzymać tę wersję przez istniejącą bezpieczną aktualizację, bez czyszczenia danych.
2. Prywatnie potwierdzić właścicielski Google UID i fingerprint publicSPKI. Właściciel podpisuje **jedną trwałą decyzję wdrożeniową** dla konkretnego activationId/projektu/bazy/origin, profilu `business-project-v1`, 14 domen i SHA tego kandydata Rules, z `migrationApproved/sourcePreserved/rulesApproved:true`; Codex nie podpisuje w jego imieniu. `reviewApplicationRelease` przygotowuje publiczny artefakt do niezależnego sprawdzenia. Prywatny klucz nie jest potrzebny do codziennej pracy i nie trafia do repo.
3. Osobno zatwierdzić świeże minimalne potwierdzenie stanu Rules i zachowanego oryginalnego rollbacku, Spark/limitów (historyczne billingEnabled:false pozostaje dowodem historycznym), publikację dokładnych Rules z read-back oraz administracyjne granty. Wymagane: `authorizedUsers/{UID}` z `appEnabled:true,globalDataEnabled:true,globalSchemaVersion:1,enabled:false` (zachować inne istniejące pola); `appAccess/{UID}` dokładnie `{schemaVersion:1}`; `syncConfig/owner` dokładnie `{ownerUid:UID,activationId,schemaVersion:1}`; `syncAccess/{UID}` dokładnie `{activationId,schemaVersion:1}`. Żaden z tych zapisów nie jest wykonany w pakiecie.
4. Osobno zatwierdzić publikację publicznego artefaktu aktywacji, rzeczywiste lokalne przełączenie źródła i ograniczony pierwszy produkcyjny READ/WRITE. Po zamknięciu pozostałych starych kart ta sama aplikacja inicjalizuje IDB, zachowuje źródło i automatycznie synchronizuje. Na nowym urządzeniu to samo Google konto odbiera istniejące dane. Codziennie nie potrzeba nowych podpisów, administracyjnego OAuth, drugiego hosta ani płatnej usługi. Cofnięcie `syncAccess` zatrzymuje chmurę, nie kasuje lokalnych danych. Nie usuwać descriptoru/bindingu/journala dla obejścia odmowy.

### Jawne ograniczenia

Koszt obowiązkowy 0 zł, Spark w granicach darmowych limitów; brak gwarancji nieograniczonego transferu lub trwałości przeglądarkowej IDB. Brak VPS/CLOUD-4.6G i rozbudowy STOP operatora. Nie zmieniono UI ani matematyki. Nowy, nieznany serwerowi projekt wymaga pierwszego online potwierdzenia edytora; istniejący zatwierdzony edytor zapisuje offline. Usuwanie zbiorcze i import pełnego archiwum w trybie aktywnego sync pozostają jawną odmową do właściwego protokołu. Sporne globalne RAW/drafty/słoje Issue #47 blokują zależny zakres bez usuwania. Niepuste różne katalogi urządzeń wymagają bezstratnego rozstrzygnięcia konfliktu, nie cichego merge. Fizyczny Android i rzeczywiste Rules/uprawnienia/LIVE pozostają niewykonane. Sukces emulatorów nie stanowi zgody na produkcję.

**Końcowe przekazanie:** CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Wszystkie celowane końcowe kontrole powyżej zaliczone; brak pełnego CI, PR, uruchomienia Actions lub operacji produkcyjnych. Niezależna kontrola obejmuje cały diff względem wskazanego BASE. Jedna początkowa odmowa starszego przepływu po online ma niepotwierdzone źródło (brak danych o wyjątku); po diagnostyce i końcowym przebiegu bez pauz oba testy PASS. Ryzyko do obserwacji w obowiązkowym CI, nie ukryty retry ani zmiana timeoutu/asercji.

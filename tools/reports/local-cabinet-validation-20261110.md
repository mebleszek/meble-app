# P0 — lokalny zapis wszystkich wariantów szafek, 10.11.2026

Gałąź: `fix/local-cabinet-validation-20261110`. BASE/main potwierdzony przez fetch: `eb861142cc08842ef3773e1ea3d3a14847d8ff63`. HEAD oznacza pojedynczy commit zawierający ten raport; pełne SHA, push i CLEAN są podawane po potwierdzeniu zdalnym w przekazaniu. Poprzednich gałęzi diagnostyki i aktualizatora nie zmieniano.

## Potwierdzona przyczyna i reprodukcja BASE

`cabinetModalSave → applicationWrite.projectHandler → createApplicationCommitter.commit(localOnly) → businessProjectContract.validate → projectExportContract.validateOwnedRoom` używał ograniczeń pilota: tylko standardowa/szuflady, ich fronty i wybrane role PCV. Piekarnikowa dawała `LF_PROJECT_SCHEMA_BLOCKED`, reason `EXPORT_UNSUPPORTED_STRUCTURE`.

Przed poprawką potwierdzono konkretny FAIL kontraktu na BASE. Następnie izolowany Chromium z pełnymi zasobami BASE, istniejącą syntetyczną fixture LOCAL-FIRST i nowym scenariuszem formularza odtworzył odmowę zapisania piekarnikowej: modal został otwarty, lista szafek nie zmieniła się (`BASE_FAIL native oven cabinetModalSave → LOCAL-FIRST refuses save; form retained`). Testowa kopia BASE powstała przez `git archive`; skopiowano wyłącznie harness i helper testu, bez kodu produkcyjnego poprawki. Polecenie: `node tools/android-local-first-browser-smoke.js --cabinet-base-probe`. Reset obecny w istniejącym przygotowaniu fixture dotyczy wyłącznie tymczasowego profilu i syntetycznej bazy; nie telefonu ani danych właściciela.

## Zmiana i granice modelu

- Jedna natywna struktura `projectData` schemaVersion 12 pozostaje autorytatywna: pokoje, szafki, fronty, zestawy, produkcyjne PCV i layout. Bez projekcji lokalnego zapisu, zmiany ID, migracji czy osobnego modelu geometrii.
- Wspólne kontrole własności, bezpieczeństwa JSON, ID/unikalności, dodatnich wymiarów, relacji zestawów/frontów, layoutu i właścicieli PCV zachowano. Tylko lokalna gałąź commit wybiera jawnie `validate(payload,{local:true})`.
- Nowy mały `project-local-room-contract.js` sprawdza warianty z faktycznej listy kreatora. Geometrię i materiały frontów porównuje bez zmiany danych z podglądem **tego samego** `generateFrontsForCabinet`; podgląd pracuje na kopii szafki i nie generuje trwałych ID. W generatorze dodano wyłącznie odczytowy odbiornik wyniku. Zwykłe generowanie nie zmienia sposobu przydzielania ID.
- Geometria zestawów pochodzi z istniejącego `deriveSetFrontsFromRecord`, a dopuszczalne role PCV z istniejących generatorów rozkroju/frontów. Jawny kontekst pokoju umożliwia walidację zapisywanego obrazu, również poza aktywnym pokojem. Brak zależności powoduje odmowę. Zachowano natywną możliwość pustych/rozszerzonych wpisów PCV; istniejące `edges` muszą mieć cztery wartości boolean.
- Domyślna walidacja biznesowa, budowanie eksportu, przyjęcie dokumentu synchronizacji i zamknięta projekcja pilota nadal używają ograniczeń pilota. Lokalne dopuszczenie wariantu nie oznacza możliwości jego eksportu ani synchronizacji. Testy potwierdzają odmowę piekarnikowej także przy budowaniu dokumentu i wejściu `projectApplicationRows`.
- Przyszły RYSUNEK/WYCENA mogą korzystać z tych samych ID i danych konstrukcyjnych. Wielosegmentowy layout zachowuje kontrolę referencji i unikalności, dodatkowe bezpieczne metadane pozostają bez zmian. Test zachowania przykładowych metadanych nie deklaruje obsługi nowych struktur przez synchronizację. Nie implementowano ścian, drag & drop, przesuwania, blend, blatów ani nowych obliczeń WYCENY.

## Celowane dowody

Wykonawca: Codex, lokalnie na roboczym pakiecie względem powyższego BASE. Pełnego Preflightu/CI nie uruchamiano.

| Kontrola | Wynik |
|---|---|
| `node tools/local-cabinet-validation-smoke.js` | PASS: 17 kombinacji z faktycznej listy kreatora (8 stojących, 6 wiszących, 3 moduły); również specjalne tryby lodówki/podblatowej/klapy, A/C/D z 1/2 frontami, generowane role PCV, brak mutacji |
| Negatywy w tym samym teście | PASS: złe/powtórzone ID, wymiary/geometria frontów, obce relacje i właściciele/role PCV, błędne edges/mapy, referencje layoutu, parametry/relacje zestawów, nieobsługiwany eksport i przyjęcie sync |
| `node tools/local-cabinet-native-browser-smoke.js` | PASS: rzeczywisty formularz add/edit/save dla wszystkich 17 wariantów, A/C/D, rzeczywiste project-owned PCV, sesja Save, zimny restart całego Chromium offline i identyczny pełny zapis projektu; ponowne otwarcie formularzy wszystkich 17 szafek |
| Rzeczywisty abort zapisu w tym samym Chromium | PASS: przerwana natywna transakcja IndexedDB pozostawia modal i wartości formularza, poprzedni RAM, dokładny RAW i wszystkie cztery magazyny; brak sukcesu/zamknięcia |
| `node tools/project-selective-export-smoke.js` | 62/62 PASS, w tym standardowa/szuflady, PCV, odczyt po restarcie, odmowy zapisu/konfliktów oraz istniejące negatywy pilota |
| `node tools/business-project-contract-smoke.js` | PASS: własność, pełne pola, zamrożone oferty, hashe, odmowa niejednoznacznego RAW, lokalne dane globalne |
| Wersje, load groups, manifest, składnia JS/MJS, diff i rozrost modułów | PASS; szczegóły kontroli końcowej w przekazaniu |

Podczas przygotowania testu poprawiono wyłącznie założenia harness: zamknięcie komunikatu sukcesu, właściwe `window.FC` (odrębne od lexical app-core `FC`), edycja narożnej przez ST zamiast wynikowej głębokości oraz dozwolona wysokość klapy AVENTOS 40 cm. Nie zmieniano walidacji AVENTOS ani asercji odmowy zapisu. Pierwsza próba zakończyła się `LF_CDP_TIMEOUT` w setup fixture; nie przypisano jej potwierdzonej przyczyny. Po zakończeniu regeneracji manifestu kolejne uruchomienia dochodziły do scenariuszy aplikacji.

Nowe entrypointy `*-smoke.js` są automatycznie zbierane przez istniejący Preflight: browser w grupie 5/7, kontrakt w 6/7 (bieżący deterministyczny routing). Pełny istniejący scenariusz `android-local-first-browser-smoke.js` pozostaje zachowany; nowa flaga daje wyłącznie osobny, celowany przebieg. Nie zmieniano workflow.

## Zakres plików i status

Dokładna lista zmienionych plików:

- `CURRENT_STATE.md`
- `dev_tests.html`
- `index.html`
- `js/app/cabinet/cabinet-fronts.js`
- `js/app/cabinet/front-hardware-fronts.js`
- `js/app/cabinet/front-material-source.js`
- `js/app/project/business-project-contract.js`
- `js/app/project/project-export-contract.js`
- `offline-assets.js`
- `sync/application-replication.mjs`
- `tools/android-local-first-browser-smoke.js`
- `tools/app-dev-smoke-lib/file-list.js`
- `tools/index-load-groups.js`
- `tools/project-selective-export-smoke.js`
- `tools/script-versions.js`
- `js/app/project/project-local-room-contract.js`
- `tools/helpers/local-cabinet-native-cases.js`
- `tools/local-cabinet-native-browser-smoke.js`
- `tools/local-cabinet-validation-smoke.js`
- `tools/reports/local-cabinet-validation-20261110.md`


Kod: `project-export-contract.js`, nowy `project-local-room-contract.js`, `business-project-contract.js`, `sync/application-replication.mjs`; wąskie udostępnienie kontekstu/podglądu w `cabinet-fronts.js`, `front-hardware-fronts.js`, `front-material-source.js`. Zależności: `index.html`, `dev_tests.html`, `offline-assets.js`, `tools/script-versions.js`, `tools/index-load-groups.js`. Testy: dwa nowe smoke, nowy helper, istniejące harness/listy fixture. Dokumentacja: ten raport i CURRENT_STATE.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Nie uruchamiano pełnego CI, PR, merge, wydania ani Firebase LIVE. Nie zmieniano Auth, writer-fence, CAS, zasad offline/pojedynczego edytora, aktualizatora, definicji cenników/norm/materiałów i zamrożonych ofert. Brak resetu/migracji danych telefonu. Pełne CI i test na fizycznym Pixelu nadal nie są potwierdzone; synchronizacja konstrukcji spoza pilota pozostaje niedostępna. Następny krok: niezależna kontrola konkretnego diffu/HEAD/BASE przez ChatGPT.

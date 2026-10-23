# WYCENA-LABOR — raport implementacji 23.10.2026

Gałąź: `feat/wycena-labor-20261023`. Worktree: `/workspace/wycena-labor`.
BASE/main: `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` (scalony CLOUD-SYNC-1 / PR #78).
Końcowy HEAD i stan push/clean są podane w raporcie przekazania; ten plik nie próbuje zapisywać własnego SHA.

Implementacja: **CODE_READY**. Pełna weryfikacja: **CI_PENDING**. Wydanie: niewykonane. Firebase: **LIVE_BLOCKED**.

## Zakres i decyzje

Jedynym źródłem zasad jest [QUOTE_CALCULATION_REGISTER.md](../../QUOTE_CALCULATION_REGISTER.md#2026-10-23--zatwierdzone-normy-wycena-labor), ze wszystkimi normami, jednostkami, źródłami, mapowaniem starych ID, wyłączeniami i kompatybilnością. Właściciel w tej sesji potwierdził domyślne regulowane półki, własne puszki oraz standard wiszącej HDF: 2 własne NUT-y + 2 otwory + 2 podcięcia. Nie ma nierozstrzygniętej decyzji dla tego standardu.

Wdrożono 14 nowych definicji cennika: nóżki, zawieszki, wycięcia HDF, NUT-y, dwa alternatywne pakiety wiercenia półek, osadzenie półek, puszki, dodatkowe rozmierzanie per front, przykręcenie zawiasów/prowadników, próbne założenie, zdjęcie/pakowanie, ponowne założenie i regulację drzwi. Skręcanie 60 min oraz dopłaty szerokości/gabarytoczasu zachowano. Wyniki i źródła trafiają do centralnego rejestru. Przy braku identyfikacji konkretnego frontu powstaje jawny audyt STOP, bez zgadywania rozkładu zawiasów. Niestandardowe konstrukcje HDF nie otrzymują automatycznie obróbek zatwierdzonych dla standardu; pozostają dostępne ręczne ilości tych czynności.

Stare cztery ID nie zmieniają znaczenia ani nie są usuwane. Ich automaty zastępuje jawne mapowanie; ręczne przypisania zachowują normę, ilość i notatkę, zastępując odpowiadające automaty. Audyt pokazuje zastąpienie i naliczone zero automatu. Prywatne ID nie są deduplikowane po nazwie. Nowe definicje seedowane są idempotentnie. Wyłączenie nowej definicji nie uruchamia ponownie starego automatu.

## Ochrona danych i izolacja chmury

Przed zmianą sprawdzono GitHub main, otwarte PR i gałęzie oraz rzeczywisty diff PR #78. PR #78 był już scalony; użyto aktualnej bazy, bez pracy w gałęzi/worktree CLOUD-SYNC. Aktualny AGENTS i rejestry pozostają obowiązujące. Nie edytowano CURRENT_STATE, ROADMAP, CLOUD_DATA_REGISTER ani CLOUD_MIGRATION.

Nowe pola `details.additionalLegs`, `hangerCount`, `shelfType`, `hingeDrilling` mają zamknięte walidatory eksportu projektu. Dwie liczby są nieujemne i całkowite; dwa enumy mają po dwie zatwierdzone wartości. Zapis, odczyt i backup korzystają z istniejących mechanizmów. Brak migracji i nowego klucza storage. Stare projekty otrzymują odczyt domyślny bez przepisywania danych. Zachowano Zapisz/Anuluj i istniejący układ; dodano cztery niezbędne kontrolki i pomoc cennika. Zmiana wersji cache faktów oraz cache-busting zmienionych skryptów zapobiega używaniu starych wyliczeń w nowym runtime.

Cennik używa istniejących pól CLOUD-3, w tym już dozwolonego `startQty=0`; nie poszerza się schematu globalnego. Bez zmian synchronizatora, transportu Firebase, CAS, manifestów integralności, Rules i bootstrapu. Do istniejącego emulatorowego testu produktu dodano jeden scenariusz nowych norm. Projekty, prawdziwe dane właściciela i snapshoty nie są migrowane ani synchronizowane przez ten pakiet.

## Kontrole faktycznie wykonane lokalnie

- Celowana diagnostyka `wycena-labor-norms-smoke.js`: **6/6 grup PASS**, obejmujących granice nóżek 20/80 i głębokość 20, AGD i dodatki, wspólny materiał/robociznę, HDF 23 min / plecy 18 mm, progi obu półek, cykl zawiasów/drzwi, TIP-ON, stawki użytkownika, zastąpienia ręczne lokalne i ofertowe, unikalne identyfikatory audytu, idempotencję oraz zachowane normy poza zakresem.
- Celowana diagnostyka `wycena-labor-compatibility-smoke.js`: **3/3 grupy PASS**, rzeczywiste zero w siedmiu trybach, formularz 45 min i `startQty=0`, przełączenie edytowanej pozycji, Anuluj oraz zamknięty roundtrip wszystkich nowych norm CLOUD-3 bez zapisów.
- Celowana diagnostyka `wycena-labor-persistence-smoke.js`: **3/3 grupy PASS**, rzeczywisty formularz draftu/Zapisz/Anuluj, native zapis/odczyt projektu, eksport selektywny i ponowna walidacja payloadu, stare dane, odmowa nieznanych pól i pełny backup/export/import z dokładnym zachowaniem bajtów historii.
- Dodatkowa celowana kontrola zachowania prywatnych pozycji nazwanych jak dawne systemowe AGD: PASS; prywatne ID zachowują ceny i kategorię.
- Pierwsze próby nowej diagnostyki ujawniły braki fixture (`persistUi`, licznik zawiasów) i różnicę prototypów vm w porównaniu testowym. Poprawiono fixture/porównanie bez osłabiania asercji i bez dostosowywania reguł produkcyjnych do testu.
- Składnia zmienionych JS/MJS: **29/29 PASS**; `git diff --check`: PASS. Nie uruchamiano pełnego lokalnego Preflightu ani dawnych pełnych regresji.
- Próby lokalnego Chromium: początkowo blokada `setsockopt`, następnie timeout uruchomienia/rendererów w sandboxie. **Nie jest to PASS UI ani dowód regresji formularza.** Również niezależna pusta strona HTML bez kodu i CSS aplikacji zakończyła się timeoutem bez bajtów DOM; potwierdza to ograniczenie lokalnego uruchomienia Chromium. Test przeglądarkowy jest przygotowany dla CI; fizyczny Android i Windows nie były testowane.

PASS diagnostyki nie jest przypisany do pełnego CI. Wyniki dotyczą odizolowanych danych syntetycznych, nie danych właściciela.

## Rzeczywiste podłączenie CI i brakujące dowody

`.github/workflows/preflight-js.yml` uruchamia po osobno zatwierdzonym Ready:

1. `node tools/preflight.js` → faza automatycznie wykrywa wszystkie `tools/*-smoke.js`, w tym cztery nowe pliki tego pakietu. Repo nie ma `site*.zip`, więc workflow przetestuje bieżący root. Zachowano dawne testy; zmieniono jedynie oczekiwania zastąpionych norm, wersję cache oraz dopuszczono ponowne użycie fixture modala.
2. Nowy `wycena-labor-ui-browser-smoke.js` uruchamia rzeczywiste komponenty DOM/CSS w osobnych profilach Chromium, z rozmiarem/UA Androida i Windows. Testuje czytelne kontrolki, brak wyjścia poza ekran, dwa rodzaje półek, nadpisanie 0, powrót do automatu i pomoc `?`. Wymaga Chrome/Chromium (standardowy obraz Ubuntu GitHub lub jawny `CHROMIUM_PATH`); brak przeglądarki kończy się FAIL, bez skip/PASS. To kontrola komponentów, nie akceptacja na rzeczywistych systemach.
3. Istniejący krok `cd tools/firebase-pilot; npm ci; npm test` obejmuje `cloud-sync-global.test.mjs`, do którego dopisano scenariusz WYCENA-LABOR: rzeczywiste Auth/Firestore SDK i Rules na demo emulatorach, pełny model norm/stawek, 45 min, zero startQty, niezależny odczyt B i brak zmiany bajtów historii/projektów. Dawne 14 scenariuszy zachowano. Lokalnie scenariusz SDK **niewykonany**.

Pełny Preflight, wszystkie regresje domen (MATERIAŁ/WYCENA/ROZRYS/PCV/katalog/magazyn/historia), oba profile przeglądarkowe i cały zestaw SDK/Rules: **CI_PENDING** dla finalnego HEAD/BASE. Nie dziedziczymy PASS z PR #78. Właściciel po osobnym wydaniu sprawdza ergonomię na Androidzie oraz Windows: edycję czterech pól, Anuluj/Zapisz, ponowny odczyt i pomoc cennika. Fizyczna akceptacja jest osobnym brakującym dowodem.

Nie utworzono PR Ready/Draft, nie uruchomiono GitHub Actions, nie scalono do main, nie opublikowano Pages i nie wykonano Firebase LIVE.

## Zmienione pliki

- `QUOTE_CALCULATION_REGISTER.md`
- `dev_tests.html`
- `index.html`
- `js/app/cabinet/cabinet-cutlist.js`
- `js/app/cabinet/cabinet-derived-facts.js`
- `js/app/cabinet/cabinet-hardware-requirements.js`
- `js/app/cabinet/cabinet-modal-draft.js`
- `js/app/cabinet/cabinet-modal-labor.js`
- `js/app/material/price-modal-field-help.js`
- `js/app/material/price-modal-item-form.js`
- `js/app/material/price-modal-list.js`
- `js/app/pricing/labor-catalog-definitions.js`
- `js/app/pricing/labor-catalog.js`
- `js/app/pricing/work-quantity-facts.js`
- `js/app/pricing/work-quantity-sources.js`
- `js/app/project/project-export-contract.js`
- `js/app/quote/quote-calculation-register.js`
- `js/app/quote/quote-snapshot.js`
- `js/app/wycena/wycena-core-labor.js`
- `js/app/wycena/wycena-core-lines.js`
- `tools/cabinet-derived-facts-cache-smoke.js`
- `tools/cabinet-modal-safe-dirty-smoke.js`
- `tools/firebase-pilot/cloud-sync-global.test.mjs`
- `tools/labor-appliance-category-clean-rebase-smoke.js`
- `tools/labor-cabinet-single-accordion-dedupe-smoke.js`
- `tools/labor-quantity-values-link-smoke.js`
- `tools/labor-time-minutes-smoke.js`
- `tools/quote-labor-single-truth-smoke.js`
- `tools/reports/wycena-labor-20261023.md`
- `tools/wycena-labor-compatibility-smoke.js`
- `tools/wycena-labor-norms-smoke.js`
- `tools/wycena-labor-persistence-smoke.js`
- `tools/wycena-labor-ui-browser-smoke.js`

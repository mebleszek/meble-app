# TEST_BASELINE — punkt odniesienia testów Meble-App

Data analizy: **2026-10-04**  
Punkt bazowy: **`site_program_defaults_apply_fix_v1.zip`**

## 1. Wynik bazowy

### Składnia

- pliki JS: **473**,
- `node --check`: **473/473 PASS**.

### Samodzielne smoke testy

W `tools/` znajduje się **76** plików `*-smoke.js`.

- **66 PASS**,
- **10 FAIL**.

### Główny APP smoke

`node tools/app-dev-smoke.js`

- **109/110 OK**.

### Kolejność ładowania skryptów

`node tools/check-index-load-groups.js`

- **FAIL**,
- `index.html`: **311** skryptów,
- konfiguracja audytu: **309**.

---

## 2. Klasyfikacja czerwonych testów

### A. Testy historyczne / kruche — program nie jest obecnie głównym podejrzanym

#### 1. `tools/app-dev-smoke.js`

Błąd: `Katalog okuć ma UX statusu ceny i szybkich filtrów`.

Przyczyna: test tworzy rekord importowanej ceny z datą `2026-05-10` i oczekuje statusu `Do sprawdzenia`. Runtime ma próg starej ceny **90 dni**. W październiku 2026 ta sama cena jest już prawidłowo klasyfikowana jako `Stara cena`.

Klasyfikacja: **test zależny od bieżącej daty / niedeterministyczny**.

Naprawa później: zamrozić datę w teście albo testować jawne statusy niezależnie od realnego `Date.now()`.

---

#### 2. `tools/carrying-lift-logistics-smoke.js`

Błąd: oczekuje `carrying labor component` w robociźnie szafki.

Aktualna architektura od 2026-06-14 traktuje **wnoszenie jako osobny dział/total WYCENY**, a test `carrying-separate-quote-smoke.js` przechodzi.

Klasyfikacja: **stary kontrakt testu**.

---

#### 3. `tools/labor-audit-readable-lines-smoke.js`

Błąd wynika z dosłownego sprawdzania starego fragmentu źródła:

`text(row && row.section) === 'labor'`

Aktualny kod obsługuje czytelny renderer przez:

`['labor','project'].includes(...)`

Sam renderer, pola audytu i style nadal istnieją.

Klasyfikacja: **kruchy test statyczny po późniejszym rozszerzeniu funkcji**.

---

#### 4. `tools/labor-conditions-remove-auto-role-smoke.js`

Test zabrania używania m.in. `cabinet.weight_kg` jako warunku bez osobnego etapu.

Późniejsze etapy świadomie dodały fakty logistyczne (`cabinet.weight_kg`, `carrying.*`) do centralnego modelu faktów. `CLOUD_MIGRATION.md` opisuje je jako pochodne/odtwarzalne.

Klasyfikacja: **historyczna lista dozwolonych źródeł**.

---

#### 5. `tools/labor-quantity-source-selector-smoke.js`

Test wymaga dokładnego tekstu źródła:

`quantitySource:readString('laborQuantitySource')`

Aktualny formularz nadal zapisuje `quantitySource`, ale robi to warunkowo:

`quantitySource: usesQuantity ? readString(...) : ''`

Klasyfikacja: **test sprawdza implementację tekstowo zamiast zachowania**.

---

#### 6. `tools/quote-labor-single-truth-smoke.js`

Test wymaga co najmniej 4 linii robocizny szafek. Aktualny fixture poprawnie tworzy 3 linie:

- zwykła szafka,
- szuflada + drzwi,
- korpus prowadzący zestawu.

Korpus pomocniczy zestawu nie dubluje robocizny, a zmywarka jest rozliczana jako osobna usługa/AGD.

Kontrola: po zmianie **wyłącznie oczekiwania testu z `>=4` na `>=3`**, bez zmiany runtime, cały pozostały test przechodzi.

Klasyfikacja: **stare oczekiwanie fixture/testu**.

---

#### 7. `tools/transport-catalog-quote-fix-smoke.js`

Test twierdzi, że cennik robocizny/stawek nie może zawierać transportu.

Aktualny kontrakt od 2026-06-11 jawnie utrzymuje `transport_distance_km` jako kanoniczną pozycję `quoteRates`, z osobnym totalem Transport w WYCENIE.

Klasyfikacja: **stary kontrakt architektoniczny**.

---

### B. Wspólna niespójność wersji BUILD — do uporządkowania

Trzy testy mają ten sam rdzeń problemu:

- `tools/wycena-diagnostics-report-smoke.js`,
- `tools/wycena-quote-history-storage-maintenance-smoke.js`,
- `tools/wycena-unsaved-preview-storage-fix-smoke.js`.

`index.html` i `dev_tests.html` ładują `wycena-diagnostics.js` z cache-bustingiem:

`20260628_drawer_systems_materials_v1`

ale sam moduł `wycena-diagnostics.js` deklaruje:

`BUILD = 20260618_wycena_boot_dependency_retry_v1`.

Klasyfikacja: **niespójność metadanych wersji/testów**, nie potwierdzony błąd matematyki WYCENY.

Przed poprawką trzeba zdecydować, co jest kanonicznym numerem modułu: wewnętrzny `BUILD`, cache-busting URL czy osobny globalny build aplikacji. Nie robić ślepego globalnego search/replace.

---

### C. Audyt kolejności skryptów — nieaktualna konfiguracja

`tools/check-index-load-groups.js` zgłasza 311 skryptów w `index.html` przy 309 w konfiguracji.

Dwa pliki obecne w realnym `index.html`, których nie ma w konfiguracji audytu:

- `js/app/project/project-recalculate.js`,
- `js/app/ui/accordion-behavior.js`.

Po pierwszym brakującym wpisie cała dalsza lista przesuwa się i generuje wiele pozornych błędów kolejności.

Klasyfikacja: **konfiguracja testu wymaga aktualizacji po wcześniejszych wdrożeniach**.

Przed zmianą potwierdzić, że obecna kolejność w `index.html` jest rzeczywiście zamierzona; następnie zaktualizować config i ponownie uruchomić audyt.

---

## 3. Co obecnie wygląda zdrowo

Przechodzą m.in. testy dotyczące:

- globalnych ustawień programu,
- zastosowania globalnych ustawień do nowych szafek,
- zapisu wyboru systemu szuflad,
- materiałów i systemów szuflad,
- wymagań zawiasów,
- katalogu/importu okuć,
- ORS/transportu,
- oddzielnego działu wnoszenia,
- sposobów naliczania ceny,
- projektu technicznego i przeliczenia projektu,
- ROZRYS smoke,
- PRO100,
- większości WYCENY i historii snapshotów.

To nie zastępuje testu w prawdziwej przeglądarce, ale daje sensowny punkt bazowy.

---

## 4. Kolejność porządkowania testów

Bez zmian biznesowych w programie:

1. naprawić test zależny od daty w `app-dev-smoke`,
2. odświeżyć 6 historycznych/kruche smoke testów do aktualnych kontraktów,
3. rozstrzygnąć i ujednolicić wersję `BUILD` diagnostyki WYCENY,
4. zaktualizować konfigurację `index-load-groups` po potwierdzeniu dwóch nowych wpisów,
5. uruchomić ponownie wszystkie 76 smoke testów,
6. wymagać **76/76 PASS** oraz PASS audytu load-order jako nowego baseline,
7. dopiero później podpiąć ten baseline pod GitHub Actions.

## 5. Ważna zasada

**Nie wolno zmieniać logiki produkcyjnej tylko po to, żeby stary test zrobił się zielony.**

Jeżeli test i obecna dokumentacja/kontrakt są sprzeczne, najpierw ustalić, która wersja zachowania jest zamierzona.

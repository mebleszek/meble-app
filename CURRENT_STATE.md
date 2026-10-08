# CURRENT_STATE — aktualny stan Meble-App

Data przeglądu: **2026-10-04**  
Punkt bazowy: **`site_program_defaults_apply_fix_v1.zip`** (paczka z 2026-09-08)

## Po co jest ten plik

Ten dokument ma być krótką, aktualną odpowiedzią na pytanie: **„jak program działa dzisiaj i co jest już zrobione?”**. Nie zastępuje historii w `DEV.md` ani szczegółowych kontraktów w `CLOUD_MIGRATION.md`, `QUOTE_CALCULATION_REGISTER.md`, `BACKUP.md` i `DEPENDENCY_MAP.md`.

Przy kolejnych pracach najpierw czytać ten plik i `ROADMAP.md`. Historyczne wpisy w `README.md`/`DEV.md` traktować jako tło, a nie automatycznie jako listę rzeczy nadal do zrobienia.

---

## 1. Skala i architektura

Aktualny projekt jest dużą aplikacją przeglądarkową rozwijaną bez frameworka i bundlera.

- wszystkie pliki w paczce: ok. **756**,
- pliki JavaScript łącznie: **473**,
- produkcyjne pliki JS wykryte przez audyt zależności: **387**,
- skrypty ładowane przez `index.html`: **311**,
- skrypty ładowane przez `dev_tests.html`: **339**,
- produkcyjny kod JS: ok. **83 tys. linii**,
- komunikacja modułów opiera się głównie o namespace `window.FC`,
- aplikacja jest publikowana jako statyczna strona (GitHub Pages / repozytorium GitHub).

To już nie jest mały jednoplikowy program. Zmiany trzeba robić modułowo i pod osłoną testów.

---

## 2. Kontrola składni i zależności

Na bazowej paczce:

- **473/473** pliki JS przechodzą `node --check`,
- audyt zależności wykrywa **2231** krawędzi zależności po symbolach `FC`,
- **16** plików ma klasę ryzyka „wysokie / nie ruszać bez osobnego planu”,
- **86** plików ma ryzyko średnie.

Najbardziej ryzykowne obszary:

- `js/tabs/rysunek.js` — duży monolit, osobny plan przed refaktorem,
- WYCENA: `quote-snapshot-store.js`, `wycena-core-labor.js`, `wycena-core-lines.js`, `wycena-diagnostics.js`,
- katalog okuć: `hardware-catalog.js`, `catalog-store.js`,
- ROZRYS: część logiki ma wysokie ryzyko i wymaga testów kontraktowych.

---

## 3. Testy — stan bazowy

Szczegółowa klasyfikacja jest w `TEST_BASELINE.md`.

Najważniejsze liczby:

- samodzielne pliki `tools/*-smoke.js`: **76**,
- przechodzi: **66**,
- nie przechodzi: **10**,
- `app-dev-smoke.js` wewnętrznie: **109/110 OK**,
- osobny audyt kolejności skryptów `check-index-load-groups.js`: **FAIL**.

Obecne czerwone wyniki **nie oznaczają 10 usterek runtime**. Większość to historyczne albo kruche oczekiwania testów, które nie zostały odświeżone po późniejszych zmianach architektury. Trzy testy WYCENY wskazują wspólną niespójność numeru `BUILD`, a audyt kolejności skryptów ma nieaktualną konfigurację 309 vs 311 skryptów.

Testy najnowszych zmian dotyczących globalnych ustawień i szuflad przechodzą.

---

## 4. Dane i przygotowanie do chmury

Docelowy kierunek zapisany w `CLOUD_MIGRATION.md` to **Firebase Authentication + Cloud Firestore**, wdrażane etapami, bez przepisywania całej aplikacji naraz.

Obecnie program nadal działa lokalnie, ale część warstw została już przygotowana pod wymianę storage na zdalne repozytorium:

- inwestorzy mają lokalne repository/store,
- projekt inwestora ma wydzielone repository/runtime,
- snapshoty ofert mają własny store,
- katalogi i część ustawień mają własne store/boundary,
- statusy projektu/ofert są stopniowo oddzielane od UI,
- `derivedFacts` są traktowane jako odtwarzalny cache, a nie druga prawda danych.

Aktualny audyt storage:

- pliki z referencjami do storage: **36**,
- referencje storage łącznie: **313**,
- z tego test/tooling: **208**,
- kategoria `direct-or-legacy-storage`: **31** referencji.

Wniosek: **Etap 1/2 przygotowania do chmury jest częściowo wykonany, ale jeszcze nie zakończony**. Firebase nie powinien być podłączany przed ponownym audytem granic danych i uporządkowaniem testów.

### Docelowo do chmury

- inwestorzy,
- projekty, pomieszczenia, szafki,
- ustawienia i dane źródłowe projektu,
- wyceny, historia ofert, drafty,
- katalogi/cenniki użytkownika,
- zlecenia usługowe,
- w przyszłości zakupy i rzeczywiste koszty.

### Powinno pozostać lokalne / odtwarzalne

- stan UI i rozwinięcia accordionów,
- aktywna zakładka,
- techniczne sesje restore/reload,
- automatyczny cache ROZRYS,
- diagnostyka,
- dane testowe,
- część `derivedFacts`, jeśli można je bezpiecznie przeliczyć ponownie.

---

## 5. WYCENA — obecny kierunek

Centralnym kontraktem jest `QUOTE_CALCULATION_REGISTER.md`.

WYCENA ma już mocno rozwinięte fundamenty „jednej prawdy”:

- centralny rejestr wyliczeń,
- osobne linie materiałów, okuć, robocizny, transportu, wnoszenia i usług,
- snapshoty historii ofert,
- zamrożony model `clientOffer` do podglądu klienta i przyszłego PDF,
- audyt szczegółów oferty,
- `quantitySource` i `conditions` dla robocizny,
- stawki godzinowe i sposoby naliczania ceny,
- montaż AGD,
- transport i ORS,
- wnoszenie/logistyka,
- wymagania techniczne okuć.

Nie należy teraz robić dużego refaktoru WYCENY. Najpierw trzeba uzyskać wiarygodny zielony baseline testów i potwierdzić brakujące elementy matematyki.

---

## 6. MATERIAŁ / ROZRYS

Istnieje już dużo wspólnych zależności i część zasad jednej prawdy, np. PCV ma pochodzić z tych samych danych materiałowych.

Nadal otwarty jest plan pełniejszego wspólnego modelu:

- formatki,
- materiały,
- okleiny,
- dane wejściowe dla ROZRYS,
- zgodność ilości użytych w WYCENIE.

`OPTIMIZATION_PLAN.md` wprost wskazuje **Materiał + ROZRYS** jako ważny etap danych przed większymi refaktorami.

---

## 7. Okucia, ceny dostawców i zakupy

Już działa rozbudowany katalog okuć:

- producenci,
- kategorie i parametry techniczne,
- wiele cen / dane dostawców,
- import/export XLSX,
- wymagania techniczne i dobór wariantów,
- rozdzielenie ceny zakupu od ceny do wyceny.

Plan przyszły, jeszcze nieukończony:

1. jasna reguła ceny użytej do konkretnej oferty,
2. snapshot kosztu/ceny w ofercie,
3. lista zakupów po zaakceptowaniu oferty,
4. zatwierdzenie faktycznego dostawcy i faktycznego kosztu,
5. raport **plan vs rzeczywistość / rentowność**.

Zaakceptowana oferta klienta nie może się zmieniać po późniejszej aktualizacji cennika.

---

## 8. Robocizna i „zjadacze czasu”

Model robocizny jest rozwinięty, ale `OPTIMIZATION_PLAN.md` wskazuje jeszcze niepełne obszary czasu pracy.

Priorytet dalszego uzupełniania:

1. montaż frontów, zawiasów, prowadnic/podnośników i regulacja,
2. wycięcia, blendy, trudne wnęki,
3. zamawianie materiałów/okuć i kontrola dostaw,
4. pakowanie, załadunek, sprzątanie,
5. dopiero później rozsądny bufor ryzyka.

Nie dodawać tych kosztów „na oko” bez jawnych źródeł ilości i testów.

---

## 9. Harmonogram / statusy procesowe

Pod przyszły harmonogram istnieje już read-only boundary `FC.projectScheduleStatus`.

Program rozróżnia procesowe kolejki m.in.:

- `Pomiar`,
- `Wycena` / wycena końcowa po pomiarze.

**Właściwy kalendarz/harmonogram nie jest jeszcze gotowy.** Gdy ten etap ruszy, UI powinno czytać istniejące boundary statusów, a nie interpretować historię ofert od nowa.

---

## 10. Kreator nietypowych korpusów

`CABINET_CREATOR_PLAN.md` jest nadal planem, nie ukończoną funkcją.

Kierunek jest ustalony:

- kreator ma być w WYWIADZIE,
- ma tworzyć zwykłą szafkę korzystającą z tych samych materiałów, faktów i WYCENY,
- nie może dostać osobnego systemu wyceny,
- później możliwy zapis nietypowej szafki jako szablonu,
- docelowo potrzebny prosty schemat/rysunek korpusu.

Warunkiem rozpoczęcia jest stabilny model źródeł ilości i WYCENY.

---

## 11. Mieszane fronty / „Szuflady + drzwiczki”

To nadal plan późniejszy.

Docelowy model powinien rozróżniać rolę każdego frontu, np.:

- `drawer` — front szuflady,
- `door` — drzwiczki zawiasowe.

Nie należy budować tego na samych licznikach `frontCount/drawerCount/doorCount`. Najpierw musi być stabilna jedna prawda frontów pomiędzy WYWIAD → MATERIAŁ → wymagania okuć → WYCENA.

---

## 12. RYSUNEK

`js/tabs/rysunek.js` ma ok. **1459 linii** i jest oznaczony jako obszar **„nie ruszać bez osobnego planu”**.

Nie jest obecnie blokadą dla chmury ani WYCENY. Duży refaktor RYSUNKU powinien być późnym, osobnym etapem. Nie należy teraz inwestować w szerokie łatanie starego monolitu tylko po to, żeby zachować jego obecną strukturę.

### Znany dług bezpieczeństwa zapisu — odłożyć do przebudowy RYSUNKU

Audyt zamykający 2B.4 po wdrożeniu MATERIAŁU 6f potwierdził, że obecny RYSUNEK ma ścieżki **mutation-before-durable-begin**:

- helpery takie jak `addFinish()`, `removeFinish()`, `insertGapAfter()` oraz część interakcji RYSUNKU najpierw mutują współdzielone `projectData`, a dopiero potem wywołują `saveProject()`,
- `saveProject()` dopiero później dochodzi do `FC.project.save(projectData)`, więc zabezpieczenie sesji może nastąpić już po zmianie RAM,
- przy awarii durable `session.begin()` zapis centralny może zostać zablokowany, ale RAM może być już zmieniony,
- `ensureLayout()` potrafi normalizować / tworzyć `layout`, wiersze i `finishes` podczas wejścia/renderu, czyli istnieją mutacje niebędące jednoznacznie zatwierdzoną akcją użytkownika,
- `fc_ui_v1` należy do rollback scope; przed przebudową trzeba testem rozdzielić prawdziwe dirty projektu od czysto wizualnego/UI dirty w RYSUNKU,
- moduł nadal miesza render SVG, interakcje, drag/drop, inspektor, listy wykończeń oraz stare `alert/confirm/prompt`.

### Decyzja

Nie tworzyć teraz osobnego patcha typu „6h” naprawiającego wszystkie powyższe ścieżki w obecnym monolicie.

Gdy temat RYSUNKU zostanie świadomie wznowiony:

1. najpierw ustalić docelowy UX i zakres funkcji,
2. zinwentaryzować mutacje danych vs stan czysto wizualny,
3. usunąć / zastąpić systemowe dialogi i wzmocnić testy kontraktowe,
4. dopiero potem rozdzielać render, interakcje i domenę,
5. nowe mutacje budować od początku według kontraktu: **lokalny draft / plan → durable session.begin → trwały zapis → aktualizacja współdzielonego RAM**,
6. nie przenosić automatycznie starych mutacji 1:1 do nowych modułów.

Wcześniejsze paczki przebudowy RYSUNKU nie zostały świadomie przeniesione do stabilnej bazy, dlatego przy przyszłej pracy nie traktować ich jako obowiązującej architektury bez ponownej decyzji.

---

## 13. Oferta klienta / PDF

Podgląd klienta i zamrożony `clientOffer` są już rozwijane.

Finalny PDF jest **świadomie odłożony na koniec**. Powinien renderować ten sam zamrożony model `clientOffer`, bez własnego ponownego liczenia i bez odczytywania bieżącego projektu.

---

## 14. PRO100 / usługi

Import plików PRO100 istnieje i korzysta ze wspólnego parsera dla pliku/wklejki.

Plan późniejszy obejmuje rozpoznawanie dodatkowych operacji (`NUT`, `FREZ`, `ROZCIĄĆ`, `FRONT ZAWIASY`) jako osobny moduł, a nie rozbudowę parsera bazowego bez końca.

---

## 15. GitHub / publikacja

Obecny workflow `preflight-js.yml` sprawdza głównie:

- rozpakowanie ZIP,
- składnię JS,
- istnienie `index.html`, `js/boot.js`, `js/app.js`.

**Nie uruchamia pełnego zestawu testów regresyjnych.** To jest jeden z najważniejszych krótkoterminowych długów technicznych.

---

## 16. Zasada pracy od teraz

Przed zmianą programu:

1. opisać problem i proponowany zakres,
2. wskazać ryzyko i testy,
3. nie zmieniać niczego przed komendą użytkownika **„do dzieła”**,
4. po zatwierdzeniu robić możliwie mały diff,
5. po zmianie uruchomić testy obszaru i baseline,
6. dopiero potem publikacja/test użytkownika.

Najbliższy techniczny etap: **stabilizacja testów i utworzenie wiarygodnego preflightu**, bez dużego refaktoru runtime.

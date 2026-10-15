# CURRENT_STATE — aktualny stan Meble-App

Data przeglądu danych i integracji: **2026-10-15**
Baza kodu: **`f3b6905e` — main po PR #46**. Nie wykonywano ponownego audytu całej logiki biznesowej; niezwiązane rozdziały zachowują wcześniejszy kontekst.

## Po co jest ten plik

Ten dokument ma być krótką, aktualną odpowiedzią na pytanie: **„jak program działa dzisiaj i co jest już zrobione?”**. Nie zastępuje historii w `DEV.md` ani szczegółowych kontraktów w `CLOUD_MIGRATION.md`, `QUOTE_CALCULATION_REGISTER.md`, `BACKUP.md` i `DEPENDENCY_MAP.md`.

Przy kolejnych pracach najpierw czytać ten plik i `ROADMAP.md`. Historyczne wpisy w `README.md`/`DEV.md` traktować jako tło, a nie automatycznie jako listę rzeczy nadal do zrobienia.

---

## 1. Skala i architektura

Aplikacja przeglądarkowa bez frameworka/bundlera, moduły classic-script w `window.FC`, publikacja statyczna. Na bazie main po PR #46: **824 śledzone pliki**, **524 JS**, **261 Markdown**, **394 domenowe JS** w audycie zależności, **318** skryptów index.html i **346** dev_tests.html. CLOUD-1A dodaje jeden dokument rejestru; liczby odnoszą się do bazy.

Projekt jest jednym fizycznym rekordem `fc_projects_v1`, z investorId i wieloma pokojami w projectData. Lista pomieszczeń inwestora jest powiązaną projekcją. RAM to stan roboczy, nie drugie trwałe źródło prawdy. `derivedFacts` jest odtwarzalnym cachem usuwanym z kopii do zapisu.

## 2. Kontrola składni i zależności

Aktualny preflight obejmuje składnię wszystkich JS, load order, wszystkie `tools/*-smoke.js`, audyt zależności i storage. Ponowne uruchomienie dla CLOUD-1A: **PRE-FLIGHT PASS**, składnia **524/524**, load order **318**, smoke **118/118**, APP **110/110**, dependency/storage PASS. Szczegóły w [rejestrze](CLOUD_DATA_REGISTER.md#9-dowód-pokrycia-audytu-i-weryfikacja).

Wysokie ryzyko nadal dotyczy persistence/sesji, WYCENY/historii, katalogów i ROZRYSU; RYSUNEK pozostaje osobnym długiem, bez refaktoru w CLOUD-1A. `TEST_BASELINE.md` opisuje także dawną paczkę i nie zastępuje aktualnego wyniku preflightu.

## 3. Testy i ukończone fundamenty

Nie obowiązuje już stary baseline 66/76 z 10 FAIL. W main są pełny preflight i CI, zabezpieczenia C3.1 globalnych zapisów, pokojowa sesja/nawigacja C2.0b, bezdestrukcyjny odczyt wyjątków C2.1a, stabilne role/grupy formatek i geometria frontów, projektowe PCV oraz adaptery obliczeń i ochrona nowego kandydata oferty.

PR #40 uruchomił UI PCV; #43 automatyzował tryb projektu; #45 przywrócił wspólne Opcje; #46 naprawił fałszywy konflikt updatedAt po autosave. Są **scalone**, nie otwarte propozycje. Diagnostyka i symulowany DOM nie dowodzą ręcznej akceptacji na telefonie. Użytkownik obecnie ręcznie testuje Androida; tablet/komputer pozostają platformami docelowymi.

Regresje referencyjne: **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, jeden zapas PCV 10%, wielopomieszczeniowy rozkrój **4 / 3 / 6 arkuszy**. Historyczne oferty A/B/A+B zachowują własny zakres i zamrożone wyniki.

## 4. Dane i przygotowanie do chmury

Kanoniczna mapa: [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md), zasady etapów: [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md). Aktualny audyt to **339** referencji w **41** plikach: **204** test/tooling, **135** poza testami (32 pliki). Mapa obejmuje **46 stałych nazw + 3 dynamiczne rodziny**; to nie liczba wpisów w urządzeniu użytkownika.

- Zapis projektu: durable begin + saveConfirmed + read-back; active owner **projectId + roomId**. Zapis/rollback nie może cofać innego pokoju/projektu. Niepotwierdzona rewizja blokuje kolejne operacje, bez nadpisywania centralnego rekordu starym RAM.
- Nowy projekt od początku używa `projectData.meta.productionPcvMode='project'`; istniejący testowy przechodzi przy bezpiecznym otwarciu. Brak aktywacyjnego przycisku/dialogu i importu globalnych krawędzi. Decyzje PCV są w `projectData[roomId].production`, z niezależnymi rolami elementów/grup i setId.
- Słoje nadal globalne (`fc_material_part_options_v1`), a ROZRYS ma globalne enabled/exceptions. To decyzje produkcyjne z nierozstrzygniętą własnością, nie dowolnie usuwalny cache. Issue #47 dotyczy ich przyszłej przebudowy. `fc_rozrys_overrides_v1` ma dormant API, bez znalezionego aktualnego konsumenta.
- Globalne cenniki, katalogi, słowniki, stawki, magazyn i ustawienia są chronione, zgodne wstecz i **poza pilotem**. C3.1 nie daje automatycznie gwarancji confirmed write wszystkim pozostałym store.
- CLOUD-1A tylko dokumentuje dane. **Nie wdrożono Firebase/Firestore, loginu, selektywnego eksportera ani synchronizacji.** Pierwszy planowany pilot to jeden testowy inwestor i jeden fizyczny projekt z pokojami/szafkami/PCV. Bez globalnych słojów/katalogów/cenników, ofert, sesji/cache/kopii/sekretów; nie jest pełnym przenoszeniem aplikacji.
- Obecny pełny backup fc_* nie jest pilot payloadem: może zawierać ORS apiKey profilu firmy i pomija nieprefiksowane aliasy katalogów. Bez zmian mechanizmu/retencji; rozdzielenie i filtrowanie eksportu wymaga kolejnego zakresu.

Pełny kontrakt CLOUD-1 z 15.10.2026 nie jest osobnym plikiem w odczytanym repo. Potwierdzone granice bieżącego polecenia są zapisane w rejestrze; szczegóły CLOUD-1B/2A/B/C, finalny Firestore i metoda loginu pozostają do potwierdzenia. `PROJECT_DECISIONS.md` nadal jest w Draft PR #41; tu nie tworzymy konkurencyjnego rejestru, a propozycja wpisu jest w rejestrze danych.

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

Nie należy teraz robić dużego refaktoru WYCENY. Zielony baseline już istnieje; brakujące elementy matematyki wymagają osobnej decyzji, bez zmian przy dokumentacji chmury.

---

## 6. MATERIAŁ / ROZRYS

Projektowe PCV jest wspólnym źródłem krawędzi i metrów dla normalnego MATERIAŁU, ROZRYSU i WYCENY. Resolver rozlicza osobno lewy/prawy bok oraz grupy półek i frontów przed agregacją; planKey i placements zachowują różne krawędzie identycznych części. Projektowy tryb omija trwały legacy cache planu.

Jedno **Opcje → Opcje formatki → Zapisz** zachowuje oryginalną proporcjonalną mapę, PCV i globalne słoje. Koordynator chroni oba zapisy/draft i nie potwierdza częściowego sukcesu. PR #46 pomija jedynie updatedAt rekordu w lokalnym świadku, zachowując prawdziwe konflikty i kody błędów. Przelicz projekt pozostaje.

Otwarta pozostaje własność globalnych słojów/rotacji, część źródeł z sourceIssues i dalsze funkcje odłożone. D1–D6 nie są zbiorczo zamknięte przez projektowe PCV. Historyczne plany OPTIMIZATION_PLAN nie oznaczają ponownej implementacji już scalonych elementów.

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

Po PR #44 `preflight-js.yml` uruchamia pełny preflight przy jawnym **Draft → Ready** (oraz na ręczne workflow_dispatch). Automatyczny merge jest ograniczony do zaakceptowanego, niezmienionego head/base po PASS; po merge jest kontrola Pages konkretnego commita. Draft sam nie uruchamia tej ścieżki scalenia. CLOUD-1A nie wykonuje Ready, merge ani publikacji. To opis konfiguracji, nie deklaracja wykonania nowego CI w tym zadaniu.

---

## 16. Zasada pracy od teraz

Przed zmianą programu:

1. opisać problem i proponowany zakres,
2. wskazać ryzyko i testy,
3. nie zmieniać niczego przed komendą użytkownika **„do dzieła”**,
4. po zatwierdzeniu robić możliwie mały diff,
5. po zmianie uruchomić testy obszaru i baseline,
6. przygotować Draft PR/raport, a decyzję o Ready/merge/publikacji pozostawić użytkownikowi.

Najbliższy etap po akceptacji CLOUD-1A: **CLOUD-1B**, wyłącznie na osobne polecenie. Kolejność dalsza: CLOUD-2A → CLOUD-2B → CLOUD-2C; szczegóły do potwierdzenia pełnym kontraktem.

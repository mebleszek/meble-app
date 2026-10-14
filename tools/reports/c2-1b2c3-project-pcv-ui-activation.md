# C2.1b.2c.3 — projektowe PCV w normalnym interfejsie

Baza: `c4caae4d6dc6a938a058aa3b46fff78d0ccc09ba`, main po PR #39.

## Trwała aktywacja i bezpieczeństwo

Jedyną trwałą decyzją jest `projectData.meta.productionPcvMode = 'project'` w istniejącym fizycznym rekordzie `fc_projects_v1`. Dotyczy całego tego projektu, również jego pozostałych pomieszczeń. Normalizacja i przygotowanie danych do zapisu zachowują metadane; nie zmieniono wersji projektu ani kluczy storage. Brak markera zachowuje legacy. Nie ma automatycznej aktywacji, importu ani przełącznika powrotnego.

MATERIAŁ pokazuje przycisk „Włącz projektowe PCV”. `FC.projectPcvPolicy.requestActivation()` najpierw otwiera istniejący confirmBox z przyciskami Anuluj / Włącz projektowe PCV i informacją, że globalne nadpisania nie zostaną przeniesione ani usunięte. Odmowa niczego nie zapisuje. Następnie istniejąca kontrola nawigacji kończy sesję: czysta sesja zostaje bezpiecznie zamknięta, zmieniona wymaga decyzji Zapisz / Anuluj zmiany / Wróć do edycji. Niepotwierdzona sesja blokuje aktywację.

`activate(expected)` ponownie sprawdza fizyczny projekt, inwestora, rekord centralny, zgodność RAM i brak otwartej sesji. Zmiana markera powstaje na kopii świeżego rekordu, przez `saveConfirmed(next, {expectedRecord})`, poza zapisem ograniczonym do pokoju. Pełny read-back oraz ponowna kontrola wskaźników muszą potwierdzić sukces przed przyjęciem wyniku do RAM. Po aktywacji w edytorze `prepareEditState(ui, true)` tworzy nową trwałą sesję, której baseline zawiera już marker. Nie zapisuje ponownie projektu.

Zwykły failed save zachowuje poprzedni tryb i RAM. Niepewny read-back lub częściowy zapis uruchamia istniejącą blokadę `markUnconfirmedProjectWrite()` i zwraca `projectSaved:true`. UI informuje, że dane mogły zostać zapisane, lecz sesji nie potwierdzono i dalszy zapis został wstrzymany. Nie ma automatycznego Cancel, kompensacji, resetu snapshotu ani ślepego przeładowania. Niskopoziomowe API aktywacji jest przeznaczone dla zweryfikowanych wywołań; normalny interfejs zawsze używa ścieżki potwierdzenia.

## Jedna polityka dla trzech modułów

Nowy mały moduł `project-pcv-policy.js` ustala fizyczny projekt i właściciela inwestora, porównuje marker RAM/centralny, weryfikuje istniejącą bramkę sesji, a w trybie projektowym także semantyczną zgodność przygotowanych danych RAM z centralnymi. Istniejące odtwarzalne derivedFacts nie stają się drugim źródłem prawdy. Do edycji sprawdzany jest dodatkowo aktywny pokój i właściciel sesji.

`read()` zwraca diagnostykę lub politykę; `calculationOptions()` przekazuje `{pcvMode:'project', projectId}` do istniejącego resolvera. Niezgodny marker, brak fizycznego projektu, stary RAM albo niepotwierdzona sesja nie mogą spowodować cichego wyboru legacy. Pole diagnostyczne `projectModeRequired` pozwala odróżnić odmowę dla projektu aktywowanego od starej ścieżki naprawy kontekstu legacy. Jawne wywołania adapterów projektowych bez markera pozostają dostępne dla wcześniejszych izolowanych testów; zwykłe UI zawsze rozstrzyga przez marker.

Nie dodano kalkulatora PCV, cache frameworka, magazynu ani bezpośredniego zapisu ustawień przez UI do localStorage.

## MATERIAŁ: właściciele, grupy i osobny zapis

Normalny renderer oraz oba collectory materialTabData pobierają wspólną politykę. Projektowy agregat jest liczony przez istniejący `projectPcvResolver`, przed technologicznym łączeniem wyników. Dla widoku wkłady są rozdzielane istniejącym `withQuantity(..., {skip})`, z zachowaniem fizycznego ledgera. Nie zapisuje się tej listy ani sourceRefs/sourceGroups w projekcie.

- Lewy i prawy bok mają oddzielne wiersze i niezależne adresy `body.side.left` / `body.side.right`.
- Półki ×3 lub ×5 pozostają jednym adresem grupy, z właściwą ilością.
- Mały front oraz grupa dwóch dużych frontów pozostają osobne.
- Grupy frontów zestawu mają rzeczywistego właściciela setId.
- Identyczne szafki zachowują różne cabinetId i ustawienia.

Akcja PCV otwiera mały wariant istniejącego PanelBox i mapy formatki. Odczyt korzysta z `projectPcvOverrides.get()`, w tym kopii technologicznych defaultów. Oznaczenia pozostają 1A/w1, 1B/w2, 2A/h1, 2B/h2. Przed zapisem ponownie sprawdzane są polityka, właściciel oraz niezmienione ustawienie bazowe otwartego draftu. Używane są wyłącznie `setEdges()` albo `clearEdges()`.

„Przywróć domyślne PCV” przygotowuje lokalny draft technologicznych defaultów; dopiero Zapisz usuwa nadpisanie wskazanego właściciela. Inne krawędzie, pokoje i ustawienia słojów pozostają nietknięte. Cancel lokalnego okna nie zapisuje. Semantic no-op respektuje istniejący kontrakt API.

Okno zamyka się dopiero po potwierdzonym sukcesie. Failed begin, failed save, konflikt i niejednoznaczna geometria zachowują draft. Ponowienie początkowego failed begin jest możliwe wyłącznie dla tej samej niedurable sesji/właściciela; nie omija blokady już trwałej, częściowo zapisanej sesji. `projectSaved:true` otrzymuje komunikat częściowego zapisu, także przy kolejnej odmowie przez politykę.

Projektowy widok pokazuje metry z dokładnością trzech miejsc; legacy zachowuje dotychczasową prezentację. Błąd renderowania usuwa nieaktualną zawartość i pokazuje diagnostykę, zamiast podstawiać 0 mb.

## Rozdzielenie PCV i słojów

Projektowy edytor PCV nie ma zapisu słojów. Oddzielna akcja „Słoje (globalne)” otwiera istniejącą obsługę kierunku z nieedytowalnymi krawędziami. Nie zapisuje PCV. Dotychczasowy mieszany modal nadal działa dla projektu legacy.

Legacy setter krawędzi i zapis mieszanego draftu dodatkowo odmawiają, jeśli bieżąca polityka jest projektowa lub niepotwierdzona. Chroni to również modal otwarty przed aktywacją. Sama edycja projektowych krawędzi nie zapisuje `fc_edge_v1`, `fc_material_part_options_v1` ani `fc_rozrys_grain_state_v1`.

## Prawdziwy ROZRYS

Normalne `render()` i odczyt agregatu przekazują politykę do istniejącego łańcucha zakres → render compose → run controller → runner → engine bridge → silnik synchroniczny / Optimax. Zmiana pomieszczeń i materiału ponownie odczytuje agregat. Błąd polityki lub źródeł czyści nieaktualny wynik, zgłasza odmowę i nie pozwala używać poprzedniej selekcji.

Runner dodatkowo odrzuca stary launcher legacy pozostawiony przed aktywacją, zanim ten odczyta legacy cache. W projektowym trybie pozostają zabezpieczenia C2.1b.2c.2: brak trwałego cache, projektowy planKey, dokładny ledger i qty po magazynie arkuszy, sourceRefs/sourceGroups/effectivePcv na placements, kontrola świeżości renderu i eksportu. Awaria transportu może korzystać z dotychczasowego bezpiecznego silnika z tym samym kontekstem; błąd PCV nigdy nie przechodzi na globalne krawędzie.

Nie zmieniono reguł słojów, obrotu, optymalizatora, geometrii ani odejmowania PCV w CSV. Testy zwykłego launchera obejmują rzeczywiste placements, canvas payload, listę i dane CSV; regresje adapterów obejmują stock, ledger oraz chronione wejścia wydruku. Faktyczny wydruk w przeglądarce pozostaje do ręcznej akceptacji.

## Prawdziwa WYCENA i historia

Zwykły przycisk generowania oferty wybiera wspólną politykę, następnie istniejące `collectQuoteData()` → getSelectedAggregate → collectMaterialLines → resolver i plan materiałowy. Źródło WYCENY również używa polityki, więc alternatywne rzeczywiste wejścia nie zgadują trybu. Dotychczasowa naprawa kontekstu pozostaje dostępna dla legacy; aktywowany projekt nie może w jej trakcie utracić przypiętego projectId ani przejść na legacy.

Kandydat zachowuje dotychczasowy proof kalkulacji. Zmiana PCV podczas dialogu duplikatu blokuje replace; zmiana projektu, rewizji lub zakresu wymaga nowej kalkulacji. Dodatkowa bramka snapshot store blokuje także niezapisany kandydat legacy zbudowany przed aktywacją. W aktywowanym projekcie obiekt bez projektowego dowodu może być aktualizacją już utrwalonej historii tylko wtedy, gdy jego linie, sumy i scope pozostają zamrożone. Zmiana nazwy/metadanych istniejącej wersji nie przelicza jej cen. Odczyt historii, porównanie i eksport nie wymagają aktualnego proofu projektu.

Pozostają wyłącznie dwie dotychczasowe kategorie cenowe: standard/pod kolor płyty i pod kolor frontów. Nie dodano trzeciej stawki, porównywania dekorów ani pól kolorów. Zapas 10%, ceny jednostkowe, zaokrąglenia i dokładne zakresy ofert pozostają bez zmian.

## Wyniki i weryfikacja

Testy używają izolowanego MemoryStorage oraz rzeczywistych modułów projektu, sesji, generatorów, resolvera, rendererów, ofert i optymalizatora. DOM i transport workera są małymi fixture; transport wykonuje rzeczywisty kod workera. Żaden test nie działał na danych użytkownika.

- Dwa korpusy: default **16,440 mb**, dodatkowa krawędź lewego boku **17,122 mb**, jeden zapas **18,834 mb**. Przy istniejącej stawce fixture 3 zł/mb: **56,50 zł**.
- Fronty 600 × 139/283/283 mm: **5,010 mb**, z jednym zapasem **5,511 mb**. Przy stawce fixture pod kolor frontu 5 zł/mb: **27,56 zł**.
- Zakresy A / B / A+B: **17,122 / 8,220 / 25,342 mb**, trzy niezależne historyczne snapshoty.
- Niezależna referencja rzeczywistego rozkroju: **4 / 3 / 6 arkuszy**, bez zmiany algorytmu.

Nowy `project-pcv-ui-activation-smoke.js`: **44/44 PASS**, również w końcowym preflight. Obejmuje rzeczywiste potwierdzenie aktywacji, lokalne przyciski PCV, normalny ROZRYS i zwykły przycisk WYCENY, odmowy, ponowienie, restart, Cancel, P1/P2/P3, nieaktualny kandydat, dane chronione bajtowo oraz czystość odczytu.

`project-owned-pcv-smoke.js`: **33/33 PASS**. Końcowy pełny preflight: **116/116 smoke PASS, APP 110/110 PASS, składnia 522/522 PASS**, kolejność ładowania 318, audyty zależności i storage PASS. Bezpośrednie regresje zgodnie z AGENTS.md: sesja niepotwierdzona **30/30 PASS**, adaptery **27/27 PASS**, bezpieczeństwo danych globalnych **30/30 PASS**, wielopomieszczeniowa kalkulacja **PASS, 4/3/6**. Osobne `node --check` zmienionych i nowych plików JS: **24/24 PASS**. `git diff --check`: **PASS**.

Podczas weryfikacji poprawiono brak wpisu nowego modułu w konfiguracji load groups oraz zbyt szeroką odmowę zapisu historycznej fixture legacy podczas naprawy kontekstu. Odmowy dla aktywowanego projektu pozostają obowiązkowe. Stara statyczna asercja zakazująca każdego `.setEdges()` została zawężona do legacy settera; test nadal zabrania inline edycji checkboxów i zachowuje asercje zachowania. Pozostałe aktualizacje starych fixture dotyczą wersji cache-busting skryptów. Nie zmieniono oczekiwanych metrów, cen ani wyników rozkroju.

## Zmienione pliki

- Nowe `js/app/project/project-pcv-policy.js` — odczyt polityki, aktywacja i komunikaty odmowy.
- `js/tabs/material.js`, `js/app/material/material-tab-data.js` — normalny wybór polityki, właściciele w widoku i rzeczywisty odczyt metrów.
- `js/app/material/material-part-options.js`, `js/app/material/material-edge-store.js` — rozdzielenie zapisu i odmowa globalnego PCV w aktywowanym kontekście.
- `js/app/project/project-pcv-overrides.js` — addytywny zwrot kopii defaultów do lokalnego resetu.
- `js/app/rozrys/rozrys.js`, `js/app/rozrys/rozrys-runner.js` — normalny launcher, odmowy i blokada starego cache.
- `js/app/wycena/wycena-core.js`, `js/app/wycena/wycena-core-source.js`, `js/app/wycena/wycena-tab-shell.js` — normalny orchestrator i przycisk generowania.
- `js/app/quote/quote-snapshot-store.js` — ochrona kandydatów po aktywacji, bez przeliczania historii.
- `index.html`, `dev_tests.html`, `js/app/rozrys/rozrys-lazy-manifest.js` — kolejność i wersje zmienionych assetów.
- `tools/app-dev-smoke-lib/file-list.js`, `tools/index-load-groups.js` — rejestr nowego modułu.
- `tools/project-pcv-ui-activation-smoke.js` — nowe 44 scenariusze integracyjne, automatycznie odkrywane przez preflight.
- `tools/project-calculation-adapters-smoke.js` — udostępnienie izolowanego fixture i aktualizacja wersji assetów.
- `tools/material-part-active-editor-smoke.js` — asercja braku legacy edycji w tabeli.
- `tools/app-dev-smoke.js`, `tools/wycena-snapshot-clean-store-smoke.js`, `tools/wycena-duplicate-offer-guard-smoke.js`, `tools/wycena-generate-action-registry-smoke.js`, `tools/wycena-generate-single-flow-smoke.js`, `tools/wycena-orphan-edit-session-cleanup-smoke.js` — aktualizacja oczekiwanych URL zmienionych skryptów.
- Ten raport.

## Ograniczenia i ryzyka

Nie zmieniono modelu sesji, rollbacku, bridge/store projektu, cen, geometrii, katalogów, backupów ani formatu ofert. Nie resetowano, nie importowano ani nie usuwano globalnych danych. Trzy istniejące magazyny formatek/słojów pozostają zachowane.

Nieprzełączone projekty nadal mają znane kolizje globalnego PCV. Globalne słoje i rotacja nadal nie mają pełnej własności projektowej; D1–D6 nie są deklarowane jako całkowicie zamknięte. Nierozstrzygnięte sourceIssues, niepoprawny front lub niepełny właściciel odmawiają obliczenia, zamiast otrzymać przypadkowe PCV.

Zmiana wyłącznie w RAM może konserwatywnie zablokować projektowy odczyt do potwierdzonego zapisu lub anulowania edycji. Częściowy zapis zachowuje centralne dane i draft, ale nie ma automatycznego bezpiecznego uzgadniania każdej awarii. Dowód niezapisanej oferty nie przetrwa restartu i wymaga nowej kalkulacji. localStorage nie zapewnia atomowego compare-and-swap między kartami; obecne kontrolowane read-back i rewizje nie są transakcją chmurową.

Test DOM nie zastępuje ręcznej akceptacji telefonu, canvas, dialogów i rzeczywistego wydruku. Nie wykonano testu na produkcyjnych danych użytkownika. Nie wykonano Ready, merge ani publikacji.

## Ręczna akceptacja po scaleniu — tylko projekt testowy

1. Utwórz osobnego testowego inwestora i projekt. Nie aktywuj trybu w prawdziwym zleceniu. Najpierw potwierdź, że projekt bez markera pokazuje dotychczasowe ustawienia legacy.
2. Otwórz MATERIAŁ, kliknij „Włącz projektowe PCV”, sprawdź ostrzeżenie o braku importu. Pierwszą próbę anuluj i upewnij się, że tryb się nie zmienił. Następnie potwierdź; jeśli są zmiany, świadomie wybierz istniejące Zapisz lub Anuluj w dialogu zakończenia sesji.
3. Dodaj dwie identyczne standardowe szafki. Zapisz parametry i sprawdź, że istnieją oddzielne boki Lewy/Prawy oraz wspólne grupy półek. Nie dodawaj indywidualnych slotów ani niestandardowych frontów.
4. W PCV lewego boku pierwszej szafki włącz dodatkową 1B i kliknij Zapisz. Sprawdź, że prawy bok i obie strony drugiej szafki nie zmieniły się. Ponownie otwórz pierwszy bok i potwierdź ustawienie.
5. Wypróbuj lokalny Cancel bez zapisu. Następnie „Przywróć domyślne PCV” + Zapisz, sprawdź default i ponownie włącz wybraną krawędź. Odrębne „Słoje (globalne)” nie powinny umożliwiać zmiany PCV.
6. Zapisz globalną sesję, wyjdź, zamknij i ponownie uruchom aplikację. Otwórz ten sam projekt: marker i projektowe ustawienie muszą pozostać. Drugi projekt testowy bez aktywacji nadal ma legacy.
7. Porównaj sumę MATERIAŁU przed/po. Dla referencyjnych dwóch korpusów fixture wynosi 16,440 → 17,122 mb; dodatkowa krawędź ma 682 mm, czyli +0,682 mb. Jeśli testowe szafki mają inne rzeczywiste wymiary lub ilości, porównaj przyrost z rzeczywistą długością tej krawędzi, zamiast wymuszać liczby fixture.
8. Przejdź do ROZRYSU przez potwierdzone zakończenie sesji. Wybierz pomieszczenia i materiał, kliknij Generuj. Sprawdź zwykły silnik oraz Optimax, przy dostępnych arkuszach także magazyn. Lewy i prawy bok muszą zachować własne flagi. Porównaj planszę, listę formatek, CSV i rzeczywisty wydruk/PDF.
9. W WYCENIE użyj zwykłego przycisku generowania. Sprawdź aktualną stawkę z własnego istniejącego cennika i tylko jeden zapas 10%. Referencja 17,122 mb daje 18,834 mb po istniejącym zaokrągleniu. Kwota zależy od cennika, nie od zaszytej nowej ceny.
10. Opcjonalna referencja szuflad: korpus 720 mm, szerokość frontów 600 mm, standard 3_1_2_2 i wszystkie krawędzie — fronty 139/283/283 mm, surowo 5,010 mb, po zapasie 5,511 mb. Uwzględnij nóżki tak, aby rzeczywisty korpus miał 720 mm.
11. Porównaj A, B i A+B, zapisz osobne oferty testowe. Otwórz starą ofertę po kolejnej zmianie PCV: jej zapisane wartości mają pozostać niezmienione. Przy zmianie danych podczas dialogu duplikatu nowy zapis ma zostać odrzucony i wymagać świeżej kalkulacji.

Po akceptacji nie wykonuj automatycznego importu starych globalnych nadpisań. Decyzja o dalszym modelu słojów pozostaje osobnym etapem.

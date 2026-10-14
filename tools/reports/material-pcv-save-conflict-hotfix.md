# PCV Save / PROJECT_WRITE_CONFLICT — hotfix po PR #45

Baza: `b1e99d60` (main po scaleniu PR #45). Testy wykonano na izolowanym MemoryStorage i symulowanym DOM; nie na danych użytkownika ani fizycznym Androidzie.

## Potwierdzona przyczyna A i B

Oba objawy mają wspólne źródło. `project-autosave.js` nasłuchuje kliknięć w fazie capture na appView. Kliknięcie przycisku **Opcje** w liście MATERIAŁU kwalifikuje się do autosave, zanim panelBox zostanie otwarty. Wykluczenie `.panel-box` chroni późniejsze kliknięcia wewnątrz okna, ale nie pierwotny launcher. Rozwinięcie szafki również może zaplanować taki zapis.

Zaplanowany autosave wywołuje istniejące `FC.project.save(projectData)`. Potwierdzony zapis identycznych danych zmienia pole **rekordu** `updatedAt` w `project-bridge.js`. Nie zmienia `projectData`, właściciela ani geometrii. Sesja pozostaje trwała, a `inspectNavigationState()` potwierdza ją poprawnie.

PR #45 porównywał pełny JSON rekordu dla `renderedRecord`, `openedRecord` i `validate()`. Sama zmiana updatedAt powodowała fałszywy `PROJECT_WRITE_CONFLICT`:

- A: zapis lokalnego draftu odmawiał już w pierwszym `editor.validate()`, przed zapisem PCV lub słojów. Komunikat koordynatora nie zawierał kodu, dlatego użytkownik widział zwykłe „nie zapisano”.
- B: ponowne kliknięcie tego samego aktualnego wiersza odmawiało, ponieważ jego świadek z renderowania miał poprzedni updatedAt. Wystarczał czysty Open → autosave → Wyjdź → Open. Nie jest potrzebny wcześniejszy failed begin ani częściowy zapis.

W odtworzonym przypadku nie zmienia się reprezentacja danych przez normalizację; jedyną różnicą rekordu jest updatedAt. Awaria rewizji sesji pozostaje osobnym, prawidłowo blokowanym przypadkiem.

## Dokładna reprodukcja i luka dawnego fixture

1. Uruchomić rzeczywiste store, bridge, session, PCV policy/API/resolver i MATERIAŁ na dwóch projektach z niezależnymi pokojami/szafkami.
2. Otworzyć pokój poprzez istniejący lifecycle, potwierdzić projektowe PCV i trwałą sesję.
3. Zainstalować rzeczywisty `projectAutosave.installProjectAutosave()` na appView.
4. Przekazać kliknięcie rzeczywistego Options button najpierw do capture listenera, potem do launchera modala.
5. Wykonać zaplanowany callback autosave (180 ms) ze sterowanym zegarem; wykazać różnicę wyłącznie updatedAt, identyczne projectData i poprawny dowód sesji.
6. A: zaznaczyć 2B i nacisnąć Zapisz. B: bez zmian kliknąć Wyjdź i ponownie ten sam wyrenderowany Options button.

Dawny MiniDocument nie propaguje zdarzeń w capture i nie ma closest(); zwykłe `.click()` omijało autosave. Helper testowy uzupełnia wyłącznie te zdolności DOM i sterowanie czasem. Nie zastępuje setterów, storage ani sesji stubami sukcesu. Ponowne otwarcie bez wymuszonego rerenderu jest sprawdzane osobno; wcześniejsze helpery zwykle renderowały listę tuż przed każdym otwarciem.

## Minimalna poprawka

- Jedna lokalna funkcja `projectRecordFingerprint()` w material.js pomija wyłącznie **updatedAt rekordu**. Ten sam świadek obowiązuje render, otwarcie, walidację i ocenę niepewnego wyniku.
- Właściciel, investorId, projectData wszystkich pokojów, PCV, geometria, status, title, createdAt, summary i pozostałe meta nadal uczestniczą w porównaniu. Zmiana rzeczywistych danych nadal wymaga świeżego widoku/draftu.
- Nie zmieniono autosave, setterów, projectStore, confirmed save, optimistic expectedRecord ani trwałego dowodu sesji. Setter nadal używa aktualnego rekordu w istniejącej warunkowej operacji zapisu.
- Zwykła odmowa i niepotwierdzony/ częściowy zapis dopisują faktyczny kod do istniejących komunikatów. Przykłady: SAVE_FAILED, PROJECT_WRITE_CONFLICT, SESSION_UNCONFIRMED. Okno i draft pozostają przy błędzie.
- index.html aktualizuje wyłącznie wersje URL trzech zmienionych skryptów, aby telefon pobrał poprawkę.

Nie ma opóźnień, automatycznego retry, bezwarunkowego odświeżenia, resetu, migracji ani obejścia guardów.

## Testy i stan danych

Przed zmianą produkcji: rozszerzony material-part-project-save-smoke **22/25 PASS**. Nowe testy czystego ponownego otwarcia, Save po capture autosave i kodu diagnostycznego były FAIL. Dotychczasowe 21 testów oraz odmowa rzeczywistej konkurencyjnej zmiany przechodziły.

Po poprawce:

- material-part-project-save-smoke: **26/26 PASS** — PCV-only, grain-only, wspólny Save, czysty Exit/reopen, aktualny DOM po Save, restart z ponownym otwarciem okna, failed save/retry, rzeczywisty writer, title/status/createdAt/meta nadal chronione. Dotychczasowe begin, compensation, read-back, failed revision, unsafe global Cancel i izolacja właścicieli pozostają sprawdzane.
- material-part-active-editor-smoke: **29/29 PASS** — oryginalna mapa, kontrolki, zachowany draft i kod błędu.
- project-pcv-ui-activation-smoke: **60/60 PASS** — rzeczywiste wejścia MATERIAŁ → ROZRYS → WYCENA, dane produkcyjne i historia.
- project-pcv-auto-open-smoke: **12/12 PASS**, także prawdziwy app.js i działający Przelicz projekt.
- project-session-unconfirmed-save-safety-smoke: **30/30 PASS**, P1/P2/P3 nadal bezpieczne.
- global-data-write-safety-smoke: **30/30 PASS**.
- multiroom-calculation-session-safety-smoke: **PASS**, referencja **4 / 3 / 6 arkuszy**.
- Kontrolne metry pozostają **16,440 → 17,122 → 18,834 mb**; fronty **5,010 → 5,511 mb**. Ceny i jeden zapas 10% niezmienione.

Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS**, smoke **118/118**, APP **110/110**, składnia **524/524**, kolejność skryptów **318**, audyty zależności i storage PASS. Osobny `node --check` wszystkich sześciu zmienionych JS oraz `git diff --check`: **PASS**.

## Pliki i pozostałe ryzyka

Zmiany: `js/tabs/material.js`, `js/app/material/material-part-options.js`, `js/app/project/project-pcv-policy.js` (wyłącznie kod w komunikacie), `index.html` (cache-busting); trzy odpowiednie smoke i niniejszy raport.

Nie zmieniono wyglądu, mapy, nazw i liczby przycisków, matematyki PCV, cen, geometrii, słojów ani historii ofert. Testy chronią byte-identyczne globalne magazyny i niezależne adresy PCV; nie dotknięto danych użytkownika.

Niezmienione ograniczenia: globalna tożsamość słojów i blokada UNSCOPED_PART_ROLLBACK_BLOCKED, brak atomowego CAS localStorage pomiędzy kartami, odmowa niepotwierdzonej sesji zamiast automatycznego recovery. Istniejący autosave nadal może wykonać zbędny zapis bez zmian; ten hotfix naprawia jego fałszywy konflikt bez przebudowy autosave.

Po świadomym scaleniu użytkownik powinien sprawdzić na testowym projekcie w Androidzie: czyste Options → Wyjdź → Options; dodatkowa 2B lewego boku → Save → ponowne Options; osobno słoje i wspólny Save. Prawy bok i druga szafka muszą zachować własne PCV. Symulowany DOM nie zastępuje tej ręcznej akceptacji.

# RAM/PCV i „Wyceń” — naprawa po Androidzie, 2026-10-18

Baza: aktualny `main` `4d8dd96df9f293276dee07dc0c4cedf26edac08c` po PR #63,
drzewo `c3e7859716a35329976a20203930275e4f50447c`. Gałąź: `fix/pcv-ram-quote-generate-android`.
Oryginalny starszy checkout `work` pozostał czysty i nietknięty. Izolowany checkout odtworzono
z weryfikacją blobów/trybów i drzewa GitHuba; zaimportowano także dokładny oryginalny obiekt
podpisanego commita, potwierdzając jego SHA. Nie utworzono zastępczej bazy.

## Potwierdzona przyczyna RAM/PCV

`app.js` deklaruje globalne leksykalne `let projectData`. W classic scripts to nie jest
właściwość `window.projectData`. Otwieranie projektu ustawiało obie nazwy na ten sam obiekt,
ale `saveConfirmed`/normalizacja zwracają nowy obiekt. Finalizacja szafki, autosave i globalny
Zapisz przypisywały go do wiązania leksykalnego; część konsumentów nadal czytała starsze `window`.
Po kolejnej edycji zapis i edytor miały np. 65 cm, podczas gdy PCV widziało 60 cm.
Porównanie PCV prawidłowo odmawiało — to publikacja RAM była niespójna. Restart odczytywał rekord kanoniczny.

Naprawa: istniejące `window.projectData` jest getterem/setterem tego samego wiązania, utworzonym
bezpośrednio po jego inicjalizacji. Nie jest drugim store ani odświeżeniem z dysku. Przypisania
z obu stron wskazują aktualny draft, także przy failed write/read-back. Nic nie przyjmuje
niepotwierdzonej rewizji ani nie wykonuje commit/cancel. Kontrole `RAM_DIVERGENCE` nie zostały zmienione.

## Potwierdzone problemy przebiegu WYCENY

1. Gdy realny kolektor odmawiał kalkulacji zwykłym błędem (np. nieprawidłowa geometria odrzucona
   przez projektowy resolver PCV), shell ustawiał `lastQuote.error`, ale zachowywał wskazanie starego
   podglądu. `resolveDisplayedQuote()` preferował snapshot z historii lub ofertę wynikającą ze statusu
   i zastępował błąd starym wynikiem. Tylko błędy `quoteValidation` miały istniejący modal informacyjny.
   To odtwarza mechanizm „Liczę…” → stara oferta bez wyjaśnienia.
2. Autosave po 180 ms bezwarunkowo zapisywał bieżący projekt również wtedy, gdy wcześniejszy callback
   dochodził już w WYCENIE/ROZRYSIE. Nawet identyczny zapis zmienia `updatedAt` i może unieważnić świadek
   asynchronicznego obliczenia. Sam przycisk ROZRYSU jest poza `appView`; nie przypisujemy mu tego listenera.

Naprawa prezentacji: błąd nowego obliczenia ma pierwszeństwo przed automatycznym wyborem historii,
shell zeruje wskazanie historycznego podglądu, kieruje do wyniku i korzysta z istniejącego `infoBox`.
Ponowna poprawna kalkulacja lub świadomy wybór historycznej oferty nadal zastępują stan błędu.
Bez zmiany semantyki wersji, duplikatów i zamiany oferty.

Naprawa callbacku: autosave w zakładkach obliczeń kończy się bez zapisu, bez podmiany RAM i bez
zamykania sesji. Zwykły autosave w edycji pozostał. To nie wyłącza kontroli rewizji: prawdziwa zmiana
centralnego rekordu nadal przerywa kalkulację.

**Granica dowodów:** nie odczytywano danych telefonu. Nie ustalono, jaka konkretna przeszkoda kolektora
występowała w projekcie właściciela po restarcie. Potwierdzono rozdzielenie RAM oraz ukrywanie rzeczywistej
odmowy przez historyczny podgląd; poprawne syntetyczne projekty przechodzą realną ścieżkę generowania.
Nie deklarujemy odtworzenia każdej cechy prywatnego projektu ani ręcznej akceptacji Androida.

## Reprodukcje i trwałe regresje

`node tools/pcv-ram-quote-save-regression-smoke.js` używa rzeczywistych store/bridge/sesji,
PCV, finalizacji szafek, `app.js`, kolektora, snapshotów i resolvera historii, z izolowanym MemoryStorage.

- Aktywować A/room z projektowym PCV; załadować prawdziwy bootstrap i `app.js` (osobne wiązanie `let`).
- Edytować szafkę przez rzeczywisty draft/finalize, wywołać globalną akcję sesyjnego Zapisz, dodać dwie
  szafki przez istniejące klonowanie ostatnich ustawień. Porównać RAM i fizyczny rekord bez restartu,
  przeliczyć MATERIAŁ/PCV/agregat i odczytać storage w nowym runtime.
- Z zachowaną starą ofertą zapisać syntetyczną szafkę o zerowej szerokości. Rzeczywisty resolver
  odmawia; nowy błąd musi zostać wyrenderowany i wyjaśniony, a RAW historii musi pozostać identyczny.
- Osobno wywołać rzeczywisty opóźniony callback po przejściu do widoku obliczeń: zero zapisów,
  zachowany draft i payload sesji; powrót do edycji nadal pozwala na dotychczasowy autosave.
- Failed write, utrata rewizji sesji, failed read-back, obca rewizja właściciela, rzeczywista niezapisana
  dywergencja, inne pokoje/projekty i globalne RAW są objęte asercjami. Nie podstawiano sukcesu kalkulatora.

Przed aliasem: początkowy zestaw **1/6 PASS**; edycja ujawniała starsze `window`.
Przed poprawką renderu: rozszerzenie **6/7 PASS**, błąd kolektora był przykrywany historią.
Przed poprawką callbacku: **10/12 PASS**, oba kontrakty autosave były FAIL.
Końcowe wyniki poniżej obejmują wszystkie regresje, bez zamiany oczekiwanych porażek w PASS.

`node tools/pcv-ram-quote-mobile-browser.js` uruchamia Chromium w profilu tymczasowym, 393×851,
z dotykiem CDP. Bierze oryginalny business-template, style i kolejność skryptów z `index.html`;
oddzielny lokalny serwer pomija wyłącznie powłokę logowania, której to zadanie nie testuje.
CSP i przechwytywanie żądań blokują sieć zewnętrzną. Nie używa Firebase ani danych właściciela.
Sprawdza formularz edycji i przycisk zapisu, dodawanie/klonowanie, realne zakładki MATERIAŁ i ROZRYS,
pełne zakończenie rzeczywistego runnera (nie tylko canvas pierwszego materiału), mobilną akcję
`wycena-generate`, wybrany pokój, zapis i DOM oferty, drugą zmienioną ofertę, restart, widoczną odmowę,
odzyskanie po korekcie źródła i rzeczywisty dialog duplikatu. Porównuje stare snapshoty oraz globalne RAW.
`--baseline` serwuje oryginalne zmieniane moduły z zatwierdzonego commita i kończy się FAIL na rozdzieleniu
RAM po rzeczywistym formularzu Save; nie zmienia checkoutu. To automatyczny Chromium, nie fizyczny telefon.

## Zakres plików

- Runtime: `js/app.js`, `js/app/investor/project-autosave.js`,
  `js/app/wycena/wycena-tab-shell.js`, `js/app/wycena/wycena-tab-history.js`.
- `index.html`, `dev_tests.html`: wersja zmienionych, obecnych tam skryptów
  `20261018_pcv_ram_quote_fix`; kolejność bez zmian. `dev_tests.html` nie ładuje `app.js` z założenia.
- Dwa nowe runnery: `tools/pcv-ram-quote-save-regression-smoke.js`, `tools/pcv-ram-quote-mobile-browser.js`.
- Pięć dotychczasowych smoke: `wycena-duplicate-offer-guard`, `wycena-generate-action-registry`,
  `wycena-generate-single-flow`, `wycena-orphan-edit-session-cleanup`, `wycena-snapshot-clean-store`
  (wszystkie `tools/*-smoke.js`): wyłącznie dokładna nowa oczekiwana wersja URL shella.
- `tools/firebase-pilot/cloud42-source-pins.json`: aktualne SHA-256 wyłącznie czterech zmienionych
  plików runtime i indexu. Zachowano kompletność manifestu i historyczną bazę jego pochodzenia.
  Wynikowy pakiet operatorski ma inne związanie SHA i nadal wymaga osobnego przeglądu/zgód;
  stara aprobata nie uprawnia nowego pakietu. Rules, loader i odmowa LIVE bez zmian.
- `CURRENT_STATE.md`, `ROADMAP.md` i ten raport: bieżący stan gałęzi, bez przepisywania historii CLOUD.

## Weryfikacja końcowa

Końcowe wyniki na tym samym kodzie wykonawczym:

- Nowe regresje RAM/PCV/WYCENA/autosave: **12/12 PASS, 0 FAIL**.
- Chromium 151, emulowany mobilny viewport/dotyk: **10/10 PASS, 0 FAIL, 0 SKIP**;
  rzeczywiste kalkulatory, worker, zapis/DOM dwóch ofert, restart, odmowa i duplikat.
- `node tools/preflight.js`: **PRE-FLIGHT PASS**, **559/559** składni JS,
  **127/127** smoke, **331** pozycji load order; dependency i storage audit PASS.
  Czas końcowego przebiegu **93,128 s**; JS domenowe **412**, dev_tests **351** skryptów,
  odczytowy audyt storage **342** referencje w **42** plikach.
- `git diff --check`: PASS. Brak pominiętych istotnych regresji tego zakresu.
  Firebase SDK/emulatorów nie uruchamiano — brak zmian transportu, Auth, Rules lub Firebase.
  Wydaniowe GitHub Actions nie było uruchamiane; lokalny preflight nie jest deklarowany jako CI.

Testy celowane już potwierdziły: confirmed save **5/5**, trwały begin **10/10**,
unconfirmed safety **30/30**, auto-open **12/12**, PCV UI **60/60**, material save **26/26**,
global write safety **30/30**, context repair i diagnostyka PASS.
Referencje prawdziwego optymalizatora **4/3/6 arkuszy** i odrębnych historii A/B/A+B są zachowane;
PCV **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb** i jeden zapas 10% pozostają w regresjach.
Pierwszy preflight **122/127 smoke** zatrzymał się wyłącznie na pięciu starych literalnych wersjach URL.
Po ich ścisłej aktualizacji wszystkie pięć testów osobno jest PASS; asercji funkcjonalnych nie zmieniono.

## Dane, ograniczenia i krótki Android

Nie zmieniono modeli/formatów, reguł cen/PCV, formatek i optymalizatora, zakresów pokojów,
Zapisz/Anuluj, rekordów historycznych, katalogów/cenników/magazynu, backupów, UI/CSS ani nazw przycisków.
Nie ma migracji, resetu, nowych kluczy storage, automatycznego odzyskania niepotwierdzonej sesji,
Firebase LIVE, Rules/grantów/IAM, synchronizacji, PR, Ready, merge, wydaniowego CI ani Pages.
Ograniczenie localStorage (brak atomowego CAS między kartami) pozostaje. Znane prawdziwe konflikty
i niepotwierdzone zapisy nadal odmawiają; nie należy usuwać ich payloadów ręcznie.

Po osobno zatwierdzonym wydaniu na Androidzie, wyłącznie w projekcie testowym:

1. Zapisać zmianę szerokości, dodać dwie szafki i zapisać; bez restartu otworzyć MATERIAŁ/Opcje PCV.
2. W ROZRYSIE poczekać na cały wynik wszystkich materiałów; sprawdzić nowe szafki i ich wymiary.
3. W WYCENIE wybrać właściwe pokoje, użyć Wyceń i ewentualnie nadać nazwę nowej wersji.
   Sprawdzić nową pozycję historii/wynik, a następnie niezmieniony stary snapshot.
4. Po restarcie potwierdzić szafki, PCV i oferty. Przy odmowie kliknąć istniejące Diag i zachować ślad;
   nie resetować profilu ani sesji. Dane telefonu i ręczna akceptacja pozostają osobnym dowodem.

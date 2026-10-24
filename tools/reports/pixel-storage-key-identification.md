# Pixel quota — identyfikacja największego klucza, 24.10.2026

BASE/main potwierdzony na GitHubie: `767c1c79acacc4d8334aa0d79a99b36d7af28ba8`, tree `b72c341bdfa3adfba05a01b1b0895cc310e9c3fd`. PR #81 scalony. Gałąź `diag/pixel-storage-key-identification-20261024`, worktree `/workspace/pixel-storage-diagnostic`; równoległych gałęzi/worktree nie zmieniono. To minimalne narzędzie do obserwacji istniejącej karty, bez wydania aplikacji i bez operacji na danych właściciela.

## Co już jest dostępne

- `session-diagnostics-readonly.js` / okno „Diagnostyka sesji” mierzą cały origin, lecz podają tylko największą długość i kategorie. Nie identyfikują klucza. Historyczny `pixel-session-bookmarklet.txt` używa tego kolektora, nie daje nowej tożsamości magazynu; wcześniejsze próby na Pixelu miały problemy wykonania/schowka. Nie ponawiano ich i nie zmieniono bookmarkletu.
- `dataStorageAudit.auditCurrent()` i `quoteSnapshotStorageMaintenance.storageTopKeys()` potrafią znaleźć nazwy, ale ujawniają dynamiczne klucze, mają inne zakresy oraz przechwytują część błędów. Nie są gotowym anonimowym dowodem kompletności. Nie wywołujemy writerów/cleanupu tych modułów.
- „Diag” WYCENY łączy `storage.topKeys` z danymi runtime, inwestorów/projektów, ofert i kontekstu. Pełny raport nie spełnia wymogu anonimowości. Nie udowodniono dostępności tego widoku z zablokowanego modalu; nie zalecamy przechodzenia do niego na potrzeby tego pomiaru.

Zatem istniejący interfejs nie dostarcza kompletnego, bezpiecznego raportu tożsamości. Istniejący dokument pozwala natomiast wykonać samodzielny, sprawdzony odczyt przez zdalną inspekcję **bez jego przeładowania**, jeśli zachowuje ważną istniejącą autoryzację. Nie ma potrzeby modyfikować aplikacji, loaderów, wersji skryptów lub startupu. Nie dodano drugiego ekranu ani nowej ścieżki Auth.

Właściciel przekazał niezależne ustalenia dla eksportu z 17.10: 36 kluczy, największy `fc_quote_snapshots_v1` około 1062032 jednostek, brak `fc_data_backups_v1`, cache v2 i sesji. Nie analizowano ponownie prywatnego pliku ani eksportera. Eksport nie dowodzi zabezpieczenia dzisiejszej wartości 3317250 jednostek ani RAM telefonu; zasadnicza zgodność biznesowa nie oznacza zgodności wszystkich RAW. Nie przypisujemy największej wartości backupom lub cache bez pomiaru.

## Minimalne narzędzie

Źródło: [pixel-storage-sizes-readonly.js](../diagnostics/pixel-storage-sizes-readonly.js). SHA-256 pliku UTF-8: `e7ff827f6fe32f100c92a3fbf398a59f80291fdc0a7d7536cae6a1f42162c83d`.

To jedna samowykonująca się funkcja zwracająca gotowy JSON, bez dodawania funkcji/pól do `window` lub `FC`. Najpierw sprawdza właściwy origin/ścieżkę i niepodmienioną bramkę `__FC_MAIN_ACCESS__`; potem istniejące `isValid()` przed i podczas odczytu oraz przed wynikiem. Produkcyjne `isValid()` sprawdza zastany lease i profil, nie loguje, nie odnawia Auth ani nie uruchamia biznesu.

Wykorzystuje ten sam sposób liczenia długości kluczy/wartości UTF-16 i ograniczenia 2000 kluczy / 8 Mi jednostek co istniejący kolektor sesji. Nowa, zamknięta lista bezpiecznych stałych nazw rozróżnia m.in. backupy, cache rozkroju, historię i drafty. Dynamiczne sloty mają wyłącznie kategorię rodziny; każdy nierozpoznany klucz — także podobny do `fc_*` lub Firebase SDK — jest anonimowy. `ANON_01` oznacza pozycję w tym pomiarze, nie stały identyfikator do korelowania kolejnych odczytów.

Raport ujawnia: `largest`, do 10 pozycji `top` (mniej, jeżeli kluczy jest mniej), bezpieczną nazwę/anonimowy numer, kategorię, `recognized`, `valueUnits`, liczbę kluczy oraz sumy jednostek kluczy i wartości. Nie ujawnia wartości, ich fragmentów, identyfikatorów klientów/projektów, tokenów, hashy zawartości ani treści wyjątków. `complete:true` i `TWO_PASS_MATCH` wymagają pełnej enumeracji i dokładnej zgodności ponownego odczytu wszystkich wartości, również zmiany o tej samej długości. Błąd/zmiana/Auth/limit odmawiają bez częściowego rankingu. Zgodność dwóch przejść nie jest transakcją localStorage i nie wyklucza zmian po pomiarze ani każdego wyścigu ABA.

To wyłącznie rozmiar tekstu, **nie pomiar dostępnej quota ani zgoda na usunięcie czegokolwiek**. Nie wywołuje setItem/removeItem/clear, próbnego zapisu, estimate/persist, sessionStorage, IndexedDB, migracji, cleanupu, metod sesji, kalkulatora ani sieci. Nie parsuje JSON danych biznesowych, nie czyta RAM aplikacji/formularzy i nie zmienia DOM, URL, schowka, Auth ani globalnych pól. Tymczasowe ciągi potrzebne do pomiaru istnieją tylko wewnątrz funkcji; narzędzie nie eksportuje ich poza nią. Nie jest to backup ani recovery.

## Wykonanie później na fizycznym Pixelu — bez odświeżenia

1. Zachować **obecną kartę Meble-App**. Nie odświeżać, nie otwierać nowej instancji, nie zamykać karty i nie wykonywać Zapisz/Anuluj na potrzeby pomiaru. Eksport z 17.10 nie zabezpiecza jej RAM.
2. Na zaufanym komputerze przygotować pełny plik diagnostyczny z tego commita i zweryfikować powyższy SHA-256. Łącze do pliku otwierać na komputerze, nie w istniejącej karcie telefonu. Nie ładować zewnętrznego skryptu do aplikacji przez sieć.
3. Podłączyć Pixel przewodem USB i użyć zdalnej inspekcji Chrome. Na komputerze otworzyć `chrome://inspect/#devices`, wskazać **już istniejącą kartę** `https://mebleszek.github.io/meble-app/` lub `.../index.html` i nacisnąć „Inspect”. Nie używać „Open”, „Reload”, nawigacji ani przycisku odświeżenia. Jeżeli przygotowanie połączenia wymaga restartu telefonu/karty, nowego uruchomienia aplikacji albo nie da się jednoznacznie wybrać obecnego dokumentu — STOP.
4. W Console inspekcji głównego dokumentu wykonać **wyłącznie cały przygotowany plik**, jeden raz. Nie wykonywać dodatkowych poleceń, nie kopiować `window`, `FC`, sesji ani obiektów localStorage. To konkretny przejrzany program, nie zbiór poleceń do eksperymentowania. Jeżeli Chrome blokuje wklejenie/wykonanie lub wymaga obejścia zabezpieczeń — STOP, bez wyłączania ochrony.
5. Wynikiem wyrażenia jest jeden JSON. Do dalszej analizy przekazać wyłącznie ten wynik rodzaju `meble-app-storage-sizes`, z `status:READ_ONLY` i `complete:true`. Można skopiować samą treść wynikowego ciągu z DevTools; skrypt sam nie zapisuje schowka. Nie przesyłać całej konsoli ani innych raportów. `largest` wskazuje największy magazyn według długości wartości, `top` pozwala ocenić pozostałe. Nie oczekiwać na sztywno dawnej liczby 3317250 — to nowa obserwacja.
6. `AUTH_DENIED`, `WRONG_PAGE`, `STORAGE_READ_FAILED`, `DIAGNOSTIC_STATE_CHANGED` lub `DIAGNOSTIC_LIMIT_EXCEEDED` oznaczają brak kompletnego pomiaru. Zachować kartę, przekazać sam kod i zatrzymać próbę. Nie logować ponownie, nie odświeżać i nie podejmować prób zwalniania miejsca w ramach tej instrukcji.

Kod nie wymaga restartu ani nowego startupu, nie nadpisuje RAM aplikacji. Nie wykonano go na telefonie właściciela. Przechowuje tymczasowo odczytane ciągi do porównania, w granicy istniejącego budżetu; nie jest gwarancją, że Android nigdy nie odrzuci karty pod presją pamięci. Nie zalecamy restartu jako obejścia. Jeżeli bezpieczne podłączenie/wykonanie w zastanym dokumencie jest niemożliwe, część telefoniczna pozostaje BLOCKED: najpierw odrębny plan zabezpieczenia dostępnego stanu i decyzja właściciela.

## Rzeczywista weryfikacja i granice

- Nowy `node tools/pixel-storage-key-identification-smoke.js`: **9 celowanych grup syntetycznych PASS**. Rzeczywisty plik diagnostyczny jest wykonywany w VM: znany największy magazyn, nieznane/dynamiczne nazwy, pełny budżet z rzeczywistą warunkową odmową QuotaExceededError, błędy enumeracji/odczytu, zmiana treści o tej samej długości i zbioru kluczy, odmowa/cofnięcie Auth, brak wycieku, niezmienność RAW/globali oraz limity/zbiór pusty. Trap wszystkich mutacji i API aplikacji potwierdza 0 prób zapisu; symulowana zmiana zewnętrzna jest kontrolowana oddzielnie.
- Składnia obu nowych JS i `git diff --check`: PASS. Brak zmian produkcyjnego JS, HTML, cache-bustingu, workflow, snapshotów, sesji, rollbacku/CAS lub CLOUD.
- Nowy `tools/*-smoke.js` jest rzeczywiście wykrywany przez istniejący `tools/preflight.js` w kontekście bieżącego kodu. Nie zmieniono historii/pinów CLOUD ani testów starszych PR.
- Nie uruchomiono pełnego Preflightu, Chromium, emulatorów Firebase ani GitHub Actions. Syntetyczna fasada ważności dostępu bada odmowę i cofnięcie, nie jest nowym testem Google Auth. Zdalna inspekcja i fizyczny Pixel pozostają **PHONE_PENDING**, bez deklaracji identyfikacji największego klucza przed raportem właściciela.

Następny rekomendowany krok **po uzyskaniu tożsamości**: odczytowo zabezpieczyć właśnie ten magazyn w zweryfikowanej prywatnej kopii wraz z potrzebnym kontekstem według już zapisanego planu ratunkowego. Jego nazwa/rozmiar nie dają zgody na czyszczenie. Nie projektowano ponownie eksportera ani architektury POST-CLOUD.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Przygotowanie i push osobnej gałęzi nie stanowią wydania; brak PR, merge, Pages lub operacji Firebase LIVE. Narzędzie nie musi być wdrażane w aplikacji, aby zostać później uruchomione w zastanym dokumencie zgodnie z powyższą instrukcją. Nowe wydanie wymaga osobnej zgody na dokładne HEAD/BASE.

# P0 — diagnostyka startu Pixela — 10.11.2026

Minimalna gałąź `fix/pixel-startup-diagnostics-20261110`, BASE/main `eb861142cc08842ef3773e1ea3d3a14847d8ff63` potwierdzony git fetch. Źródło gotowych zmian: `fix/safe-startup-single-window-update-20261110` / `3ea553dcc48fda146a1db217144a19aa9d6329ca`. Poprzednia gałąź pozostaje bez zmian. Wynikowy HEAD to jeden commit zawierający ten raport; pełne zdalne HEAD/BASE i CLEAN w przekazaniu.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Przyczyna zgłoszenia Pixela pozostaje **CAUSE_UNCONFIRMED**. To pakiet obserwacyjny umożliwiający rozpoznanie błędu po osobno zatwierdzonym wydaniu, nie deklaracja naprawy przyczyny.

## Zakres przeniesienia

- `main-business-loader.js`: indeks skryptu w bieżącym business-template (1-based; 0 = dynamiczny/nieznany), grupa, faza fetch/execution, HTTP, typ i wiersz. Nie zmieniono kolejności wykonywania, limitu pobierania, kontroli źródła/dostępu ani abort. HTTP 423 pozostaje odmową, otrzymuje zamknięty kod AUTH_SCRIPT_LOCKED. Rozpoznane błędy domenowe/Auth zachowują oryginalną tożsamość i dotychczasowe znaczenie dla recovery; błędy nierozpoznane są opisywane bez surowego komunikatu.
- `application-bootstrap.js`: wyłącznie zamknięty słownik/sanitacja metadanych i zachowanie pierwszego błędu. Bez zmian uruchamiania LOCAL-FIRST, Auth, storage, uprawnień i recovery.
- `main-login.js`: wyłącznie rozszerzenie istniejącego komunikatu błędu. `session-diagnostics-readonly.js`: przekazanie ponownie sanitowanych metadanych do istniejącego raportu/kopiowania.
- AGENTS: wyłącznie uzgodniony §8 z decyzją właściciela o danych testowych, definicjach w kodzie, braku dodatkowego recovery dla historii, nadal poprawnym trwałym zapisie i zakazie samodzielnego resetu/zmiany definicji.
- Wersje tylko tych czterech skryptów: `20261110_pixel_startup_diagnostics_v1`, odpowiednie wejścia HTML, rejestr wersji i manifest.

Nie przeniesiono nowego aktualizatora, dokumentu blob, zmian sw-update.html, offline-update.js, optymalizacji offline-worker.js ani zmian writer-fence. Nie przeniesiono ich testów lub blokera RAW. Nie zmieniono danych telefonu, cenników, norm, materiałów ani workflow.

## Interpretacja i prywatność

Numer identyfikuje pozycję w manifeście strony uruchamianej na telefonie, nie numer wszystkich tagów script w index.html. Grupy/fazy/typy pochodzą z zamkniętych słowników, liczby mają granice. HTTP 0 oznacza brak przechwyconego statusu odpowiedzi (np. błąd wykonania JS), nie odpowiedź serwera z kodem 0. Nie ujawnia się URL/query, treści wyjątków, stacków, UID, danych projektów lub kodu. Getter rzucający wyjątek nie zastępuje pierwotnego błędu; późniejsze błędy nie nadpisują pierwszego.

## Kontrole celowane

| Kontrola | Wynik |
|---|---|
| `node tools/first-sync-error-diagnostics-smoke.js` | **11/11 PASS**: słownik, pierwszy błąd, metadata HTTP/typ, sanitacja/gettery, komunikat rzeczywistego main-login, istniejący raport/kopiowanie, odmowy i brak zapisów. |
| `node tools/pixel-startup-diagnostics-browser-smoke.js` | **4/4 PASS**, real Chromium: rzeczywisty loader wykonuje skrypty w kolejności; ReferenceError raportuje #3/grupę/execution/typ bez prywatnej treści; fetch 423 raportuje #1/fetch/423; znany błąd Auth zachowuje tożsamość. RAW i niezależny rekord business IDB pozostają identyczne. Izolowany profil, bez SDK/LIVE i bez SW/update fixture. |
| `node tools/main-login-smoke.js` | **36/36 PASS**, istniejące granice dostępu/startu. |
| `node tools/trusted-main-login-smoke.js` | **4 grupy PASS**, desktop/telefon/offline/revocation/modal i RAM. |
| Statyczne | Składnia zmienionych JS, wersje, manifest, load groups, diff i allowlista zakresu **PASS**. |

Pokrycie CI: 213 bieżących smoke w siedmiu kompletnych, rozłącznych grupach; diagnostyka w 4/7, nowy test Chromium w 5/7. Allowlista 13 plików, zgodność przeniesionych plików ze źródłem, AGENTS wyłącznie §8 oraz dokładnie pięć zmienionych wpisów manifestu (index + cztery skrypty) PASS.

Cztery moduły obserwacyjne oraz istniejące rozszerzenia testów są przeniesione z gałęzi źródłowej; nowy mały test Chromium obejmuje wyłącznie loader/diagnostykę. Istniejący bootstrap nadal kontroluje Auth i LOCAL-FIRST, a main-login nadal blokuje start po błędzie. Brak pełnego lokalnego CI i brak powtórnego audytu PR #125. Dotychczasowa nierozstrzygnięta różnica RAW zimnego restartu nowego aktualizatora nie jest wynikiem ani blokerem tego oddzielnego pakietu diagnostycznego; nie usunięto jej dowodów na poprzedniej gałęzi.

Następny krok: niezależna kontrola tego minimalnego diffu i zdalnych SHA. Ewentualne CI/Ready/wydanie wymaga osobnej zgody właściciela. Dopiero po wydaniu właściciel przekazuje nowy anonimowy komunikat z Pixela; bez niego nie przypisuje się potwierdzonej przyczyny i nie resetuje urządzenia.

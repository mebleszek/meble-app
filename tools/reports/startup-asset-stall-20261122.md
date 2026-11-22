# Zawieszenie po Google — zasoby startowe, 22.11.2026

## USTALONE

Właściciel po wydaniu PR #158 zgłosił ekran „Uruchamianie Meble-App…” i potwierdził utrzymywanie się go ponad minutę. Rzeczywisty main ddeb79fd40f5763584a84d0f181e616138a51572, gałąź naprawy fix/startup-asset-stall-20261122. Poprzedni pakiet optymalizacji CI df993d7855a7816021fafa7794c3ea0b19abdd8c jest osobno zapisany/pushed; nie jest bazą tej naprawy.

Zakres: bezpieczny start po logowaniu, konkretne odmowy zawieszonych pobrań, zachowanie danych i aktualizacja obowiązkowych regresji. Bez zmian Firebase LIVE, danych telefonu, układu/przycisków, cen, CAS, outboxa, Rules lub automatycznego restartu. Właściciel osobno zatwierdził: „Tak, dodaj kod etapu po 30 sekundach”. Jest to jedyna dodatkowa informacja UI: obecny napis otrzymuje kod z zamkniętej listy etapów, bez nowych przycisków.

## Odtworzona przyczyna — granice dowodu

Main oczekiwał na onload/onerror wszystkich stylesheetów bez ograniczenia. main-business-loader oczekiwał na fetch i response.text bez kontroli braku postępu. Połączenie, które nie kończy się odpowiedzią ani błędem, pozostawiało ekran authorized i nie wywoływało startu runtime. Ten mechanizm odtworzono na wydanym kodzie, a nie przypisano kalkulatorowi lub Firebase.

- RED stylów: rzeczywisty main z kontrolowanym zegarem po 61000 ms nadal authorized, „Uruchamianie Meble-App…”, pusty błąd, runtimeStarts=0, niezmieniony RAW.
- RED skryptów na kodzie z dokładnego BASE: nowa regresja wykazuje brak anulowania zawieszonego pobrania. Źródła odczytano z git show do procesu testowego; bez resetu/nadpisania drzewa.
- Sam zrzut telefonu nie ujawnia fazy. Nie udowodniono, że konkretny telefon zatrzymał się na pliku CSS/JS; późniejsze oczekiwanie na Auth/IndexedDB/Firestore pozostaje możliwe. Nie raportujemy rzeczywistego telefonu jako PASS ani nie wyłączamy bezpieczeństwa, aby go przepuścić.

## WDROŻONE na gałęzi

- Każdy stylesheet ma 30 s na potwierdzenie załadowania. Brak onload/onerror daje AUTH_STYLE_TIMEOUT, zachowuje blokadę i wyłącza spóźniony arkusz. To granica gotowości konkretnego arkusza, nie odczyt jego postępu bajtowego; bardzo wolny arkusz może zakończyć się bezpieczną odmową.
- Skrypt ma 30 s bez odpowiedzi/postępu bajtowego. Czytanie strumienia odnawia obserwację po rzeczywistych niepustych danych; sam pusty chunk nie odnawia czasu. Poprawny strumień może trwać dłużej niż 30 s łącznie. Streaming TextDecoder zachowuje UTF-8, także znak dzielony pomiędzy chunkami.
- AUTH_SCRIPT_TIMEOUT anuluje kontroler pobrań i zachowuje pierwotny kod. Opóźniona odpowiedź nie może wykonać skryptu. Nadal najwyżej osiem pobrań i ścisła kolejność wykonywania manifestu, z ponownym assertAccess przy ewaluacji.
- Oba kody dodano do zamkniętego słownika anonimowej diagnostyki. Wykorzystano istniejący ekran odmowy bez nowych tekstów biznesowych, układu i przycisków. Zasoby trzech modułów Auth mają spójną wersję 20261122_startup_asset_wait_v1 i aktualny manifest.
- Zatwierdzony obserwator po 30 s dopisuje etap do istniejącego auth-status, następnie odczytuje go co sekundę i zmienia tekst tylko przy zmianie etapu. Kod jest wybierany z zamkniętej listy; unknown zastępuje nieznane/prywatne wartości, żadne UID, ścieżki danych czy payloady nie trafiają do napisu. Wyjście z ładowania, odmowa i otwarcie aplikacji kończą obserwację. Nie wykonuje ona operacji SDK, zapisu ani autoryzacji.
- Nie dodano ogólnego deadline runtime ani ponowienia transakcji Firestore. Nie udajemy zakończenia operacji, która może nadal mieć niepewny ACK. Dane, szkice i RAW nie są czyszczone.

## Testy celowane

- startup-assets-smoke PASS: timeout nagłówków i body, zero-byte chunks, spóźniona odpowiedź, jawne abort i cofnięty dostęp, rzeczywisty postęp ponad całkowite 30 s, UTF-8, osiem fetch i kolejność, faktyczny main ze stylem pending/success i RAW/RAM bez zmian.
- Rzeczywisty Chromium, trzy odrębne profile i po 30 s rzeczywistego oczekiwania, równolegle: **3/3 PASS, exit 0**. Realne Main/Auth/loader, jawne syntetyczne odpowiedzi SDK i minimalny biznesowy skrypt; to test granicy ładowania, nie test Firebase Emulator. Dwa błędy zasobów: kod/faza, brak runtime i ewaluacji, późna odpowiedź, brak unhandled rejection, formularz, RAM, RAW i wszystkie cztery magazyny IndexedDB wraz z outboxem dokładnie bez zmian. Trzeci przypadek celowo oczekuje na runtime: po 30 s pokazuje initial-project-revisions, niczego nie przerywa/nie ponawia/nie zapisuje, a dopiero rzeczywiste zakończenie kontrolowanej operacji otwiera aplikację, jeden raz.
- Pełny Chromium z faktycznym manifestem, FC.init, boot, authority i synchronizatorem: **1/1 PASS, exit 0**, celowe 46000 ms oczekiwania SDK, zatwierdzony komunikat authorizing-cloud, odnowienie tej samej sesji i ready; RAM/form/RAW/katalogi/replicas/protected/outbox zachowane. Odpowiedzi Firebase są syntetyczne; nie nazywamy tego testem Emulatora/LIVE. Po dodaniu zatwierdzonego obserwatora powtórzono wyłącznie powiązane przypadki przeglądarkowe i nowy unit, ponieważ doszedł nowy zakres UI.
- main-login 36/36 PASS i android-startup-auth sześć grup PASS po zmianie napisu; global-consistency-startup 6/6 PASS przed dodaniem obserwatora (kod diagnostyki poza słownikiem niezmieniony), a jego nowe użycie sprawdzono regresjami stage/unknown/bez zapisu. Nie uruchamiano pełnego CI.
- CI: dwa nowe smoke mają obowiązkowy dynamiczny przydział, razem 231 plików / 262 jednostki / 36 grup. Natywny test przeglądarkowy ma jawny szacunek 65000 ms, zamiast spakowania jak nowy test 1000 ms. Pozostałe segmenty i asercje zachowane. Kontrola pokrycia i wersji PASS.

Pierwsza próba nowego fixture Chromium nie ustawiła FC_AUTH_TEST_OPTIONS przez istniejący setter wstrzykiwania SDK: AUTH_CONFIG_REQUIRED przed badanym etapem. Poprawiono setup; nie zmieniano produkcyjnej walidacji konfiguracji ani limitów czasu. Logi diagnostyczne i zrzuty zachowane. Nowy zegarowy fixture miał początkowo main-login ukryte inaczej niż prawdziwy HTML; poprawiono wyłącznie setup. Składnia nowego testowego wstrzyknięcia również została poprawiona przed jego wykonaniem. Błąd cytowania skryptu WSL uniemożliwił osobny start helpera przed testem; uruchomiono poprawnie przez plik, bez zmian aplikacji.

## BRAKUJE → PROPONOWANE

Zgoda UI została udzielona i wdrożona. Kontrole celowane PASS; konkretny etap pierwotnego zawieszenia na telefonie pozostaje nieznany. Pełne CI i osobno zatwierdzone wydanie nowego HEAD/BASE oraz odbiór telefonu pozostają niewykonane. Status: CODE_READY dla ochrony zasobów i zatwierdzonej diagnostyki / CI_PENDING / RELEASE_BLOCKED / PHONE_STARTUP_BLOCKED, bez deklaracji sukcesu telefonu.

Artefakty poza repo: ../../outputs/startup-hang-20261122 oraz /tmp/meble-p1.KVrFtN/startup-assets-*.log, screenshoty błędnego setupu /tmp/meble-startup-assets-2euGMI. Repo edytowane na Windows, testy rzeczywistego Chromium w izolowanej kopii WSL/Linux. Nie korzystano z profili właściciela ani poświadczeń LIVE.

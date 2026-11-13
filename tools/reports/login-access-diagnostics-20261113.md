# Pixel — anonimowa diagnostyka dostępu, 13.11.2026

Repo: `mebleszek/meble-app`; gałąź `fix/login-access-diagnostics-20261113`.
BASE/main zweryfikowany po fetch: `69c45250ff2aeefc33639f6c617818d88ebdcfcf`.
Wynikowy HEAD i zdalne SHA/CLEAN podawane po jednym commicie/push.

## Potwierdzone ustalenia i zakres

Zrzut telefonu zawiera `login-startup / AUTH_ACCESS_UNCONFIRMED`. Przyczyna odmowy na Pixelu pozostaje **CAUSE_UNCONFIRMED**. Potwierdzona luka diagnostyczna: gate zastępuje wyjątek kodem ogólnym, a odświeżanie weryfikatora usuwa jego szczegóły. Test na niezmienionej produkcji BASE odtworzył FAIL: oczekiwana diagnostyka `server-read / FirebaseError / unavailable`, otrzymane `undefined`; biznes pozostał zablokowany.

Weryfikator zachowuje anonimową fazę w prywatnym WeakMap, ponownie rzucając oryginalny wyjątek. Gate przekazuje ją także po błędzie odświeżenia. Istniejący komunikat logowania pokazuje `Diagnostyka dostępu v1`, fazę, typ, kod i bieżący sygnał online/offline przeglądarki. Ten sygnał nie jest dowodem dostępności serwera. Bez nowych przycisków, połączeń, zapisu diagnostyki lub telemetrii. Typy, fazy i kody mają zamknięte słowniki; inne wartości są UNKNOWN/UNRECOGNIZED. Brak treści wyjątku, stacka, UID, e-maila, tokenów i URL. HTTP nie jest udostępniane przez ten interfejs SDK; nie jest zgadywane.

Nie zmieniono decyzji Auth, terminów lease, weryfikacji serwerowej/transakcyjnej, LOCAL-FIRST, writer-fence, storage, odzyskiwania danych, SW/aktualizatora, cenników ani synchronizacji. Nie wykonano operacji Firebase LIVE ani zmian telefonu. Wersje trzech skryptów auth-shell oraz manifest integralności zaktualizowane.

## Kontrole celowane (Codex, drzewo końcowego commita)

- `node tools/cloud-auth-smoke.js`: **40/40 PASS**, w tym FAIL→PASS, kontekst/init Firestore/transakcja, niezmieniona tożsamość wyjątku, odrzucanie prywatnych/nieznanych pól.
- `node tools/trusted-main-login-smoke.js`: **PASS**; nowa regresja faktycznego main-login wyświetla diagnostykę, usuwa prywatną treść i zachowuje blokadę; istniejące scenariusze desktop/telefon/offline/revocation/RAM zachowane.
- `node tools/main-login-smoke.js`: **36/36 PASS**.
- `node tools/android-startup-auth-smoke.js`: **PASS**, odmowy/expiry/zmiana konta/opóźniony start i niezapisana edycja.
- Chromium `android-startup-auth-browser-smoke.js`: **PASS**; rzeczywisty pełny start po 46 s i wygaśnięciu pierwszego dowodu, świeża weryfikacja tej samej sesji, odmowy/brak internetu/zmiana konta, zachowane RAM/formularz/RAW/katalogi/repliki/outbox. SDK syntetyczne, bez LIVE.
- Składnia trzech zmienionych modułów, dokładne wersje (`script-versions.assertVersions`), manifest offline oraz `git diff --check`: **PASS**.
- Cztery powyższe pliki smoke znajdują się dokładnie raz w istniejącym planie shardów CI. Nie zmieniono workflow, nie uruchomiono pełnego CI.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING** po zakończeniu kontroli. Następny krok: niezależna kontrola diffu i osobna decyzja wydaniowa; dopiero po wydaniu odczyt nowej diagnostyki z Pixela. Pakiet sam nie naprawia nieustalonej przyczyny odmowy dostępu.

# Pixel — narzędzia diagnostyczne tylko do odczytu

## Identyfikacja największego magazynu — 24.10.2026

Nowy, samodzielny [pixel-storage-sizes-readonly.js](pixel-storage-sizes-readonly.js)
zwraca anonimowy JSON dziesięciu największych wartości localStorage. Uruchamia
się wyłącznie w **już otwartym, autoryzowanym dokumencie** przez zdalną inspekcję
Chrome z zaufanego komputera. Nie wymaga wydania, instalacji w aplikacji,
odświeżenia karty, nowego startupu, ponownego logowania ani bookmarkletu.
Nie odczytuje stanu formularzy/sesji RAM i nie zapisuje danych.

[Instrukcja, dowody testów i warunki STOP](../reports/pixel-storage-key-identification.md).
Brak ważnego istniejącego Auth, konieczność restartu/odświeżenia albo obejścia
zabezpieczeń oznacza STOP. Nie używać starego bookmarkletu jako zastępstwa;
nie wysyłać ogólnego raportu „Diag” WYCENY ani surowych obiektów storage.

## Historyczny bookmarklet sesji

**Ścieżka historyczna.** Właściciel zgłosił ucięty skrypt/SyntaxError oraz brak
wyniku schowka na fizycznym Pixelu. Nie zaleca się kolejnych prób bookmarkletu.
Na gałęzi przygotowano diagnostykę w istniejącym oknie błędu sesji: raport na
ekranie, bez obowiązku kopiowania. [Instrukcja i ograniczenia](../reports/initial-session-retry-recovery.md#diagnostyka-sesji-w-aplikacji--kontynuacja-po-47d20b0).
Wymaga osobnej decyzji wydaniowej. Poniższe instrukcje zachowano jako historię.
Kolektor narzędzi importuje teraz jedyne źródło z
[session-diagnostics-readonly.js](../../js/app/ui/session-diagnostics-readonly.js).

Gotowy adres: [pixel-session-bookmarklet.txt](pixel-session-bookmarklet.txt).
To **jedna linia**, zaczynająca się od `javascript:`. Źródło do przeglądu:
[pixel-session-readonly.js](pixel-session-readonly.js).

## Uruchomienie na telefonie — bez komputera

1. Skopiuj **cały skrypt** z wiadomości lub pliku powyżej. Zachowaj obecną
   kartę Meble-App; nie zastępuj jej plikiem skryptu i nie odświeżaj aplikacji.
2. W Chrome, na tej karcie Meble-App, dotknij **⋮ → gwiazdka**, aby dodać
   zakładkę. Wybierz **Edytuj**: nazwa **MebleDiag**, w polu **Adres** wklej
   cały skrypt. Sprawdź, że zaczyna się od `javascript:`. Zapisz zakładkę.
3. Wróć do **tej samej karty Meble-App**. Dostęp Google musi być potwierdzony
   zwykłą drogą aplikacji. Nie resetuj danych i nie kończ edycji na potrzeby testu.
4. Dotknij paska adresu, wpisz **MebleDiag**, a następnie dotknij **sugestii
   zapisanej zakładki z gwiazdką**. Nie wybieraj wyszukiwania Google ani pozycji
   w menedżerze zakładek. Chrome może blokować inne sposoby uruchomienia JS.
5. Wróć do wiadomości i wklej wynik. **Prześlij wyłącznie krótki JSON zaczynający
   się od `{"v":1,"status":`**. Jeśli w schowku nie ma takiego nowego JSON,
   zatrzymaj się; nie wysyłaj poprzedniej zawartości schowka.

Skrypt kopiuje wynik do schowka; nie otwiera okna wstrzymującego JavaScript
i nie pokazuje własnego interfejsu. Nie odczytuje poprzedniej zawartości schowka.
Przy odmowie schowka kończy działanie bez fallbacku, zmian DOM i pobierania pliku.
Po teście można usunąć **samą zakładkę MebleDiag**, bez usuwania danych witryny.

`READ_ONLY` oznacza wykonanie obserwacji, **nie zgodę na zapis/rollback**.
`AUTH_DENIED` oznacza, że nie odczytano danych biznesowych. Potwierdź dostęp
przez istniejący ekran aplikacji i dopiero wtedy ponów diagnostykę.
`STORAGE_UNREADABLE` nie jest dowodem braku miejsca — skrypt nie próbuje pisać.
`DIAGNOSTIC_STATE_CHANGED` oznacza odrzucenie niespójnej obserwacji.

## Zakres i bezpieczeństwo

- Tylko właściwy HTTPS origin i ścieżka Meble-App. Przed odczytem i przed
  wydaniem raportu istniejąca, niepodmieniana bramka `__FC_MAIN_ACCESS__`
  musi potwierdzić dostęp. Brak gate, wygaśnięcie lub cofnięcie oznaczają odmowę.
- Odczyt siedmiu kluczy: payload sesji, projekty, bieżący projekt i inwestor,
  UI oraz dwa dotychczasowe nieskopowane klucze formatek. Ponowny odczyt musi
  zwrócić identyczne RAW; stan RAM również nie może się zmienić.
- Wyłącznie `getItem` i odczyt pól RAM. Bez `begin`, `commit`, `cancel`,
  `canSaveProject`, `recoverProject`, normalizatorów, migracji i innych metod
  aplikacji. Bez zapisów/usuwania w localStorage, sessionStorage lub IndexedDB,
  bez sieci, zmian DOM, nawigacji, timerów oraz Firebase. Jedyny zapis to
  **wyjściowy, zanonimizowany JSON do schowka**.
- Raport zawiera wersję schematu, booleany kompletności/zgodności, C=B i C=E,
  `expectedKnown`, `pending` i kod z zamkniętej listy. Żadne identyfikatory,
  nazwy, wartości, hashe danych, snapshoty, tokeny ani klucze API nie opuszczają
  funkcji. Maksymalny rozmiar odczytu ograniczono do 8 MiB znaków RAW.
- `payloadShape` opisuje strukturę, nie bezpieczeństwo zakończenia operacji.
  Prywatny znacznik `writeUnconfirmed` nie jest publicznym API i nie jest
  odczytywany. `code` to zastany ostatni kod, bez wywoływania kolejnej odmowy.
  `storage:READABLE` nie potwierdza możliwości zapisu ani dostępnej quota.

Przetestowano wykonanie jako rzeczywisty adres `javascript:` z gestem użytkownika
w Chromium z mobilnym viewportem i dotykiem. Nie jest to test fizycznego Pixela
ani nowy test logowania Google. Test korzysta z produkcyjnych `main-login.js`,
profilu lokalnego i bramki dostępu, z syntetyczną tożsamością/weryfikatorem.
Żadna produkcyjna metoda `isValid` nie jest zastępowana stałym `true`.

Jeżeli Chrome na telefonie blokuje uruchomienie albo nie pozwala skopiować
wyniku, **zatrzymaj próbę**. Nie wyłączaj zabezpieczeń i nie używaj zastępczych
skryptów z internetu. Alternatywa wymaga osobnej zgody: minimalny, odczytowy
ekran diagnostyczny na właściwym originie, z tą samą bramką Auth. Nie został
tu dodany, opublikowany ani uruchomiony. Nie potrzeba prywatnego eksportu.

## Odtworzenie i testy

```sh
node tools/build-pixel-session-bookmarklet.js
node tools/pixel-session-bookmarklet-smoke.js
npm --prefix tools/firebase-pilot ci
node tools/pixel-session-bookmarklet-browser.js
node tools/preflight.js
```

Builder nie pobiera narzędzi i nie wykonuje kodu na stronie. Test sprawdza
zgodność gotowej jednej linii ze źródłem. Testy odczytu obejmują wcześniejsze
stany sesji, utratę potwierdzenia po restarcie, niepełny dowód, obcy kontekst,
pending operation, zmianę danych podczas odczytu, prywatne wartości oraz
odmowę/wygaśnięcie/cofnięcie dostępu. Browser runner sprawdza natywny zapis
schowka i odmowę, zero zmian wszystkich danych, DOM, URL i nonce dokumentu,
zero zakazanych wywołań i dodatkowych żądań.

Weryfikacja tego pakietu: **15/15 regresji PASS**, **Chromium 7/7 PASS,
0 FAIL, 0 SKIP**. Pełny **PRE-FLIGHT PASS**: smoke **134/134**, APP **110/110**,
składnia **573/573**, kolejność ładowania, zależności i storage PASS (144080 ms).
Nie zmieniono plików produkcyjnych, workflow ani cache-bustingu.

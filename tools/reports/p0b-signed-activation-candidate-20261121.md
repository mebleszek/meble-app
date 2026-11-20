# P0-B — kandydat podpisanej aktywacji, 21.11.2026

## USTALONE → WDROŻONE

Właściciel: „Wydane. Lecimy dalej”. Zweryfikowano zamknięty/scalony PR #153 i jego raport CI/Pages PASS dla `cae9490d01bb1fc66cb0b2f37a3b2bacf62f7998`. Jest to BASE/main nowej gałęzi `feat/p0b-signed-activation-candidate-20261121`, bez zmiany historii dawnej gałęzi. Zgoda obejmuje dalsze przygotowanie synchronizacji; nie traktujemy jej jako nowej zgody na wydanie dokładnych przyszłych SHA lub nieprzejrzany zapis LIVE.

Źródło slotu: publiczny pakiet `../p0b-activation-dpapi-20261120/activation-decision.SIGNED-PUBLIC.json`. `reviewApplicationRelease` ponownie sprawdził podpis i pełny hash Rules; jego wynik JS musiał być identyczny z wcześniej zabezpieczonym `application-release.CANDIDATE.js`. Nie używano klucza prywatnego ani nie zmieniano magazynu DPAPI.

- Nowy publiczny odcisk: `c66babc664fff2dbb25edd84227c5337a32a59df25636f97cc3d71dcdeada53b`.
- Kanoniczna decyzja: `8c6d478efefa55d13d606ca4f71c141b681393bc73985af38ef9f3831a58f8a3`.
- Dokładne Rules protokołu 3: `e05bef8df96a139fe061949008fea1d3187dfb0dfacc8b68606eed8047f128f4`.
- Ten sam ownerUid, activationId, projekt Firebase i origin; `business-room-v1`, `p0b-rooms-v1`, `preserve-outside-registry`.

Przygotowano slot w js/app/cloud/application-release.js. Bootstrap już wyprowadza tryb P0-B ze zweryfikowanej decyzji; nie wymaga flagi DEMO. Usunięcie starego firstCatalogSync wynika z przejścia na zatwierdzony protokół 3, nie z osłabienia autoryzacji. Zaktualizowano wyłącznie wersję src w index.html, jej kontrolę oraz manifest offline. Nie zmieniono wyglądu, tekstów lub interakcji UI, runtime, cen, kalkulatora ani Firebase. Brak migracji/resetu.

## Kontrole

- PASS boundary 14/14: rzeczywisty slot z nowym odciskiem, dokładnym kanonicznym hashem decyzji, rejestrem/policy i hashem wygenerowanych Rules; identyczność slotu z weryfikowanym pakowaniem; odmowa starego odcisku. Dotychczasowe odmowy zmienionego podpisu, właściciela, źródła, starej capability, utraty lease i epoch pozostały. Stare fixture protokołu 2 nadal są sprawdzane; nie usunięto negatywów.
- PASS main-login 36/36, script-versions, offline-assets i offline-shell: spójność wszystkich publicznych bajtów, ochrona aktywnego cache i brak takeover/reloadu. Bez Firebase i danych właściciela.
- PASS rzeczywisty Chromium 157 w izolowanym profilu WSL/Linux: istniejący android-safe-sw-update-smoke, historyczny worker `2930e0d7` → bieżący kandydat. HTTP 503 odmawia instalacji i zachowuje stary cache/dane/formularz; 32 s wstrzymanego pobrania nie przerywa postępu. 189 pobrań, 329 zweryfikowanych użyć cache, peak 3; aktywny RAM/wiele kart chronione, naturalna aktywacja i offline restart zachowują RAW/IndexedDB. Test izoluje produkcyjną aktywację i nie wykonuje Firebase RPC — nie jest odbiorem LIVE nowego slotu. Nie zmieniano asercji ani limitów. Pierwsze uruchomienia zatrzymały się przed scenariuszem na ścieżce Windowsowego worktree w WSL i braku LD_LIBRARY_PATH; po wskazaniu istniejącego wspólnego git-dir i istniejących bibliotek runtime test przeszedł. Bez instalacji, zmian środowiska systemowego i zmian kodu dla tych przeszkód. Offline-update negatywy także PASS.
- Pełnego Preflightu ani emulatorów nie powtarzano. Istniejące obowiązkowe CI nadal obejmuje boundary oraz signed-startup/signed-clean/signed-quote; zmienione asercje dotyczą wyłącznie zatwierdzonego publicznego artefaktu. CI nowego SHA pozostaje PENDING.

## BRAKUJE → PROPONOWANE

**RELEASE_BLOCKED / LIVE_BLOCKED. Nie publikować tego commita samodzielnie przy starych Rules.** Obecnie wydana aplikacja pozostaje niezmieniona. Raport odczytowy z 20.11 nie jest świeżym potwierdzeniem stanu serwera.

Przed przełączeniem:

1. Odczytać ponownie rzeczywiste Rules/release i administracyjne granty; porównać z zachowaną kopią, właścicielem, activationId i podpisanym pakietem. Obca zmiana = STOP. Nie zmieniać IAM, billingu, grantów ani danych.
2. Potwierdzić bezpieczne zakończenie edycji na urządzeniach; lokalne szkice/RAW/IndexedDB/outbox zachować. Nie wymuszać reloadu. Stare testowe projekty pozostają poza nowym rejestrem, dane globalne nietknięte.
3. Właściciel osobno zatwierdza dokładne Rules LIVE oraz okno przełączenia. Nowe Rules odcinają starego writera; do wydania protokołu 3 występuje okno odmowy starej synchronizacji. Nie obiecywać, że samo uruchomienie CI da natychmiast gotową synchronizację.
4. Po zgodnym przełączeniu Rules i odczytowym potwierdzeniu dokładnego hasha/grantów: osobno zatwierdzona próba CI/wydania dla dokładnych HEAD/BASE, zgodnie z RELEASE. Nie tworzyć Ready ani nie uruchamiać Actions teraz. Ryzyko nieudanego wydania po Rules musi być zaakceptowane przed krokiem 3. Bez ręcznego merge/retry.
5. Przed zapisami P0-B powrót do starych Rules można rozważyć dopiero po dowodzie braku nowych zapisów i osobnej decyzji; po zapisach P0-B nie przywracać starego writera automatycznie. Zachować lokalne dane i rozstrzygnąć recovery. Po wydaniu: dwa urządzenia, niezależne pokoje i wspólna kartoteka, ACK/odbiór, odmowa drugiemu edytorowi, offline/reconnect/restart, bez duplikatów i naruszeń katalogów. PHONE_PENDING.

Pakiet przygotowuje techniczną konfigurację. Nie potwierdza jeszcze działającej synchronizacji na telefonie/komputerze ani zgody na używanie danych klientów.

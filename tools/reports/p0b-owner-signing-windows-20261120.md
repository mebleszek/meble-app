# P0-B — podpis chroniony kontem Windows

## USTALONE

Zgoda właściciela 20.11.2026: zamiast wpisywania hasła starego klucza utworzyć nowy klucz podpisujący chroniony kontem Windows. Właściciel zna i akceptuje, że procesy na tym samym zalogowanym koncie mogą podpisać decyzję bez jego PIN-u. Nie jest to uwierzytelnienie Google, Windows Hello, nowa autoryzacja serwerowa ani dowód osobistej obecności właściciela. Parametr OwnerApproved potwierdza procedurę i może być podany przez program; sam w sobie nie jest zabezpieczeniem kryptograficznym.

Punkt wyjścia: aktualny main `c71d93c279b00ae7f153837c606d98bd10816591`, scalony PR #152. Nowa gałąź `feat/p0b-owner-signing-windows-20261120`. Nie przepisano dawnego mechanizmu runtime ani procedury osobnej zgody na wydanie/Firebase LIVE.

## WDROŻONE

- `tools/Sign-ApplicationRelease.ps1` wymaga Windows i PowerShell 7. Tworzy klucz jedynie po OwnerApproved, w nowym katalogu poza repo; istniejący katalog oznacza STOP, nigdy regenerację. ACL magazynu: wyłącznie bieżący SID, bez dziedziczenia. Prywatny PKCS8 jest szyfrowany DPAPI CurrentUser, z rozdzieleniem celu przez stałą entropy; do pliku trafia tylko szyfrogram. Po utworzeniu narzędzie weryfikuje odczyt zapisanego klucza. Nie wymaga administratora ani instalacji.
- Node generuje Ed25519 i podpisuje w krótkim procesie offline. Materiał prywatny przechodzi przez przekierowane stdin/stdout tylko pomiędzy lokalnymi procesami; nie przez argumenty, pliki jawne, repo, sieć lub logi. Bufory bajtowe są czyszczone; nie obiecujemy wyzerowania wszystkich niemodyfikowalnych stringów/kopii pamięci środowisk Node/.NET. Błędy helpera są ograniczone do kodów LF_, bez echo wejścia.
- Podpis wymaga oczekiwanego publicznego odcisku i dokładnej decyzji, sprawdzanej przed odczytem klucza. Zgodność pary i algorytmu oraz istniejący `reviewApplicationRelease` weryfikują podpis, cel i dokładny hash Rules. Nie ma funkcji podpisywania arbitralnej treści, fallbacku do starego klucza ani nadpisywania wyniku. Brak/niepewny/uszkodzony klucz zatrzymuje operację. Przerwana kreacja pozostawia niekompletny magazyn do wyjaśnienia, nie tworzy automatycznie nowej tożsamości.
- Zablokowano zapis klucza/wyniku do repo i użycie ścieżek z junction/symlink. DPAPI pozostaje związane z profilem Windows; brak gwarancji odzyskania po usunięciu profilu lub przeniesienia na inny komputer. Dodatkowy komputer wymaga osobnego protokołu/zgody. Sama aplikacja nadal działa na wielu urządzeniach.

Nowy magazyn: `%LOCALAPPDATA%\MebleApp-OwnerDeploymentKey-DPAPI-v1\deployment-key.dpapi.json`. Nie przekazywać tego pliku do repo/czatu, mimo zaszyfrowania. Stary `MebleApp-DeploymentKey-0163d3bc9e5d4e46bdfc12958ceb6f8f` pozostał bez zmian, potwierdzono hashami przed/po.

Publiczny odcisk nowego klucza: `c66babc664fff2dbb25edd84227c5337a32a59df25636f97cc3d71dcdeada53b`.

Kanoniczny SHA-256 decyzji: `8c6d478efefa55d13d606ca4f71c141b681393bc73985af38ef9f3831a58f8a3`.

Rules kandydata: `e05bef8df96a139fe061949008fea1d3187dfb0dfacc8b68606eed8047f128f4`.

Wyniki poza repo: `../p0b-activation-dpapi-20261120/activation-decision.SIGNED-PUBLIC.json` i `application-release.CANDIDATE.js`. Narzędzie pakujące oraz istniejący weryfikator potwierdziły podpis; nie zastąpiono aktywnego `js/app/cloud/application-release.js`. Ten kandydat ufa nowemu kluczowi, ale nie jest wdrożony. Historyczny pakiet `../p0b-activation-package-20261120` i stare narzędzia pozostały zachowane.

Komenda przyszłej weryfikacji lokalnej (nie podpisuje i nie wdraża):

```powershell
./tools/Sign-ApplicationRelease.ps1 -Action CheckKey -ExpectedKeySha256 c66babc664fff2dbb25edd84227c5337a32a59df25636f97cc3d71dcdeada53b
```

Kolejny podpis wymaga jawnych `-Action Sign -OwnerApproved`, ścieżki decyzji i nowej ścieżki wyniku poza repo oraz powyższego odcisku. Używać wyłącznie w uzgodnionym zakresie. Nie uruchamiać samego helpera Node w celu wyświetlenia prywatnego materiału.

## KONTROLE

- PASS: przenośny test kryptograficzny: nowy klucz/podpis, publiczny kandydat JS w normalnym weryfikatorze, zmiana właściciela/Rules/protokołu/dodatkowych pól przed kluczem, obcy odcisk, niezgodna para, uszkodzony podpis i bezpieczne błędy procesu.
- PASS: 13 rzeczywistych kontroli Windows w izolowanym katalogu tymczasowym, z osobnymi procesami PowerShell/Node: brak zgody, utworzenie DPAPI, ACL tylko bieżącego SID, ponowne otwarcie klucza, odmowa regeneracji, brak zgody na podpis, obcy klucz, prawidłowy podpis, odmowa nadpisania, identyczny podpis po restarcie, odmowa zmienionej decyzji przed brakującym magazynem, uszkodzony DPAPI i zakazana ścieżka. Błędne operacje nie tworzą wyniku; aktywny slot niezmieniony.
- PASS: rzeczywiste utworzenie nowego magazynu, podpis zatwierdzonej decyzji, ponowny CheckKey i pakowanie przez `application-release-package.js`. Hashy starego klucza nie zmieniono.
- PASS: niezmieniony `production-application-boundary.test.mjs` 14/14, w tym Google/lease, stary protokół, downgrade i exact Rules; bez sieci i emulatora.
- PASS: `workflowChecks` i 11 grup `diagnosticChecks` z nowymi negatywami joba Windows i agregacji; model bash uruchomiony w istniejącym WSL/Linux. To nie pełny Preflight ani wywołanie GitHub API zapisu. Nowy smoke przydzielony dokładnie raz, nadal 36 grup.
- Obowiązkowy `owner-signing-windows` korzysta z dokładnego HEAD z safety, bez zapisanych credentials; działa wyłącznie na jednorazowych testowych kluczach. Jest wymagany przez agregat preflight, a więc blokuje wydanie przy FAIL/skipped/braku wyniku. Przenośne negatywy są dodatkowo w istniejących shardach. Nie uruchomiono Actions.

Pierwszy test Windows wykrył dwa dostępne `node.exe` w PATH, które Get-Command zwrócił jako tablicę. Przed utworzeniem rzeczywistego klucza poprawiono wybór pojedynczego istniejącego pliku; końcowy zestaw przeszedł. Nie zwiększano timeoutów ani nie osłabiano asercji.

## BRAKUJE → PROPONOWANE

**CODE_READY podpisywania / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Sam podpis nie jest zgodą wydaniową, serwerowym grantem ani aktywacją.

Następny zakres: integracja publicznego kandydata z wersją/manifestem oraz skoordynowany plan Rules LIVE i osobno zatwierdzona próba wydania dokładnych SHA. Nie publikować protokołu 3 przy starych Rules. Nowe Rules odcinają starego writera — ustalić bezpieczne zakończenie sesji urządzeń i okno odmowy; po nowych zapisach nie przywracać starych Rules automatycznie. Wcześniejszy PASS wydanego main nie przechodzi na ten commit. PHONE_PENDING do odbioru rzeczywistych urządzeń. UI, kalkulator, dane, stare kolejki, backupy i Firebase pozostały nietknięte.

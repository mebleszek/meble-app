# CLOUD-4.3a — produkcyjny baseline Firestore Rules

## Zakres i pochodzenie

Baza: gałąź `cloud-4-3-live-readiness-refresh`, commit
`2f2704a3239fc58fabf375dcab43edbd78680cfe`, drzewo
`7a89637e46d6d8e4e9e22b7ed3a4401c3021932c`. Lokalny i zdalny HEAD oraz czystość
potwierdzono przed utworzeniem `cloud-4-3a-production-rules-baseline`.
Nie zaczynano od main ani starej kopii CLOUD-4.1.

Źródło dowodu: oryginalny JSON i metadane podane przez właściciela w zleceniu,
z raportu `CLOUD-4.3_Bramka-1_2026-10-20-2-2.md`. Według tego dowodu dwa oficjalne
odczyty Firebase Rules REST zwróciły HTTP200. **W tym zadaniu nie wykonano żadnego
odczytu Firebase LIVE.** Nie zastąpiono dowodu produkcyjnego źródłem z GitHuba.
Spark/brak Blaze i rezerwa >=500 reads/30 writes są ustaleniami właściciela
z chwili kontroli, nie nowym pomiarem ani potwierdzeniem obecnego stanu.

Standardowy parser JSON odtworzył dokładnie **635 bajtów UTF-8**, początkowy LF
i brak końcowego LF. SHA jest identyczny z podanym przez właściciela. Nie usuwano
komentarzy, nie normalizowano whitespace i nie poprawiano ręcznie źródła.

## Trzy niezależne artefakty

| Rola | Bajty | SHA-256 |
| --- | ---: | --- |
| Historyczny produkcyjny Auth-only | 635 | `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91` |
| Repozytoryjny Auth-only template | 755 | `fd92cffababe500cba62ed6e592b482760ce9e66df35f01419c44edff2f10cd3` |
| Minimalne Rules pilota | Bez zmian | `eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92` |

Czytelna analiza obu źródeł wskazuje ten sam prosty kontrakt Google/appEnabled
oraz default-deny, ale nie wykorzystujemy porównania po usunięciu komentarzy
jako dowodu tożsamości lub zgody. Różnica 120 B jest rzeczywista i pozostaje
rejestrowana. Testy emulatorowe sprawdzają osobno DOKŁADNE bajty obu wersji.

Historyczna tożsamość produkcji:

- projekt `mebleszek-meble-app`, baza `(default)`;
- release `projects/mebleszek-meble-app/releases/cloud.firestore`;
- ruleset `projects/mebleszek-meble-app/rulesets/3e3729ee-6dae-4d91-9e7f-862e68899763`;
- release createTime `2026-10-15T22:31:21.277596Z`;
- release updateTime `2026-10-17T15:53:31.006324Z`;
- ruleset createTime `2026-10-17T15:53:29.583599Z`;
- dokładnie jeden plik `firestore.rules` o podanym SHA i rozmiarze.

To historyczny zapis, nie gwarancja, że obecny release jest nadal taki sam.
Historyczna Bramka 1 pozostaje **STOP_SHA_MISMATCH_REVIEW_REQUIRED**.
`baselineApprovedForGate2:false` jest częścią przypiętego rekordu.

## Prywatność i dostępność dokładnego źródła

Obowiązujące raporty CLOUD-4.2 (pierwsza bramka) i CLOUD-4.3 wymagają zachowania
oryginalnego eksportu produkcyjnego prywatnie. AGENTS §11–13 nie udziela ogólnej
zgody na ujawnianie prywatnych dowodów. Istnienie podobnego publicznego template
nie jest taką zgodą. Zlecenie dopuszcza prywatną kopię, dlatego **nie publikujemy
pełnego produkcyjnego źródła, jego JSON-stringu, kodowania ani rekonstrukcji
z template w GitHubie lub CI**. Metadane wymagane przez zlecenie są publikowane.

Zweryfikowany plik 635 B zachowano poza repozytorium. Katalog wyników tego
środowiska nie jest zapisywalny (odmowa systemu plików), więc dodatkowy plik
do pobrania pozostaje BLOCKED; nie deklarujemy jego dostarczenia. Oryginalny
prywatny załącznik właściciela zawiera pełny JSON-string źródła.
`decodeProductionSourceJson()` może odtworzyć jego bajty standardowym parserem
i sprawdza dokładny SHA; nie rekonstruuje go z template. Nie należy polegać na trwałości
workspace Codexa. Przed przyszłą operacją właściciel musi posiadać tę kopię
z niezmienionym SHA (lub nowy oryginalny eksport REST spełniający pełną tożsamość).
Brak zweryfikowanego dostępnego źródła oznacza STOP; repo samo go nie dostarczy.

## Mechanizm i migracja konsumentów

- `cloud43a-production-baseline.json`: wersjonowany rekord pochodzenia i pełnej
  tożsamości; bez źródła i bez zgody na mutacje.
- `cloud43a-baseline.js`: offline, bez SDK/sieci/zapisu; SHA rekordu i planu,
  jawne role, pełna tożsamość oraz sprawdzenie dokładnych bajtów. Role i ich
  hashe są niemutowalne. Nieznany lub samoczynnie „zatwierdzony” rekord = odmowa.
- `verifyProductionObservation()`: wymaga projektu/bazy, release.name,
  rulesetName, obu createTime, updateTime, jednego pliku, nazwy i oryginalnego
  content. Zwraca tylko `HISTORICAL_IDENTITY_MATCH_ONLY`, mutationAllowed:false.
- `assertFreshUnchangedRules()`: dwa jawnie dostarczone odczyty, kontrola
  tożsamości i kolejności czasu, maksymalnie 5 minut, bez przyszłego timestampu.
  Zmiana pomiędzy odczytami = STOP. Timestamp/JSON nie są kryptograficznym
  dowodem pochodzenia z serwera ani zgodą właściciela. Sam walidator nie wykonuje
  odczytów i zawsze pozostawia bramkę zamkniętą.
- `cloud42-package.js`: zachowuje piny CLOUD-4.3, dodatkowo przypina bajty nowego
  walidatora/rekordu/planu. `verifyDeployedRules('auth-only', ...)` odmawia jako
  niejednoznaczne. `repository-auth-only-template` akceptuje wyłącznie 755 B;
  `production-auth-only-baseline` wymaga też pełnej obserwacji; `minimal` nadal
  sprawdza wyłącznie dotychczasowe minimalne bajty. Sama kontrola pliku zwraca
  deploymentConfirmed:false.
- Pole `rollbackRulesSha256` usunięto z proof; zastępują je jawne
  `repositoryAuthOnlyTemplateSha256` i `productionAuthOnlyBaselineSha256`.
  Jedynym aktywnym konsumentem starej roli był offline smoke, który dostosowano.
  Inertny loader porównuje cały pakiet i jego SHA, więc stare decyzje nie pasują
  do nowej wersji. Dodatkowo loader odmawia nawet przy poprawnej decyzji
  operatora, dopóki przypięty baseline nie ma osobnej zgody na Bramkę 2; w tej
  wersji ta zgoda jest zawsze false. Nie dotyka strony ani sieci. Stare przykłady w historycznych raportach nie są aktualną
  procedurą. Nie dodano zgodności przez akceptację obu SHA pod jednym aliasem.

## Nieaktywny plan dokładnego rollbacku

`cloud42-rules-rollback.json` i `firestore-auth-only.rules` pozostały bajtowo
niezmienione. Konfiguracja ta przywraca wyłącznie template 755 B — **nie** dokładny
historyczny stan 635 B. Nie wolno jej używać jako wiernego rollbacku produkcji.

Nowy `cloud43a-production-rollback.plan.json` nie jest konfiguracją Firebase CLI
ani wykonawcą. `productionRollbackPlan(privateBytes)` wydaje opis dopiero po
weryfikacji pełnych 635 B; template 755 B jest odrzucany. Wynik nadal ma
executionAllowed:false i wymaga:

1. dostępnego prywatnego, dokładnego źródła oraz świadomego przeglądu baseline;
2. osobnej zgody na ponowny oficjalny odczyt bieżących release/rulesetu;
3. porównania z konkretnym zatwierdzonym stanem bieżącym, bez automatycznego
   rejestrowania nowego rulesetu jako „równoważnego”;
4. osobnej zgody na dokładną operację rollbacku i warunki jego wykonania;
5. ponownej kontroli tuż przed mutacją i późniejszego read-back identyfikatorów,
   dokładnego źródła i SHA. Nowe wdrożenie może mieć nowy ruleset ID/updateTime;
   odtworzenie treści nie przywraca historycznych metadanych usługi.

**Ograniczenie transakcyjne:** nie zaimplementowano wykonawcy deployu ani
atomowego CAS aktywnego Rules release. Porównanie dwóch odczytów wykrywa zmianę
zaobserwowaną między nimi; nie gwarantuje wyłączności po drugim odczycie.
Przyszły executor musi mieć osobno zatwierdzony kontrakt ochrony przed równoległą
publikacją. Nie należy podawać zwykłego `firebase deploy` jako implementacji CAS.
W tym zadaniu każda mutacja pozostaje STOP, także po zgodnym świeżym odczycie.
Zmiana Rules po bramce 1 wymaga ponownego przeglądu, nigdy dopasowania pinów.

Rollback uprawnień nie cofa danych ani poprzednich zapisów. Grant i STOP pozostają
jak w CLOUD-4.3; nie zmieniono appEnabled/appAccess, lease ani schematów grantu.
Nie uruchamiano LIVE, admin loginu, Rules API, grantów, IAM, billingu lub Firestore.

## Testy, pliki i hashe

Wyniki lokalne (0 FAIL / 0 SKIP w zakończonych zestawach):

| Zestaw | PASS | Uwagi |
| --- | ---: | --- |
| Prywatne jednostkowe baseline, rollback, fresh-read i blokada loadera | 28 | Oryginał JSON, bez template fallback |
| Oba dokładne Auth-only na emulatorze | 16 | Osobno 635 B i 755 B; grant/control włączone nadal nie dają biznesowego dostępu |
| Pełny Firebase SDK / Security Rules | 71 | demo-meble-app, oficjalny emulator |
| CLOUD-4 live-readiness | 13 | Niezmienione minimalne Rules |
| CLOUD-4.1 private pilot | 10 | Rzeczywisty commit, utrata ACK, osobny reader |
| CLOUD-4.2/4.3 rehearsal | 10 | Aktualny pakiet, niezmieniony writer/reader |
| Plany administracyjne CAS | 4 | Stage/activate/stop bez zmian |
| Prywatny startup Chromium | 3 | Wymagane zmienne loopback |
| Lokalny Preflight smoke | 137 | APP 110/110, składnia 581/581 |
| Load order / zależności / storage / diff --check | PASS | PRE-FLIGHT PASS, 216274 ms |

Istniejące regresje Preflight zachowują PCV 5.01 mb + jeden zapas 10%, rozkrój
4/3/6, sesje/Zapisz/Anuluj, status recovery, WYCENĘ i historię. Bez zmian aplikacji
oraz bez osobnych benchmarków. Nowy smoke sprawdza publiczne metadane/role,
integralność i brak przejścia bramek; nie zastępuje prywatnych testów źródła.

Pierwsza próba prywatnego Chromium była BLOCKED przez HTTP403 gstatic przy pustym
cache SDK. Cache uzupełniono oficjalnymi zainstalowanymi plikami firebase12.19.0
po potwierdzeniu identyczności z trzema istniejącymi SHA CDN; później 10/10 PASS.
Nie zmieniono testów, pinów, emulatora, TLS lub polityki sieci. Pełne Google popup
pozostaje lokalnie zależne od zablokowanego apis.google.com; wykonuje je izolowane
CI po pushu. Wynik CI należy sprawdzić dla dokładnego SHA; nie dziedziczyć PASS
z poprzedniego zadania. [Przebiegi gałęzi](https://github.com/mebleszek/meble-app/actions?query=branch%3Acloud-4-3a-production-rules-baseline).

Dokładna lista zmian (15 plików):

- `.github/workflows/cloud43a-emulator-tests.yml` — wyłącznie push tej gałęzi,
  contents:read, ścisły diff do bazy 2f2704a, brak produkcji/release/secrets;
- `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md`, `BACKUP.md` — aktualny
  STOP, jawne role, prywatny artefakt i procedury; wcześniejsze raporty zachowane;
- `tools/firebase-pilot/cloud43a-baseline.js` — walidator i parser JSON offline;
- `tools/firebase-pilot/cloud43a-production-baseline.json` — przypięte metadane;
- `tools/firebase-pilot/cloud43a-production-rollback.plan.json` — inertny plan;
- `tools/firebase-pilot/cloud42-package.js` — jawne role/hash/proof, usunięty
  niejednoznaczny alias i kontrola integralności nowych narzędzi;
- `tools/firebase-pilot/cloud42-reviewed-loader.mjs.txt` — jawna odmowa przed
  stroną/siecią przy niezatwierdzonym baseline, bez zmiany writer/reader;
- `tools/firebase-pilot/cloud43a-baseline.test.mjs` — prywatne regresje 28/28;
- `tools/firebase-pilot/cloud43a-auth-only.test.mjs` — obie dokładne wersje Rules;
- `tools/cloud43a-production-baseline-smoke.js` — publiczny smoke w Preflight;
- `tools/cloud42-live-preparation-smoke.js` — migracja konsumenta roli/template,
  poszerzenie prób tampering i zachowanie dotychczasowych asercji;
- ten raport.

Potwierdzono diffem brak zmian w index/UI/JS aplikacji, 425 źródłach/pinach,
rejestrze CLOUD-4.3, obu dotychczasowych Rules, deploy/rollback config,
Auth/lease/sesji, modelu projektu/PCV, grantach/STOP i workflow wydaniowym.


Prywatne zestawy wymagają jawnego zewnętrznego `CLOUD43A_PRIVATE_SOURCE` i odmawiają
bez niego — nie generują go z GitHuba ani template. CI bez prywatnego artefaktu
ma dla tych dwóch zestawów **BLOCKED**, nigdy PASS. Wykonano je lokalnie na
oryginale dostarczonym przez właściciela. Izolowane CI tej gałęzi obejmuje pozostałe
niezmienione regresje i publiczny smoke baseline; notice wyraźnie wskazuje zakres.
Nie używa sekretów, nie pobiera produkcyjnego źródła i nie uruchamia wydaniowego CI.

Krótka ścieżka odtworzenia lokalnych testów: ustawić `CLOUD43A_PRIVATE_SOURCE`
na prywatny plik spoza checkoutu, potwierdzić 635 B / SHA; uruchomić
`node tools/firebase-pilot/cloud43a-baseline.test.mjs`, a drugi zestaw przez
`firebase emulators:exec --config tools/firebase-pilot/firebase-live-pilot.json
--project demo-meble-app --only auth,firestore --non-interactive
"node tools/firebase-pilot/cloud43a-auth-only.test.mjs"` z oficjalnymi zależnościami.
Nie używać tych komend z projektem produkcyjnym.

Następna decyzja właściciela: przegląd dokładnego historycznego baseline 635 B,
zachowanie prywatnego artefaktu i osobna zgoda wyłącznie na ponowną odczytową
weryfikację Bramki 1. Ani implementacja, ani testy nie otwierają Bramki 2.

SHA-256 istotnych narzędzi i dowodów:

| Artefakt | SHA-256 |
| --- | --- |
| cloud43a-baseline.js | `ea851d4bd82a578714cbda9465b9c3a0744a5c132bab945695bfeeb7565cb527` |
| cloud43a-production-baseline.json | `4bce7b5fa37626b48f25802ce8d0f0c929a75a8eeb9240aaf9f04483b0bb5a6d` |
| cloud43a-production-rollback.plan.json | `dc6c880912ddc9433bf5cb6c9268d128fb3bcf126f5c4695748ce486b36a68fe` |
| cloud42-package.js | `5b9f5d4946aebdb0ed06965b6a5625ca419f51919a0e6969919bdcbf85fb8763` |
| cloud42-reviewed-loader.mjs.txt | `776bc87a3aadde5e4c8182f2327b8da32ac2e07ac9bdcde2d4da82ae9b983a45` |
| cloud42-source-pins.json | `eb19fbccb00461cffec6559ab443d7b36c784b8e12541a35f9f2afb3d68bf175` |
| cloud43-source-review.json | `d8ed6e6336066cf0e33621838a3d98694202bf510461e21be91ce7dbeceeb2b8` |
| cloud42-rules-rollback.json | `63b76b370caae30c4e6262d772f455f99c8e4c4fea1fa77849280732b5ccde85` |

Kanoniczny indeks 425 pinów nadal ma SHA
`c8439b32a36cb6a76927ba4f968b08b909745286d9d80888923b2fc700d2f1c0`.
Payload nadal 6797 B / SHA
`711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`,
document SHA `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`.

Stan końcowy przygotowania: kod do ponownej **odczytowej** Bramki 1 gotowy
do osobnego przeglądu. Historyczny STOP nie został cofnięty. Wykonywalny deploy/
rollback, zatwierdzenie nowego baseline, archiwum prywatnego źródła u przyszłego
operatora i atomowa ochrona przyszłej publikacji pozostają oddzielnymi warunkami.
Repo nie jest kompletnym prywatnym archiwum rollbacku i nie wolno traktować
zielonych testów jako zgody na wykonanie mutacji lub przejście do Bramki 2.

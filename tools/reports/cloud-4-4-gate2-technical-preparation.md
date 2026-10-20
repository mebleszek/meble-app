# CLOUD-4.4 — integracja i nieaktywne zabezpieczenia Bramki 2

## Baza i zachowana historia

Baza main: `a1f334df824c10bb54384f7c00eb77b661f9d1b0` (PR #70).
Gałąź `cloud-4-4-gate2-technical-preparation` integruje przez merge:
CLOUD-4.3/4.3a/4.3b do `d8f5d3a7f407e887d1b7e16a8263a1049a24934e`
oraz §14 z `e91b2b553325d16ed38ee2a8ff1cb48881672a33`.
Procedura `docs/firebase-rules-gate1-api-explorer.md` i cały AGENTS są zgodne
bajtowo odpowiednio z main i gałęzią zasad. PR #41 pozostaje poza integracją.
CI CLOUD-4.3b [39501236276](https://github.com/mebleszek/meble-app/actions/runs/39501236276)
sprawdzono: SUCCESS dla d8f5d3a. Jest wcześniejszym dowodem, nie nowym CI CLOUD-4.4.
Nie powielono CI ani nie zmieniono wydaniowego workflow.

Wszystkie 425 źródeł przechodzą istniejące `inventory()` i przegląd CLOUD-4.3.
Nie aktualizowano pinów. Kontrakt źródeł nadal wskazuje `44b5be9`: różnica main
a1f334d do tej bazy jest dokumentacyjna. Historyczne raporty, baseline CLOUD-4.3a,
plan rollbacku i nowsza zgoda CLOUD-4.3b pozostają nienaruszone.
`historicalApproval:false` i `baselineAcceptedForGate2Preparation:true` opisują
różne zakresy; żaden nie jest zgodą wykonawczą.

## Nowe mechanizmy, z użyciem istniejących zabezpieczeń

- `cloud44-gate2.js`: offline review osobnych decyzji, projektu/bazy, świeżych
  warunków Spark/braku billingu/rezerwy >=500 reads i >=30 writes, dostępności
  STOP i niezależnej weryfikacji. Pełną tożsamość i źródło sprawdza istniejący
  przypięty `cloud43a-baseline.js`, nie drugi resolver baseline. Po zgodnym
  read-back wymagany jest odczyt tuż przed operacją (maks. 5 s); stare okno
  5 min dotyczy przeglądu. JSON i timestamp nie dowodzą pochodzenia z serwera.
- `rollbackReadiness()` akceptuje tylko rzeczywiste prywatne bajty Buffer,
  przekazuje je do istniejącego `productionRollbackPlan()`. Sprawdza 635 B i SHA,
  odrzuca sam hash, brak źródła, 755 B i zmienione 635 B. Nie zapisuje ani nie
  zwraca treści, nie generuje deploy config i nigdy nie wykonuje rollbacku.
- `executeProduction()` zawsze odmawia. Nawet komplet spreparowanych decyzji
  i zgodnych danych nie usuwa blokady wykonawcy i braku ochrony publikacji Rules.
  Dotychczasowy loader `.mjs.txt` zachowano bez zmiany; rzeczywista próba jego
  wywołania z dokładnym pakietem i nazwanym kompletnym rekordem decyzji odmawia
  przed dotknięciem strony. To nie publiczna flaga, URL ani integracja z logowaniem.
- `openDemoOperator()`: jawny model PREPARED → STAGED → ACTIVE → jedna próba
  WRITE → jeden niezależny READ → STOP_UNVERIFIED → STOP_VERIFIED. Obejmuje
  PUBLICATION_UNCERTAIN i STOP_REQUIRED. Niepewność zużywa próbę; brak retry.
  Deadline sprawdzany przed i po await. STOP jest niezależny od zegara klienta
  i może działać podczas zawieszonego IO; spóźniony wynik nie przywraca stanu.
  Współpracujący operatorzy w jednym procesie są wykluczani do zweryfikowanego
  STOP i rozstrzygnięcia trwającego IO. To wyłącznie rehearsal, nie trwały lock
  wszystkich administratorów ani produkcyjny dziennik prób.
- `cloud44-emulator-admin.mjs`: wyłącznie demo-meble-app, dwa jawne hosty
  emulatorów oraz kontrola faktycznego SDK host/SSL. Stosuje istniejące
  `grantActions`, `assertExpected`, `stopAction`; pełne porównanie trzech
  rekordów w transakcji, wyłącznie ograniczone update/create, maxAttempts=1.
  Konflikt nie uruchamia automatycznego ponowienia. STOP nie przywraca
  appEnabled/globalDataEnabled i nie usuwa opublikowanego projektu.
- `verifyPostOperation()` przygotowuje kontrolę pełnej oczekiwanej nowej
  tożsamości release/rulesetu i oryginalnych bajtów po przyszłej operacji.
  Zgodność samych hashy nie akceptuje obcego rulesetu. Wynik nie jest dowodem
  uwierzytelnionego odczytu; przyszły reader musi samodzielnie wykonać oficjalny GET.
- `cloud44-integrity.json` przypina narzędzia, testy, stare dowody, loader,
  §14 i procedurę PR #70; nowy smoke sprawdza te SHA oraz uruchamia regresje.
  Manifest jest dowodem integralności do przeglądu, nie podpisem ani zgodą.

## Granica atomowości i procedura wyłączności

Sprawdzono lokalny kod firebase-tools 15.34.0,
`lib/gcp/rules.js:updateRelease()`: PATCH zawiera release.name/rulesetName,
bez warunku oczekiwanej poprzedniej wersji, ETag lub compare-updateTime.
Nie ma zweryfikowanego atomowego CAS publikacji w tej ścieżce/API kontrakcie.
Dwa GET wykrywają zaobserwowaną zmianę, lecz nie zamykają luki po drugim GET.
Transakcja Firestore grantu nie blokuje Firebase Rules API, konsoli ani innych
administratorów. Lock rehearsal także tego nie gwarantuje.

Przed przyszłym wykonaniem trzeba osobno uzgodnić i dowieść wyłączność:
zinwentaryzować wszystkie ścieżki publikacji i uprawnionych operatorów,
wstrzymać inne wydania/zadania/edycje konsoli, wskazać jednego wykonawcę,
operatora STOP i niezależnego weryfikatora oraz okno utrzymania wyłączności.
Samo oświadczenie `exclusive:true` jest niewystarczające. Nieznany operator,
brak pokrycia którejkolwiek ścieżki, utrata wyłączności lub dowodu = STOP.
W tym pakiecie nie zmieniano IAM ani nie dowiedziono takiej wyłączności;
produkcyjny executor nie powstał. Nowy zatwierdzony executor/kontrakt wymaga
osobnego przeglądu; zmiana flagi nie otworzy istniejącego loadera.

## Operator: przyszła sekwencja i STOP (obecnie niewykonywana)

1. Udostępnienie oryginalnych prywatnych 635 B poza repo/CI i ich weryfikacja.
   W tym zadaniu źródła nie przekazano; brak pozytywnego dowodu posiadania.
2. Po osobnej zgodzie świeże GET według niezmienionej procedury PR #70;
   pełna tożsamość i SHA, Spark, billing i kwoty. Brak HTTP200/dowodu = STOP.
3. Osobne zgody na dokładne minimalne Rules i wycofanie; przed operacją
   ponowny odczyt i utrzymana wyłączność. Po operacji niezależny GET z pełną
   kontrolą oczekiwanego nowego rulesetu i źródła. Brak zgodności = STOP,
   bez automatycznego deployu, rollbacku lub dopasowania baseline.
4. Oddzielnie zatwierdzony UID i istniejący plan stage → activate → stop;
   trzy dokumenty czytane i porównywane w transakcji, aktualizowane tylko
   dozwolone pola. Bez zastępowania dokumentów starszym snapshotem.
5. Dwa odizolowane, pojedyncze uchwyty writer i reader tej samej zatwierdzonej
   sesji Google/UID; każdy z osobną zgodą i rolą. Jeden zapis syntetyczny,
   pełne potwierdzenie, niezależny reader z walidacją bajtów/modelu/hashy do RAM.
   Obecne Rules NIE rozdzielają uprawnień serwerowych reader/writer; rozdzielenie
   uchwytów jest ograniczeniem operatora, a nie serwerową rolą read-only.
   Wymóg serwerowej separacji wymagałby osobnego zatwierdzenia Rules/grantu.
6. Sukces: zamknąć uchwyty, ograniczony STOP i niezależnie potwierdzić obie
   flagi false, odmowę biznesowego dostępu i zachowanie normalnego Auth-only.
   Częściowy staging, odmowa, wygaśnięcie, utrata Auth, konflikt albo brak
   potwierdzenia: wstrzymać dalsze zapisy i wykonać zatwierdzony admin STOP.
   Przy niepewnym wyniku tylko osobno zatwierdzony niezależny odczyt, nigdy
   ślepy retry. Konflikt STOP wymaga świeżego przeglądu i nowego ograniczonego
   planu, bez nadpisania starego snapshotu. Brak read-back STOP pozostawia blokadę.
   Termin klienta NIE jest server TTL — po testowym przesunięciu zegara klienta
   emulator nadal pozwala na dostęp; dopiero administracyjny STOP wyłącza grant.
   STOP/rollback uprawnień nie cofa wcześniejszych zatwierdzonych zapisów.

## Weryfikacja tej gałęzi

Node22, Java21, Chromium z dotykiem i oficjalny emulator Firestore v1.22.0.
Instancje emulatorów uruchamiano sekwencyjnie; wyłącznie demo/loopback.

| Zestaw | Rzeczywisty wynik |
| --- | --- |
| Nowe offline: dowody, rollback odmowy, zgody, konflikt operatorów, await/STOP, loader i post-readback | 24 PASS / 0 FAIL / 0 SKIP |
| CLOUD-4.2 istniejące transakcje administracyjne | 4 PASS / 0 FAIL / 0 SKIP |
| CLOUD-4 live-readiness | 13 PASS / 0 FAIL / 0 SKIP |
| Pełne Firebase SDK/Rules (obejmuje również powyższe 13) | 71 PASS / 0 FAIL / 0 SKIP |
| Prywatny startup Chromium | 3 PASS / 0 FAIL / 0 SKIP |
| Pełny Chromium/Auth z nowym scenariuszem CLOUD-4.4 | 37 PASS / 2 FAIL / 0 SKIP |
| Końcowy CLOUD-4.4 admin CAS/STOP/expiry | 6 PASS / 0 FAIL / 0 SKIP |
| Końcowy prywatny Chromium/rehearsal | 11 PASS / 0 FAIL / 0 SKIP |
| Pełny lokalny Preflight | PRE-FLIGHT PASS: 139/139 smoke, APP 110/110, składnia 584/584; 154570 ms |
| git diff --check | PASS |
| Prywatny cloud43a-baseline.test.mjs i dual Auth-only | BLOCKED: oryginalne prywatne 635 B nieudostępnione; nie uruchomiono |

Dwa rzeczywiście wykonane testy popup Google zakończyły się FAIL środowiskowym:
GET `https://apis.google.com/js/api.js` zwraca HTTP403, a następnie brak popup /
auth/internal-error. Ten zakres pełnego Auth pozostaje BLOCKED. Nie zmieniono
asercji, nie podstawiono helpera, nie obchodzono TLS/polityki sieci i nie
uruchamiano CI ponownie. Pozostałe 37 rzeczywiście zaliczonych testów obejmuje
prawdziwy główny gate Auth, sesje/restart, prywatny roundtrip i nowy operator.

Próba CLOUD-4.4 rzeczywiście opublikowała manifest na emulatorze i odczytała
6797 B w niezależnym kontekście; model/PCV, revisionId i document SHA zgodne.
Administracyjny STOP zachował projekt, normalny Auth i RAW/RAM operatora.
Istniejące testy utraty ACK wykonały rzeczywisty commit przed przerwaniem
odpowiedzi; writer odmówił retry, a osobny reader zweryfikował zapis.
Po dodatkowej korekcie epoch powtórzono 24 testy offline i prywatny podzbiór
Chromium (11); nie powtarzano niezwiązanych popupów ani benchmarków.
Nie sumować powtórzeń/nakładających się zestawów jako nowych unikalnych testów.

## Integralność i zakres

Manifest CLOUD-4.4 SHA-256: `b0c48e289c42749c5c163719ad900ce6fb395cfe22afcb51797c3d4e2f97193e`.
425 pinów (canonical): `c8439b32a36cb6a76927ba4f968b08b909745286d9d80888923b2fc700d2f1c0`.
Pakiet: `5b9f5d4946aebdb0ed06965b6a5625ca419f51919a0e6969919bdcbf85fb8763`.
Loader: `776bc87a3aadde5e4c8182f2327b8da32ac2e07ac9bdcde2d4da82ae9b983a45`.
Minimalne Rules: `eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`.
Historyczne 635 B: `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`.
Ten ostatni hash nie dowodzi posiadania pliku.

Nowy kod i regresje mieszczą się w tools; brak zmian aplikacji/UI, jej Rules,
425 źródeł, danych, globalnych katalogów/cenników/magazynu, historii ofert,
sesji/Zapisz/Anuluj, PCV/10% i rozkroju 4/3/6. Nie dodano store ani transportu.
Dokumentację bieżącą uzupełniono krótkimi statusami i tym jednym raportem.
Historyczne raporty pozostawiono bez edycji.

**Stan:** zintegrowany pakiet techniczny; produkcyjna Bramka 2 BLOCKED przez
brak oryginalnych prywatnych bajtów, świeżych dowodów, produkcyjnych zgód,
dowiedzionej wyłączności/atomowości i zatwierdzonego wykonawcy. Pełne testy Auth
również mają opisany bloker środowiskowy. Nie ma zgody na żadną operację LIVE.
Rekomendowana następna decyzja: wyłącznie odczytowe uzupełnienie dowodów
(prywatne 635 B, bieżący stan i warunki wyłączności), bez deployu lub aktywacji.
Bez PR, merge do main, Pages, Firebase LIVE, Rules/grantów/IAM/billingu.

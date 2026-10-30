# ROADMAP — plan rozwoju Meble-App

> **Jak czytać:** `ROADMAP.md` przechowuje plan, zależności i decyzje przyszłe. **Aktualny stan wykonania, zaliczone CI/Pages, blokery i jeden następny ruch są wyłącznie w [CURRENT_STATE.md](CURRENT_STATE.md)**. Nie aktualizować obu plików równoległymi kopiami statusów. Starsze sekcje poniżej są historią planowania i nie anulują późniejszych wydań.

## Najbliższa kolejność — weryfikacja 30.10.2026

1. **Dokończyć proces wydania niniejszego porządku dokumentacji** — tylko po odrębnej zgodzie właściciela na dokładny HEAD/BASE; bez uruchamiania Firebase LIVE.
2. **Naprawa zgłoszonych błędów Androida po PR #86:** nieotwierający się inwestor, chwilowo cudze pomieszczenia przy tworzeniu nowego oraz separator i wygląd Zaufany/Wyloguj. Dopiero po naprawie i nowej zgodzie wydaniowej powtórzyć test telefonu.
3. **Następny logiczny pakiet produktu** wybrać po wyniku testu Androida i analizie aktualnego `main`. Trwały LOCAL-FIRST istnieje jako izolowana implementacja w wydanym PR #84, ale realna synchronizacja i bezstratna migracja pozostają niewdrożone. Obowiązują wszystkie bramki bezpieczeństwa opisane niżej.

> **Dalsze sekcje:** decyzje nadal obowiązujące są wiążące; opisy dawnych stanów i etykiety `CI_PENDING`/`priorytet 1` są migawkami historycznymi. Najnowsze statusy czytaj w `CURRENT_STATE.md`.

## WSPÓLNY PIN MEBLE-APP — ODROCZONY DO DZIAŁAJĄCEJ CHMURY (decyzja 28.10.2026)

**Decyzja właściciela:** PIN bezpieczeństwa wprowadzamy dopiero po uruchomieniu bezpiecznej, wspólnej usługi chmurowej pozwalającej weryfikować go na różnych urządzeniach. Nie należy dodawać PIN-u ani blokować obecnego pakietu zaufanych urządzeń z powodu jego braku. Do tego czasu checkbox „Zaufaj temu urządzeniu” pozostaje świadomą, dobrowolną decyzją zalogowanego i zatwierdzonego właściciela; może on zaznaczyć go również na własnym laptopie lub tablecie. Niezaufana sesja komputera nadal ma limit 5 minut bezczynności i wymaga nowego logowania po zamknięciu przeglądarki.

**Docelowy UX i kontrakt:**
- Jeden wspólny PIN dla konta właściciela, obowiązujący na wszystkich jego urządzeniach; bez osobnych PIN-ów na telefon/laptop/tablet.
- Własny PIN ustalany i potwierdzany przy pierwszej konfiguracji funkcji po jej udostępnieniu; bez domyślnego `123456` ani innego fabrycznego PIN-u.
- Po zalogowaniu Google i świeżym sprawdzeniu uprawnień zaznaczenie „Zaufaj temu urządzeniu” wymaga poprawnego PIN-u przed zapisaniem lokalnego zaufania.
- Trybik → Ustawienia → Bezpieczeństwo → Zmień PIN: stary PIN, nowy PIN i potwierdzenie nowego. Zaplanować też bezpieczne odzyskiwanie/reset po silnym ponownym uwierzytelnieniu właściciela.
- Wspólna weryfikacja PIN-u musi opierać się na zatwierdzonym mechanizmie serwerowym, z ograniczaniem prób i ochroną przed zgadywaniem. Nie zapisywać PIN-u jawnie w aplikacji, lokalnych magazynach, dokumentach ani repozytorium. PIN stanowi dodatkowe potwierdzenie nadania zaufania, nie zastępuje Google Auth, uprawnień Firebase ani kontroli dostępu do danych.
- Szczegółowy model bezpieczeństwa, UI, migrację i testy uzgodnić w osobnym pakiecie przed implementacją. Dostępność chmury nie jest automatyczną zgodą na Firebase LIVE, Rules, granty, migrację ani wydanie.

**Status: PLANNED / DEFERRED / NOT_IMPLEMENTED / LIVE_BLOCKED.** Obecne wydanie zaufanego telefonu i sesji komputera zachowuje własne, odrębne bramki CI, wydania i testu fizycznego Androida.

## LOCAL-FIRST SYNC — bieżący pakiet 28.10.2026

Właściciel wznowił implementację produktu. Wcześniejsze wstrzymanie z 25.10 jest historyczne; Firebase LIVE, migracja i wydanie nadal mają osobne bramki. PR #77/#78/#83 są wydane (dla #83 właściciel potwierdził Pixel). Nie powtarzamy ich CI ani operatora CLOUD-4.6F.

Zaimplementowano oddzielną transakcyjną IndexedDB danych/outbox/RAW, koordynator automatyczny, przepływ 14 domen CLOUD-3, projektowe chunki CLOUD-2B, trwały fence edytora, przekazanie bez timeout oraz rozstrzyganie ACK bez ponowienia mutacji. Przygotowano rzeczywisty binder globalnego Firebase wymagający podpisanej, odrębnej aktywacji i dowodu migracji. Startup/UX i wszystkie dotychczasowe magazyny pozostają niepodłączone.

Najbliższy pakiet dowodowy: osobno zatwierdzone CI dla HEAD/BASE tej gałęzi (nowe regresje rzeczywistej IDB i Auth/Firestore + zachowane stare testy). Następnie rozstrzygnięcie profilu realnych projektów i nierozstrzygniętych domen, ochrony starych writerów oraz bezstratne podłączenie zatwierdzania sesji. Dopiero z tymi dowodami: zgody na Rules/granty/migrację, kontrolowane LIVE i uruchomienie na telefonie/tablecie/komputerze. Sukces syntetycznego pilota nie oznacza synchronizacji aplikacji. Bez wymogu obsługi Windowsa.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** [Dokładny zakres i pozostałe warunki](tools/reports/local-first-sync-20261028.md). Poniższa kolejność architektoniczna pozostaje aktualna; jej opisy „przyszła implementacja” należy czytać z powyższym zakresem już przygotowanego kodu.

## STORAGE RECOVERY / INDEXEDDB — PRIORYTET 1 (25.10.2026)

**Decyzja właściciela: najpierw ratowanie pamięci Androida i lokalne archiwum backupów. CLOUD / CLOUD-4.6F / FIREBASE LIVE / rozwój SYNCHRONIZACJI — WSTRZYMANE do osobnej decyzji.** Nie usuwamy planów ani wyników poniżej; ten wpis aktualizuje ich bieżącą kolejność.

1. Zatwierdzony pakiet lokalny: Tryb ratunkowy w tej samej karcie, prywatny szyfrowany eksport z kontrolą pobranego pliku, kopia `fc_data_backups_v1` do dedykowanej biznesowej IndexedDB i weryfikacja bez usuwania źródła. [Kontrakt i bramki](BACKUP.md#android-storage-recovery--indexeddb-v1).
2. Osobna zgoda wydaniowa i akceptacja fizycznego telefonu, z uprzednim rozstrzygnięciem niezabezpieczonego RAM; bez wymuszonego restartu. Osobna świadoma decyzja E dla dokładnego archiwum dopiero po komplecie dowodów. Samo kopiowanie nie zwalnia miejsca ani nie odblokowuje sesji.
3. Dopiero po potwierdzonym przełączeniu i zwolnieniu miejsca: pomiar i istniejący bezpieczny protokół ponowienia pierwszego begin. Brak dowodu baseline pozostawia edycję zablokowaną.
4. Później, niezależnie i za osobną zgodą: historia ofert, projekty lub inne domeny. Obecny v1 ich nie migruje i nie zmienia modelu danych/synchronizacji.

To wcześniejsze, ograniczone wykonanie części etapu LOCAL-FIRST „Trwały zapis lokalny / Pamięć i ratowanie danych”, **nie** wykonanie pełnego LOCAL-FIRST ani zastąpienie jego warunków. Obowiązkowy POST-CLOUD-STORAGE-RESILIENCE nadal obejmuje wieloletni wzrost wszystkich domen, retencję i recovery; archiwum backupów nie zamyka tego wymagania. Dalsze zależności chmurowe zachowujemy na czas późniejszego wznowienia. [Raport implementacji](tools/reports/android-storage-recovery-indexeddb-v1.md).


## CLOUD-SYNC-1 — pierwszy przepływ produktu na emulatorach

Zaimplementowano kompozycję CLOUD-3 dla kompletu 14 domen i izolowany odbiór w pamięci B. PR #78 scalony; wymagane CI zakończone, stan wydania potwierdzony przez właściciela. **RELEASED / LIVE_BLOCKED**. Nowe rozszerzenia LOCAL-FIRST powyżej mają odrębne CI_PENDING. [Kontrakt zastosowania, pokrycie i ograniczenia](tools/reports/cloud-sync-1-global-data.md).

Rozwój na emulatorach jest niezależny od prywatnego operatora CLOUD-4.6F (**OPERATOR_PARTIAL**). Po weryfikacji przepływu osobnego zakresu wymagają trwałe lokalne transakcje/pending work, integracja z writerami domen i ochrona pracy offline. Nie włącza się produkcyjnej synchronizacji, migracji ani automatycznego zastępowania lokalnych danych. Docelowa kolejność pozostaje: kontrolowany syntetyczny LIVE → bezstratne dane biznesowe/synchronizacja → synchronizacja projektów → pełny LOCAL-FIRST.

## CLOUD-4.6E — następny wynik: kontrolowany test syntetyczny

Prywatne wejście operatora wiąże wydaną orkiestrację 4.6D z konkretnymi sesjami i SDK. Wymaga osobno podpisanych decyzji, rzeczywistych 635 B rollbacku i prywatnego runtime; obecny pakiet nie wykonuje LIVE. PR [#77](https://github.com/mebleszek/meble-app/pull/77) wydany do main `7faf4f097b6be0a8a0edcce922561e6632d9707c`; właściciel potwierdził Preflight, SDK/Rules, auto-merge i Pages PASS. CLOUD-4.6E: **RELEASED / LIVE_BLOCKED**. [Instrukcja i pozostałe warunki](tools/reports/cloud-4-6d-live-execution-preparation.md#cloud-46e--połączenie-operatora).

Kolejność: (1) osobno zatwierdzony kontrolowany syntetyczny LIVE, (2) bezstratne podłączenie kompletnych danych biznesowych i synchronizacji, (3) automatyczna synchronizacja projektów między urządzeniami, (4) pełny LOCAL-FIRST i odporność na utratę internetu. Punkty 2–4 pozostają osobnymi zakresami; sukces pilota nie dowodzi działającej synchronizacji aplikacji.

## CLOUD-4.6D — wydany kandydat produkcyjny

PR [#76](https://github.com/mebleszek/meble-app/pull/76) wydany do main `4b8ef922a4596372eba4a48b52de1bdff6585f4f`; właściciel potwierdził SUCCESS CI, auto-merge i Pages. CLOUD-4.6D: **RELEASED / LIVE_BLOCKED**. Historyczne CI_PENDING w raporcie opisuje stan sprzed tego wydania.

## CLOUD-4.6C — wydany etap emulatorowy

Izolowana orkiestracja pełnego cyklu została wydana w PR #75, main `fd36b2e6fee433c92676d7619dc672d4361d9d59`; właściciel potwierdził SUCCESS CI/merge/Pages. To zakończony etap emulatorowy. Następnie przyszła aktywacja wymaga prywatnych 635 B, świeżych dowodów, efektywnego IAM/delegacji, dowiedzionej wyłączności wszystkich ścieżek publikacji, nazwanych operatorów oraz osobnej implementacji i zgód na Rules/grant/WRITE/READ/STOP. [Checklista niebędąca zgodą](tools/reports/cloud-4-6c-isolated-executor.md#checklista-przyszłej-aktywacji--nie-jest-zgodą-wykonawczą). **RELEASED / LIVE_BLOCKED**. Nie otwarto Bramki 2 ani synchronizacji LOCAL-FIRST.

## LOCAL-FIRST

**Decyzja właściciela z 21.10.2026 — przyszła implementacja, jeszcze niewdrożona.** Obowiązuje [pełny kontrakt w CLOUD_MIGRATION.md](CLOUD_MIGRATION.md#local-first): LOCAL-FIRST, automatyczna synchronizacja, jeden aktywny edytor na projekt i bezpieczna praca offline. Ta sekcja aktualizuje kolejność dalszych prac bez ponawiania CLOUD-1/2/3/4. Starsze wpisy poniżej zachowują historię; ich sformułowania o przełączeniu autorytetu wyłącznie na chmurę należy czytać w świetle nowego kontraktu. Nie jest to zgoda na implementację, migrację ani LIVE.

| Kolejność / zależność | Przyszły zakres | Warunek przejścia |
|---|---|---|
| Osobno: CLOUD-4.6 | Kontrola gotowości pierwszego syntetycznego Firebase LIVE z wykorzystaniem istniejącego CLOUD-4.4. | Własny zatwierdzony zakres i aktualne dowody; żadnego otwarcia Bramki 2 przez ten dokument. Produkcyjne odczyty, Rules, grant, write/read i zakończenie wymagają odpowiednich osobnych zgód. Sukces pilota nie oznacza synchronizacji. |
| 1. Model danych i zależności | Jeden kanoniczny model, rewizje i właściciele; pełne zależności WYCENY/ROZRYSU, katalogi, stawki, materiały, magazyn i historia. Wykorzystać CLOUD-3 oraz CLOUD_DATA_REGISTER, nie tworzyć konkurencyjnego rejestru. | Rozstrzygnąć Issue #47 (globalne słoje/rotacja), legacy PCV/overrides, aliasy i drafty. Bez zgadywania własności i bez automatycznej migracji. Osobno określić ochronę globalnych writerów i sekretów. |
| 2. Trwały zapis lokalny | Zaprojektować IndexedDB projektów i kolejki zmian, potwierdzenia transakcji, quota, awarie i odzyskiwanie po restarcie. | Projekt i obowiązek publikacji nie mogą się rozchodzić. Oddzielić techniczną bazę profilu dostępu od biznesowej. Przed migracją: osobna zgoda, zweryfikowana kopia również pomijanych przez obecny backup danych/aliasów i dowód bezstratności. Bez resetu lub kasowania jedynej kopii. |
| 3. Dostęp i wyłączność edycji | Jeden aktywny edytor całego projektu, pozostałe urządzenia read-only; bezpieczne przekazanie oraz odrębny kontrakt dostępu i kontynuacji offline. | Nie omijać obecnego Google gate. Udowodnić ochronę zmian przy utracie sieci, cofnięciu dostępu, wygasłym lease i awaryjnym przejęciu; brak dowodu bezstratności = STOP. Nie obiecywać zdalnego zatrzymania odłączonego urządzenia samym timeoutem. |
| 4. Automatyczne uzgadnianie | Po potwierdzeniu lokalnym automatyczna publikacja; odbiór potwierdzonych wersji na uruchomionych urządzeniach. Kontrola rewizji, jednoznaczność operacji i odzyskiwanie niepewnego wyniku. | Zależności 1–3, testy emulatorowe i osobno zatwierdzona aktywacja transportu/domen. Brak ślepego retry, duplikacji, nadpisania kolejki i importu starego RAM. Bez obowiązkowego przycisku „Synchronizuj”. |
| 5. Przygotowanie offline | Przygotowany runtime, projekt i kompletny zestaw zależności na konkretnym urządzeniu/wersji; przyszła pomocnicza opcja „Dostępny offline” i rozdzielone statusy. | Zależności 1–4, dowód lokalnej kompletności, dostępu i prawa edycji. Chmurowy zapis nie potwierdza kopii zamkniętego telefonu; brak danych = odmowa wymagającej ich operacji. Przyszły UX wymaga zatwierdzenia implementacji, obecnego UI nie zmieniamy. |
| 6. Pamięć i ratowanie danych | Pojemność, persist/estimate, utrata bazy, ochrona niesynchronizowanej pracy i odrębna polityka miejsca. | IndexedDB/persist nie gwarantują nieutracalności. Rozróżnić odtwarzalne kopie i jedyne zmiany; bez arbitralnego usuwania projektów po 7/30 dniach. Nie zmieniać istniejącej retencji backupów przy okazji. Bezpieczeństwo to warunek wcześniejszych etapów, a automatyczne zwalnianie miejsca wymaga osobnej decyzji. |
| 7. Akceptacja i kontrolowane włączenie | Dziesięć scenariuszy z kontraktu, właściwe CI, niezależny odczyt oraz telefon/tablet/komputer i fizyczna ergonomia. | [Kryteria przyszłej akceptacji](CLOUD_MIGRATION.md#kryteria-przyszłej-akceptacji) są NIEWYKONANE, nie PASS. Chronić PCV/10%, 4/3/6, Zapisz/Anuluj, historię i globalne RAW. Wydanie, rzeczywisty transfer danych i migracja pozostają osobno zatwierdzane. |
| Później, osobny zakres | Tymczasowy, odwoływalny podgląd klienta przez przeglądarkę na żywo. | Wyłącznie read-only, bez wewnętrznych kosztów i danych firmy bez zgody; osobny model uprawnień i projekcji danych. Nie wdrażamy tego teraz. |

Projektowanie zależnych obszarów może być jednym uzgodnionym pakietem, lecz żadna kolejność nie pozwala włączyć offline lub synchronizacji przed udowodnieniem warunków bezpieczeństwa. Nie ustalamy teraz algorytmu przejęcia, schematu IndexedDB, sposobu migracji nierozstrzygniętych danych ani polityki dostępu offline. Cel kosztowy pozostaje Spark i 0 zł stałych opłat bez włączania billingu. Ten pakiet dokumentacyjny ma status `CODE_READY / CI_PENDING / LIVE_BLOCKED`, bez PR i wydania.

### POST-CLOUD-STORAGE-RESILIENCE — trwała odporność pamięci urządzeń

**Decyzja właściciela z 24.10.2026: obowiązkowy, osobny, priorytetowy pakiet po wymaganych etapach CLOUD i pełnym bezpiecznym LOCAL-FIRST, nie luźna propozycja.** Dotyczy telefonu, tabletu i komputera. Wdrożenie wymaga osobnej zgody; obecna zgoda obejmuje analizę i dokumentację. Nie zmienia kolejności etapów powyżej ani zgód LIVE.

Pakiet rozwija istniejący etap **6. Pamięć i ratowanie danych**. Jego wymagania należy uwzględniać już przy projektowaniu **2. Trwałego zapisu lokalnego**, aby nie przenieść niekontrolowanego wzrostu z localStorage do IndexedDB. Zależności: bezstratne domeny i rewizje, działająca synchronizacja z niezależnym odczytem, trwały zapis wraz z kolejką, pojedynczy aktywny edytor, ochrona pracy offline i sprawdzalne odzyskiwanie. Kanoniczny kontrakt, rekomendowaną architekturę i przyszłe testy doprecyzowuje [istniejąca sekcja quota w CLOUD_MIGRATION](CLOUD_MIGRATION.md#post-cloud-storage-resilience--wymaganie-z-24102026); rejestr własności pozostaje w CLOUD_DATA_REGISTER.md.

Wymagany rezultat:

- Wieloletni przyrost projektów, ofert, katalogów, backupów i rozkrojów nie prowadzi do cyklicznej blokady edycji przez niekontrolowany rozrost lokalnych danych. Nie obiecujemy nieskończonej pojemności urządzenia; rzeczywisty brak miejsca ma być obsłużony bez utraty informacji i fałszywego potwierdzenia zapisu.
- Odrębne polityki dla bieżących danych biznesowych, zamrożonej historii ofert, niezależnych kopii bezpieczeństwa i danych odtwarzalnych/cache. Sam limit liczby rekordów lub zwiększenie liczby wpisów cache nie wystarcza; potrzebne są budżety rozmiaru i kontrola wzrostu.
- Docelowy podział: mały localStorage na minimalny stan techniczny, transakcyjny trwały magazyn biznesowy i kolejka lokalna, chmura na potwierdzone wersje/archiwum oraz limitowane dane odtwarzalne. Jeden model danych, bez konkurencyjnych autorytetów i obowiązkowych ręcznych eksportów podczas normalnej pracy.
- Ochrona kompletnego zestawu offline, draftów, decyzji PCV/słojów, intencji i niesynchronizowanych zmian. Lokalnej kopii nie wolno zwalniać na podstawie samego uploadu; wymagane są dowody kompletności i odtworzenia właściwej rewizji oraz zachowanie obiecanej dostępności offline.
- Monitoring rozmiarów magazynów, rezerwy na transakcje/zastępowanie danych, ostrzeganie i bezpieczna odmowa przed nieodwracalnymi skutkami. Rzeczywiste limity odróżnić od estymat; progi uzasadnić pomiarami na urządzeniach, bez przyjęcia arbitralnej liczby MB.
- Bezstratna, wznawialna i weryfikowalna migracja: pełna prywatna kopia również pomijanych dziś RAW, kontrola integralności, rewizji i zależności, test awarii w połowie oraz sprawdzone recovery. Bez resetu, usunięcia jedynej kopii i zmiany obecnej retencji przy okazji.
- Akceptacja na fizycznym telefonie Android, tablecie i komputerze: wieloletni wzrost historii/backupów/cache/katalogów, pełna pamięć, utrata ACK/sieci, restarty, migracja i przywrócenie. Kryteria są przyszłe i NIEWYKONANE; nie są PASS z PR #80.

**Osobny tor pilny — obecny Pixel:** [incydent i plan zabezpieczenia](CURRENT_STATE.md#android-quota--incydent-z-24102026). Identyfikacja największego klucza i prywatna kopia ratunkowa nie mogą czekać na zakończenie CLOUD. Dopiero po ich weryfikacji osobna decyzja o odzyskaniu miejsca; niniejszy zapis nie uruchamia eksportera, kasowania, migracji, resetu ani Firebase LIVE.

## CLOUD-4.4 — następna bramka zależy od dowodów

Istniejące przygotowanie CLOUD-4.3–4.3b i kontrakt współpracy są zintegrowane na jednej gałęzi CLOUD-4.4. Przed produkcyjną Bramką 2 potrzebne są dostępne oryginalne 635 B, osobno zatwierdzone świeże dowody i rozstrzygnięta wyłączność publikacji Rules. Dwa GET nie są atomowym CAS; brak dowodu oznacza STOP. [Pakiet techniczny i testy](tools/reports/cloud-4-4-gate2-technical-preparation.md). Nie zmienia to dalszych zależności Issue #47, aliasów, historii ofert i ochrony danych.

## CLOUD-4.3b — aktualny następny etap: przygotowanie Bramki 2, nie wykonanie produkcyjne

20.10.2026: właściciel zatwierdził baseline 635 B po dwóch GET HTTP 200 tylko do przygotowania Bramki 2. Formalny PASS odczytów Rules i osobna zgoda na przygotowanie są zapisane bez odblokowania LIVE. Następne zależności: dostępna i zweryfikowana prywatna kopia rollbacku 635 B (template 755 B to INNY plik), procedura wyłączności/operatora bez pozornego CAS Rules, świeża kontrola Spark/billing/limitów, konkretny operator STOP oraz odrębne decyzje na wydanie kodu, deploy Rules, grant, syntetyczny write/read i zakończenie. Pełna migracja pozostaje późniejsza. [Plan i blokery](tools/reports/cloud-4-3b-gate1-closure.md).


## CLOUD-4.3a — uzgodnienie źródła Auth-only przed ponowną Bramką 1

Potwierdzono offline różnicę 635 B produkcji i 755 B dotychczasowego template.
Historyczny STOP pozostaje. Następna decyzja obejmuje przegląd baseline 635 B
oraz ponowną, odczytową kontrolę Bramki 1; bez zgody na Bramkę 2 lub mutacje.
[Metadane, ograniczenia i testy](tools/reports/cloud-4-3a-production-rules-baseline.md).

## CLOUD-4.3 — aktualizacja istniejącego pakietu, bez synchronizacji

Przegląd pinów i zgodności z main `44b5be9…`, próby syntetyczne i oddzielne
bramki przyszłego LIVE opisuje [raport CLOUD-4.3](tools/reports/cloud-4-3-live-readiness-refresh.md).
Następna decyzja: wyłącznie bramka 1, odczytowa kontrola projektu/bazy, aktywnego
Rules release, Spark i rezerwy kwot. Nie jest to zgoda na jej wykonanie.
Po późniejszym pilocie nadal wymagane są Issue #47 (globalne słoje/rotacja),
frozen historia/drafty, aliasy legacy, ochrona danych klientów, konflikty urządzeń
i praca offline. Nie przełączono autorytetu danych ani nie włączono synchronizacji.

## Bieżący pakiet po PR #66 — wydajność WYCENY i ważność dostępu

PR #65/#66 są scalone; baza `764d0852`. Gałąź `fix/quote-performance-auth-renewal`
ogranicza powtórzenia rzeczywistych obliczeń przy zachowaniu rewizji, PCV, sesji i historii.
[Zmiany, pomiary przed/po, testy i akceptacja Pixela](tools/reports/quote-performance-auth-renewal.md).
Następna bramka: dokończenie dwóch testów popup Google blokowanych przez HTTP 403,
osobna decyzja właściciela o próbie wydania, potem test fizycznego telefonu.
Nie włącza CLOUD-4.2 ani nowego trwałego cache. Historyczne etapy poniżej zachowano.


## Bieżący pakiet po PR #65 — odzyskiwanie intencji i cykl WYCENY

PR #65 jest scalony (`0ae7d1a24091d4a57460bacc9d30b9ea386f5b35`); stare nagłówki gałęzi zachowano.
Na `fix/offer-status-recovery-lifecycle` przygotowywana jest zgodna wstecznie naprawa odzyskiwania
`offerStatus`, z testami całego cyklu ofert i mobilnego Chromium.
[Raport](tools/reports/offer-status-recovery-lifecycle.md). Dalsza bramka: osobna decyzja wydaniowa,
potem test Pixela bez ręcznego usuwania intencji, resetu lub importowania profilu.


## Pakiet spójności kontekstu po PR #64

Gałąź `fix/project-context-coherence` na main `431545d3`: jedno źródło projektu dla ROZRYS/WYCENY,
odczytowy render, unieważnianie obliczenia przy zmianie kontekstu i zachowanie świeżego błędu.
[Raport i regresje](tools/reports/project-context-coherence-fix.md). Następna bramka po pełnej
weryfikacji: osobna zgoda na próbę wydania; później akceptacja Androida. Nie aktywuje CLOUD-4.2.

## Bieżąca naprawa po PR #63 — RAM/PCV i „Wyceń”

Na gałęzi `fix/pcv-ram-quote-generate-android` przygotowano spójny alias RAM, ochronę rewizji przed autosave w widokach obliczeń i widoczną odmowę generowania oferty.
[Raport i regresje](tools/reports/pcv-ram-quote-generate-android-fix.md). Następna bramka to osobna decyzja właściciela o próbie wydania, a następnie krótki test Androida.
Nie uruchamia to CLOUD-4.2, synchronizacji ani operacji Firebase LIVE. Dalsze plany i historyczne wpisy poniżej zachowano.

## Aktualizacja po PR #62 — CLOUD-4.1 scalone, CLOUD-4.2 w przygotowaniu

GitHub potwierdził merge PR #62 do main `d517d598917e5ccd6f1460950697c9ab27f1db1c`,
wydaniowe CI i Pages SUCCESS. CLOUD-4.1: 13/13 live-readiness, 10/10 prywatny pilot,
71/71 SDK, 3/3 startup, 38/38 Chromium, Preflight PASS, bez pominięć.
Starsze nagłówki o blokadzie poniżej są zapisem historycznym sprzed weryfikacji.
CLOUD-4.2 przygotowuje pakiet offline i próby emulatorowe przyszłego LIVE na osobnej
branży, bez produkcyjnych Rules, grantów, zapisów, odczytów ani zmiany UI/autorytetu.
[Artefakty, bramki zgody, procedura i statusy](tools/reports/cloud-4-2-live-pilot-preparation.md).
Aktualny wynik CLOUD-4.2 wymaga zakończonego CI tej gałęzi; nie jest odziedziczonym PASS.

## CLOUD-4.1 — prywatne wykonanie, przed akceptacją

Gałąź `cloud-4-1-private-pilot-execution`, baza main `62f80433`: przygotowana prywatna ścieżka jednej próby zapisu i niezależnego odczytu do RAM, bez zmiany normalnego startupu/UI. **Kolejny wymagany krok: odblokować publiczny artefakt emulatora w środowisku i wykonać pełne SDK/Chromium.** Preflight PASS nie zastępuje tych testów; gałąź nie jest gotowa do Ready ani realnego pilota. [Szczegóły i testy](tools/reports/cloud-4-1-private-pilot-execution.md).

Po kompletnym PASS nadal oddzielnie zatwierdzane: Ready/Pages, dokładne minimalne Rules, administracyjny grant, a następnie operatorska aktywacja i pierwszy syntetyczny zapis/odczyt LIVE. Obecny wykonawca ma twardą odmowę produkcji. Żadnego automatycznego uploadu, przełączenia autorytetu ani transferu katalogów przy logowaniu.

## CLOUD-4 — przygotowanie pilota, bez aktywacji LIVE

Baza **`0cafb432f18bcd052672aac020d36128155388a7` po PR #60**. Właściciel potwierdził: **PR #60 scalony, CI/Pages PASS, Android zaakceptowany**, cenniki/materiały/okucia zachowane. Pojedynczy pierwszy `AUTH_STARTUP_FAILED` nie ma potwierdzonej przyczyny; nie dodano retry ani przebudowy logowania.

Gałąź `cloud-4-live-pilot-readiness` przygotowuje niezarejestrowany, prywatny kontrakt przekazania istniejącej sesji/lease, izolowane natywne źródło syntetyczne CLOUD-1B, minimalne first-publication-only Rules z Auth-only i singletonem jednego UID oraz procedurę ograniczonego grantu. Testy dotyczą wyłącznie emulatorów i Chromium. Nie ma prywatnego call-site uruchamiającego LIVE w main-login, nowego UI, deployu Rules, grantu, uploadu, synchronizacji ani zmiany lokalnego autorytetu. Globalne dane CLOUD-3 pozostają poza pilotem.

[Raport CLOUD-4: dokładny Rules SHA, źródło, testy, budżet Spark, plan zapisu/odczytu i zatrzymania](tools/reports/cloud-4-live-pilot-readiness.md). Przed rzeczywistym uruchomieniem potrzebne są **cztery osobne zgody**: (1) Ready/auto-merge/Pages kodu, (2) deploy dokładnych Rules, (3) administracyjny grant syntetycznego scope, (4) pierwszy zapis i niezależny odczyt przez przejrzany prywatny launcher. Żadna zgoda nie obejmuje automatycznie kolejnej.

## CLOUD-3 — scalone PR #60, fundament pozostaje nieaktywny

**Stan bazy po PR #59 (`65085d18`): scalony, CI PASS, auto-merge PASS, Pages PASS, Android zaakceptowany przez właściciela.** Atomowy profil IndexedDB, nieaktywny LIVE i techniczny CLOUD-2C są już w main. Nie oznacza to wdrożenia transportu biznesowego.

CLOUD-3 dodaje zamknięty model 14 jednoznacznych domen globalnych, niezależny transport immutable/CAS, kandydackie Rules i testy dwóch klientów SDK. Pożyczona sesja App/Auth/Firestore jest przygotowana do przyszłego prywatnego podłączenia; **nie** jest uruchamiana przez login/startup. [Zakres, wyniki i ograniczenia](tools/reports/cloud-3-global-data-foundation.md).

Dalsza kolejność: CLOUD-4 — kontrolowane przygotowanie syntetycznego LIVE → osobne zgody na publikację kodu, minimalne Rules, grant i wykonanie roundtripu → rozstrzygnięcie Issue #47, draftów/legacy i zależności → zatwierdzone przełączenie domen na jeden autorytet i automatyczna synchronizacja. Bez przycisków eksportu/synchronizacji, bez ślepego importu, z zachowaniem Zapisz/Anuluj, frozen historii i ochrony danych globalnych. Zaliczone emulatory nie zastępują tych zgód ani testu na urządzeniach.


## CLOUD-2B.4a + techniczne CLOUD-2C — scalone PR #59, LIVE nadal nieaktywny

**Rozszerzenie pakietu zatwierdzone przez właściciela:** naprawiono wyścig dopuszczenia profilu przez transakcyjny rekord właściciela IndexedDB (`meble-access-profile-v1`, store `ownership`, klucz `owner`). Stan pending nie daje dostępu; poprawny v2 przechodzi bez przepisywania danych, nowe powiązanie v3 nie jest samodzielnym uprawnieniem. Usunięto produkcyjny przycisk/wyświetlanie UID, zachowując wewnętrzną autoryzację. Końcowa weryfikacja: Emulator Suite **41/41**, Chromium **28/28** (w tym 100 prób bez podwójnego dopuszczenia), profil **36/36**, pełny Preflight **PASS** (543/543 składnia, 122/122 smoke, APP 110/110), syntax/diff check PASS. Bez zgody na Ready/merge/Pages lub Firebase LIVE.

Baza: `6c5ca364` po PR #58 (obowiązujące AGENTS §13). **CLOUD-2B.3 jest scalone w PR #57 (`90bd5349`), CI i Pages PASS, Android zaakceptowany; produkcyjny profil Auth-only działa** — status potwierdzony przez właściciela. Starsze opisy „bez publikacji” / „deny-all całej bazy” dotyczą poprzednich etapów. Biznesowe Rules, grant uploadu, synchronizacja i chmurowy autorytet projektu nadal nie są wdrożone.

Ten pakiet przygotowuje niezarejestrowany adapter pożyczający istniejące App/Auth/Firestore oraz niezależny odczyt manifestu, rewizji i fragmentów do RAM z pełną walidacją CLOUD-1B. Zapis/odczyt sprawdzamy wyłącznie na syntetycznych danych i emulatorach. Adapter LIVE nie należy do manifestów; dotychczasowe `create({target:'live'})` nadal odmawia. Rozszerzenie zmienia wyłącznie kontrolę lokalnego profilu w istniejącym logowaniu i usuwa kontrolkę UID; nie zmienia Google Auth, danych biznesowych, Rules ani grantów. **To techniczne przygotowanie CLOUD-2C, nie produkcyjne zakończenie odczytu ani zgoda na upload.** [Kontrakt, testy i ograniczenia](tools/reports/cloud-2b4a-technical-2c.md).

## Historia przygotowania CLOUD-2B.3 — opis sprzed scalenia PR #57

Baza: main po PR #56. Gałąź `cloud-2b3-main-login` przygotowuje jeden ekran pod `index.html`, serwerową autoryzację oraz loader biznesu dopiero po zgodzie. Nie wdrożono Rules, synchronizacji ani zmian danych. **Właściciel zatwierdził dostęp do swojego istniejącego profilu.** Przygotowano jednorazowe dopuszczenie po świeżej autoryzacji serwerowej, potwierdzeniu zachowania kopii i świadomej zgodzie właściciela. Zapisuje dowód `meble_access_profile_v1` w wersji 2 oraz techniczną blokadę `meble_access_profile_pending_v1` do czasu potwierdzenia operacji, bez przepisywania `fc_*` lub aliasów. Niedokończona próba pozostaje zablokowana również po restarcie; stary dowód v1 wymaga ponownej zgody. Nowy pusty profil nadal wymaga potwierdzonego proofu. Publikacja i Rules pozostają osobno zatwierdzane; kopię trzeba wykonać przed publikacją, a akceptację Android — po uzgodnionym wdrożeniu. [Raport, ograniczenia, procedura Rules i rollback](tools/reports/cloud-2b3-main-login.md).

Data aktualizacji priorytetów: **2026-10-15**, main po PR #50 (merge `732c9833`), CLOUD-1B ukończono i przeszło CI. CLOUD-2A: wybór Firebase Spark i logowania Google zatwierdzony, przygotowano projekt techniczny w gałęzi dokumentacyjnej. Niezwiązane plany poniżej zachowano; nie stanowią zgody na implementację.

## Aktualny priorytet — CLOUD-2B.4a + techniczne CLOUD-2C, bez rzeczywistego zapisu

Kanoniczny [rejestr CLOUD-1A](CLOUD_DATA_REGISTER.md) i [kontrakt/granice](CLOUD_MIGRATION.md) mają pierwszeństwo przed historyczną kolejnością Etapów 0–11 poniżej.

**Ukończone w main:** stabilizacja preflightu, CI po świadomym Ready (#44), C3.1 confirmed global saves, C2.0b pokojowe sesje/nawigacja, C2.1a odczyt bez przycinania, role/grupy formatek i geometria, projektowe PCV z adapterami obliczeń, guardy sesji/ofert (#38–40), automatyczny tryb (#43), wspólne Opcje (#45), poprawka konfliktu autosave (#46). Ręczne testy użytkownika nie są utożsamiane z PASS symulowanego DOM.

**Ukończone CLOUD-1A i CLOUD-1B:** rejestr danych w PR #48; selektywny eksporter RAM w PR #50, pełny CI i Pages PASS. **CLOUD-2A:** użytkownik wybrał Firebase Spark/Cloud Firestore i Google Sign-In. Architektura pilota, bezpieczeństwo i model docelowy są **projektem**, a nie uruchomioną usługą: [CLOUD-2A](tools/reports/cloud-2a-firebase-google-architecture.md). Aktualizacja dokumentacji nie wdraża synchronizacji.

**Wymagana kolejność:** CLOUD-1B (scalone) → CLOUD-2A (wybrany dostawca/auth; dokumentacja projektu) → **CLOUD-2B** (ta gałąź: przygotowanie emulatorowe; konfigurację konsoli potwierdzono, rzeczywisty upload i wdrożenie Rules nadal wymagają osobnej zgody) → techniczne CLOUD-2C (ten pakiet, emulatory) → produkcyjne CLOUD-2C (osobna akceptacja rzeczywistego odczytu/weryfikacji) → obowiązkowa pełna migracja domen i automatyczna synchronizacja. Żaden etap pilotażu sam nie przełącza lokalnego autorytetu.

| Etap | Cel i status |
|---|---|
| CLOUD-1B | **SCALONE PR #50, CI/Pages PASS.** Selektywny eksport w RAM jednego syntetycznego I/P; jawna allowlista, integralność, zakończona sesja i potwierdzony zapis. [Raport](tools/reports/cloud-1b-selective-project-export.md). |
| CLOUD-2A | **ZATWIERDZONE:** Firebase Spark + Cloud Firestore + Firebase Authentication (Google). **PROJEKT TECHNICZNY:** ścieżki, Rules, UID, bezpieczne rewizje, odczyty/zapisy/limity, backup i granice pilota. [Raport CLOUD-2A](tools/reports/cloud-2a-firebase-google-architecture.md). Historia projektu architektury; konfigurację konsoli użytkownik potwierdził 2026-10-16, bez billingu. Nie oznacza to połączenia aplikacji z Firebase. |
| CLOUD-2B | **SCALONE PR #52, TYLKO EMULATORY.** Adapter SDK/Auth, immutable chunks/revisions i transakcyjny manifest oparte na CLOUD-1B, realne testy emulatorowe. Transport wyłącznie lokalny demo/loopback; live zablokowany. Konsola: Spark/Google/region potwierdzone przez użytkownika; Auth-only jest produkcyjnie wdrożony; biznesowe Rules pozostają deny-all. Pierwszy upload/deployment wymagają osobnej zgody oraz zamknięcia warunków [raportu](tools/reports/cloud-2b-firebase-pilot.md). Bez UI, globalnych danych i synchronizacji. |
| CLOUD-2B.1–1b | **SCALONE, PR #53–55.** Oddzielny ekran Google Auth, publiczny config wyłącznie strony testowej, persistence i oryginalne logo. Historyczny etap testowy; zastąpiony głównym logowaniem w PR #57. [Raport](tools/reports/cloud-2b1b-auth-branding.md). |
| CLOUD-2B.2–3 | **SCALONE PR #56–57.** Główne logowanie, serwerowa weryfikacja appEnabled, bezpieczne dopuszczenie lokalnego profilu. CI/Pages PASS, Android zaakceptowany, Auth-only działa; bez biznesowej synchronizacji. |
| CLOUD-2B.4a | **SCALONE PR #59.** Przygotowany, niezarejestrowany adapter pożyczający istniejącą sesję; brak aktywacji LIVE, UI i zmian grantów/Rules. |
| CLOUD-2C — techniczne | **SCALONE PR #59, TYLKO EMULATORY.** Niezależny odczyt rewizji i fragmentów, pełna integralność i model CLOUD-1B, porównanie ze źródłem, bez importu. |
| CLOUD-2C — produkcyjne | **NIEWYKONANE.** Osobna zgoda na rzeczywiste połączenie, biznesowe Rules i grant oraz kontrolowany syntetyczny zapis/odczyt. Odtworzenie danych nie dowodzi identycznej WYCENY bez katalogów i cen. |
| Po CLOUD-2C — ochrona danych i rozszerzenie zakresu | Obowiązkowo zaprojektować i wdrożyć ochronę oraz zatwierdzone przeniesienie wypracowanych katalogów/cenników/stawek/słowników/ustawień; zachować historię ofert. Objąć wspierane struktury produkcyjne, prawdziwe dane inwestorów i duże projekty. Rozstrzygnąć projektową własność słojów/rotacji (Issue #47); pilot ich nie kończy. |
| Po CLOUD-2C — autorytet chmury i automatyczna synchronizacja | Obowiązkowe, osobno zatwierdzane wdrożenie chmury jako autorytetu domen, automatyczne otrzymywanie aktualnych danych i zapis zatwierdzonych zmian na Androidzie/tablecie/komputerze. Bez ręcznych Eksportuj/Importuj/Wyślij/Pobierz/Synchronizuj i bez zmian UI. Zachować Zapisz/Anuluj; lokalny cache/draft nie jest drugim autorytetem. |
| Po CLOUD-2C — konflikty, sieć i praca między urządzeniami | Obowiązkowe testy konfliktów, niepotwierdzonych zapisów, ponowień i błędów sieci; zakaz nadpisania nowszych zmian innym urządzeniem. Przyszły bezpieczny offline wymaga oddzielnego kontraktu. Kontrolować koszty/limity i nie zapisywać zbędnie niezmienionych danych. |

Szczegółowy podział i kolejność wdrożeń **po CLOUD-2C** wymagają planu technicznego; obowiązkowość celów została zatwierdzona. Nie wolno uznać ręcznego pilotażu za zakończenie migracji ani przełączyć obecnych lokalnych domen na chmurowy autorytet bez oddzielnej zgody.

**Tylko pierwszy test CLOUD-1B ma ograniczenia A–D:** odmowa przy nieobsługiwanych istotnych danych (bez cichego pomijania), fikcyjny inwestor/projekt bez niekontrolowanych notatek, wyłącznie jawne ID aktywnego projektu po potwierdzonym zapisie i zakończonej sesji, robocze 800 KiB pliku UTF-8 z odmową zamiast obcięcia. Nie są to docelowe ograniczenia produktu. Pełne wymagania, w tym daty/liczniki/roomId oraz `front.note`, są w [kontrakcie](CLOUD_MIGRATION.md#cloud-1b--wymagania-bezpieczeństwa-do-przyszłej-implementacji).

Pilot nie obejmuje globalnych słojów, katalogów, cen/stawek, historii/draftów ofert ani pełnego transferu aplikacji. Ich bezpieczeństwo i przyszła obsługa nie zostały anulowane. Retencja backupów pozostaje bez zmian; optymalizacja odłożona do czasu po migracji. Android pozostaje obecnym urządzeniem ręcznej akceptacji; tablet/komputer mają być wspierane, bez wymagania ręcznej akceptacji teraz.

## Zasada nadrzędna

Program rozwijamy małymi etapami. **Najpierw opis zmian, zakres, ryzyko i testy. Modyfikacja dopiero po komendzie użytkownika „do dzieła”.**

Ta roadmapa łączy aktualne, nadal ważne cele rozsiane dotąd po `DEV.md`, `README.md`, `CLOUD_MIGRATION.md`, `OPTIMIZATION_PLAN.md`, `CABINET_CREATOR_PLAN.md` i `QUOTE_CALCULATION_REGISTER.md`.

Nie realizować starych wpisów historycznych bez sprawdzenia, czy nie zostały już wdrożone.

---

# ETAP 0 — wiarygodny punkt startowy

**Stan historycznego Etapu 0:** dokumenty istnieją; aktualizacja CLOUD-1A została scalona w PR #48.

Cel:

- jedna aktualna mapa programu (`CURRENT_STATE.md`),
- jedna roadmapa,
- jawny baseline testów (`TEST_BASELINE.md`).

Nie zmieniać runtime.

**Tryb pracy:** Chat — GPT-5.6 Sol, High.

**Warunek zakończenia:** wiemy, co jest aktualne, co historyczne i co naprawdę jest do zrobienia.

---

# ETAP 1 — stabilizacja testów i jeden preflight

**Stan: Etap 1 wykonany.** Aktualny baseline 118/118 smoke, APP 110/110; pełny preflight i świadomie uruchamiane CI już są w main. Poniższe punkty zachowują historyczny cel, nie listę nowych zadań.

## 1A. Uporządkowanie obecnych FAIL-i

Najpierw poprawić wyłącznie testy/kontrakty, które są historyczne lub kruche. Osobno rozstrzygnąć wersję `BUILD` diagnostyki WYCENY.

Historyczny cel: 76/76 smoke; aktualny wynik i zakres określa CURRENT_STATE.md / CLOUD_DATA_REGISTER.md.

## 1B. Jedno polecenie kontrolne

Przygotować jeden preflight uruchamiający minimum:

- `node --check` dla JS,
- load-order,
- APP smoke,
- ważne smoke domenowe,
- storage audit,
- dependency audit.

## 1C. GitHub Actions

Dopiero po zielonym lokalnym baseline rozszerzyć `.github/workflows/preflight-js.yml`, żeby GitHub sprawdzał realną regresję, a nie tylko składnię.

**Tryb:** pierwszą diagnozę/projekt testów można robić w Chat. Zmiany wielu plików testowych i uruchamianie całego pakietu wygodniej później w Codexie. Work nie jest potrzebny.

**Warunek przejścia dalej:** zielony i powtarzalny baseline.

---

# ETAP 2 — audyt cloud-ready i domknięcie granic danych

Nie podłączać jeszcze Firebase.

**Aktualizacja:** mapa storage i domen jest opracowana w CLOUD-1A. Dalsza implementacja adapterów nie wynika automatycznie z tego audytu.

## 2A. Aktualny audyt storage

Dla każdej referencji do trwałego storage ustalić:

- dane użytkownika,
- cache,
- UI/session,
- test/tooling,
- legalny store/repository,
- direct/legacy do wygaszenia.

## 2B. Mapa domen → repository

Przygotować tabelę:

`domena → źródło prawdy → obecny store/repository → stabilne ID → docelowy Firestore → backup`.

Domeny co najmniej:

- inwestor,
- projekt,
- pomieszczenie,
- szafka,
- wycena/oferta,
- katalogi,
- zlecenia usługowe,
- ustawienia programu,
- transport/wnoszenie,
- przyszłe zakupy.

## 2C. Wygaszanie direct storage

Tylko małymi zmianami. UI/domena ma wołać repository/store, a adapter nadal może zapisywać do localStorage.

Nie robić jednej wielkiej migracji.

**Tryb:** analiza — Chat GPT-5.6 Sol High. Szeroki audyt wielu plików może być sensownym zadaniem Work (GPT-6 Astra / Work) tylko wtedy, gdy potrzebna będzie agentowa analiza całego repo i dokumentacji. Implementacja granic danych — Codex.

**Warunek:** Firebase można później podłączyć przez wymianę adaptera, bez przepisywania UI.

---

# ETAP 3 — domknięcie „jednej prawdy” WYCENA / MATERIAŁ / ROZRYS

To etap ważniejszy niż kosmetyczne refaktory.

## 3A. WYCENA

Potwierdzić, że każda złotówka ma pozycję w `quoteCalculationRegister`, a snapshot oferty zamraża wynik historyczny.

## 3B. MATERIAŁ ↔ ROZRYS

**Część PCV wykonana:** projektowy resolver, normalny UI i obliczenia są scalone. Własność słojów/rotacji i niejednoznaczne źródła pozostają osobno; nie powtarzać zakończonego zakresu.

Ujednolicić kontrakty dla:

- formatek,
- materiałów,
- oklein/PCV,
- jednostek i wymiarów,
- arkuszy / powierzchni / metrów bieżących.

Nie tworzyć dwóch niezależnych kalkulatorów tych samych danych.

## 3C. Elementy wykończeniowe

Dopiero na stabilnym modelu przygotować pełniejszy model:

- blend,
- paneli,
- cokołów,
- blatów i docinek,
- trudnych wycięć.

**Tryb:** analiza kontraktów — Chat High. Implementacja wieloplikowa + regresje — Codex. Work tylko przy pełnym przekrojowym audycie wielu domen.

---

# ETAP 4 — pełniejsze liczenie realnej pracy

W kolejności zapisanej w planie:

1. montaż frontów,
2. zawiasy i regulacja,
3. prowadnice / systemy szuflad / podnośniki,
4. wycięcia i frezowania,
5. blendy / trudne wnęki,
6. zamawianie materiałów i okuć,
7. kontrola dostaw,
8. pakowanie / załadunek / sprzątanie,
9. dopiero później kontrolowany bufor ryzyka.

Każda czynność powinna mieć jawne `quantitySource`, warunki oraz test, a nie ukryty mnożnik.

**Tryb:** logika biznesowa najpierw Chat High z użytkownikiem; implementacja Codex.

---

# ETAP 5 — model chmury i pilotaż Firebase

Ten starszy cel jest teraz realizowany kolejnością **CLOUD-1A → CLOUD-1B → CLOUD-2A → CLOUD-2B → CLOUD-2C** z tabeli priorytetów. Historyczny tytuł Firebase nie rozstrzyga wyboru dostawcy. Nie wybierać samodzielnie logowania/modelu przechowywania ani wdrażać synchronizacji bez osobnego polecenia. Przyciski Wyślij/Pobierz nie są dozwolonym docelowym UI; automatyczna synchronizacja bez zmiany interfejsu jest obowiązkowym celem po pilotażu. Nie wymagać pełnego transferu komputer → telefon w pierwszym pilotażu; testuje on wyłącznie ustalony I/P. Przyszła synchronizacja ma obejmować Android, tablet i komputer.

---

# ETAP 6 — zakupy i rentowność

Fundament wielu cen dostawców już istnieje. Dalsza kolejność:

1. reguła ceny użytej do WYCENY,
2. snapshot ceny/kosztu użytego w zaakceptowanej ofercie,
3. lista zakupów po akceptacji,
4. sugestia dostawcy / najtańszego albo logistycznie rozsądnego zakupu,
5. użytkownik zatwierdza realny zakup i realną cenę,
6. raport:
   - koszt planowany,
   - koszt sugerowany,
   - koszt rzeczywisty,
   - różnica zakupowa,
   - przychód,
   - realna robocizna,
   - koszty dodatkowe,
   - zysk i zysk na godzinę.

Historia oferty nigdy nie może zmieniać się po zmianie bieżącego katalogu.

**Tryb:** model biznesowy — Chat High; implementacja — Codex.

---

# ETAP 7 — właściwy harmonogram

Boundary statusów jest już przygotowane (`FC.projectScheduleStatus`).

Najpierw model zadań, potem UI.

Harmonogram ma obsługiwać co najmniej:

- trzeba umówić pomiar,
- trzeba przygotować wycenę końcową,
- później produkcja / montaż / inne kamienie milowe.

Nie interpretować historii ofert drugi raz w UI — używać istniejącego boundary statusów.

**Tryb:** Chat High do modelu; Codex do wdrożenia. Work może pomóc dopiero, jeśli harmonogram ma integrować wiele zewnętrznych źródeł/aplikacji.

---

# ETAP 8 — rozszerzenie modelu mebli

## 8A. Mieszane fronty

Wariant `Szuflady + drzwiczki`.

Każdy front ma jawną rolę `drawer` / `door`. Najpierw gotowe presety, pełny edytor siatki później.

Warunek: MATERIAŁ, WYCENA i wymagania okuć korzystają z tego samego generatora frontów.

## 8B. Kreator nietypowego korpusu

Kolejność z `CABINET_CREATOR_PLAN.md`:

1. ustabilizowane źródła faktów obecnych szafek,
2. te same fakty podpięte do WYCENY,
3. podgląd `Dane szafki`,
4. kreator nietypowego korpusu w WYWIADZIE,
5. możliwość zapisania jako szablon.

Kreator nie dostaje osobnej WYCENY.

**Tryb:** projekt UX/logiki — Chat High; większa implementacja wieloplikowa — Codex. Work zwykle niepotrzebny.

---

# ETAP 9 — pełniejsza synchronizacja chmurowa

Dopiero po sprawdzonym pilotażu i stabilnym modelu danych:

- auto-save,
- offline cache,
- synchronizacja komputer/telefon/tablet,
- konflikty zmian,
- historia zmian,
- ewentualne backupy chmurowe.

Osobno zabezpieczyć klucze usług zewnętrznych (np. ORS) — nie trzymać sekretów w publicznym froncie.

**Tryb:** architektura Chat High + ewentualnie Work/Astra; implementacja Codex.

---

# ETAP 10 — większe porządki architektury i RYSUNEK

Dopiero kiedy biznesowa część programu i testy są stabilne.

- RYSUNEK: najpierw testy i odejście od systemowych dialogów,
- później rozbijanie monolitu,
- wspólne helpery ROZRYS/RYSUNEK tylko po kontraktach geometrii,
- nie migrować na framework/TypeScript tylko „dla porządku”, bez mierzalnej korzyści.

**Tryb:** analiza Chat High / szeroki audyt Work, implementacja Codex.

---

# ETAP 11 — finalny PDF / dokument klienta

Świadomie na końcu.

PDF ma:

- korzystać z zamrożonego `clientOffer`,
- pokazywać zakres, materiały, kolory, akcesoria i jedną cenę końcową,
- nie ujawniać klientowi wewnętrznych stawek, kilometrów, kosztów zakupu i roboczogodzin,
- nie przeliczać oferty ponownie z bieżącego projektu.

Najpierw stabilna treść i dane, potem wygląd.

**Tryb:** Chat do treści/zakresu; Codex do implementacji; Work tylko jeśli powstaje większy zestaw dokumentów/assetów.

---

# Najbliższe kroki

1. Ocena implementacji CLOUD-1B, testów oraz ograniczeń profilu w tej gałęzi; brak wdrożonej chmury i synchronizacji.
2. Osobna zgoda na CLOUD-2A: porównanie darmowej infrastruktury, bez wyboru dostawcy teraz.
3. Następnie CLOUD-2B → CLOUD-2C, bez rozszerzania pierwszego pilotażu na globalne dane.
4. Obowiązkowo dalej: ochrona pozostałych domen, zatwierdzone przełączenie autorytetu, automatyczna synchronizacja, konflikty i praca między urządzeniami — według tabeli priorytetów. Pilot nie kończy migracji.

Nie rozpoczynać następnego etapu po samym zielonym preflight ani utworzeniu Draft PR.

# ROADMAP — kolejność dalszego rozwoju Meble-App

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

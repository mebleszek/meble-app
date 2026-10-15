# CLOUD-2A — projekt architektury Firebase Spark + Google Sign-In

**Data:** 2026-10-15. **Status:** dokumentacja techniczna, bez konfiguracji usługi i zmian runtime.  
**Zatwierdzone przez użytkownika:** Firebase jako dostawca; logowanie Google; cel 0 zł stałych opłat; automatyczna synchronizacja docelowa bez zmiany bieżącego UI.  
**Projektowane, do weryfikacji przed CLOUD-2B:** konkretne ścieżki Firestore, model rewizji, Rules, miejsce hostowania obsługi logowania, regionalizacja i plan kopii zapasowej. Nie traktować tego projektu jako wdrożonych reguł ani uruchomionej chmury.

Punkty odniesienia: [AGENTS.md](../../AGENTS.md), [CLOUD_MIGRATION.md](../../CLOUD_MIGRATION.md), [CLOUD_DATA_REGISTER.md](../../CLOUD_DATA_REGISTER.md), [BACKUP.md](../../BACKUP.md), [ROADMAP.md](../../ROADMAP.md), kontrakt [CLOUD-1B](cloud-1b-selective-project-export.md), [Issue #47](https://github.com/mebleszek/meble-app/issues/47). Aktualne fakty o limitach i metodach pochodzą z dokumentacji Firebase wskazanej na końcu.

## 1. Cel i nienaruszalne granice

- Docelowo **jeden logiczny projekt = jedno źródło prawdy** w chmurze, nawet jeżeli technicznie składa się z kilku dokumentów. Zapisane/aktywne zmiany mają być automatycznie dostępne na Androidzie, tablecie i Windowsie.
- `Zapisz / Anuluj` oraz niedokończone sesje nadal rządzą zatwierdzaniem. Nie wysyłamy draftu jako zatwierdzonego projektu, nie synchronizujemy obecnego lokalnego rollbacku ani cache jako biznesowego autorytetu.
- Obecny `main` pozostaje **wyłącznie lokalny**. CLOUD-1B jest tylko selektywnym builderem RAM, nie synchronizacją.
- **CLOUD-2B/2C:** tylko *jeden fikcyjny inwestor + fizyczny projekt*, warunki eksportera CLOUD-1B: istniejące znaczniki testowe, potwierdzona i zakończona sesja, ścisła allowlista, integralność, zachowane referencje, odmowa bez cichej utraty, 800 KiB. Limit 800 KiB i ten zakres NIE mogą stać się docelowymi ograniczeniami aplikacji.
- Zakaz odczytu/wysyłania pełnego `localStorage`, obecnych backupów `fc_*`, nieznanych pól i sekretów (zwłaszcza ORS `transport.apiKey`). Bez jakiejkolwiek migracji produkcyjnych danych użytkownika podczas pilota.
- Żadnych zmian UI (poza osobno uzgodnioną w przyszłości konieczną bramką logowania), magazynów globalnych, cenników, historii ofert, backupów i retencji w tym etapie.
- **Brak billing account / Blaze / płatnych API / funkcji serwerowych.** Jeśli do poprawnego scenariusza nie wystarczy Spark, zatrzymać wdrożenie i przedstawić nowy wariant do decyzji.

## 2. Konto i zaufanie

- Firebase Authentication: **Google jako jedyny zatwierdzony provider**. Właściciela danych identyfikuje stabilne Firebase Auth `uid`, a nie e-mail, nazwa, token OAuth ani lokalny inwestor.
- **Zamknięty pilotaż pojedynczego konta:** oprócz reguły `request.auth.uid == {uid w ścieżce}` wymaga ręcznie zarządzanej listy dozwolonych UID (np. `/authorizedUsers/{uid}` z zapisem administratora poza klientem; wszystkie write/read klienta do listy DENY). Konto Google *spoza* listy nie może tworzyć danych ani zużywać kwoty przez aplikację. Schemat i bootstrap tej listy przetestować w emulatorze, potem ustawić jawnie w konsoli Firebase; **żadnych UID nie wpisywać do repo**.
- Przed pierwszą operacją przejść `onAuthStateChanged`, ustalić konkretny UID i uprawnienie; brak lub zmiana konta = brak odczytów/zapisów cudzej przestrzeni. Przy logout wyczyścić autoryzowane uchwyty/subskrypcje i odizolować lokalny cache; nie usuwać lokalnych danych bez świadomej migracji.
- Hosting obecnej aplikacji jest niezależny od Firebase. Google login przez `signInWithRedirect` przy hostingu poza Firebase ma znany problem third-party storage: **nie zakładać, że przekierowanie po prostu zadziała na GitHub Pages**, zwłaszcza Android. Przed wdrożeniem wybrać i przetestować `signInWithPopup` / bezpieczny wariant przekierowania lub dozwoloną domenę Firebase, wraz z `authorized domains`. Nie migrować hostingu automatycznie i nie dodawać nowych przycisków bez akceptacji.
- Firebase web config w aplikacji nie zastępuje Security Rules; nie umieszczać service-account JSON, refresh tokenów, kluczy administracyjnych, OAuth access tokens ani sekretów usług w git, payloadzie lub logach.

## 3. Firestore — proponowany model pierwszego, BEZSTRATNEGO pilotażu

Pilotaż przenosi **dokładny dokument** zwrócony przez `FC.projectSelectiveExport.build({ investorId, projectId, purpose:'pilot' })` (jako kanoniczne bajty UTF-8). Nie mapuje po cichu pól do nowej wersji i nie jest docelowym modelem inwestorów/projektów.

```text
/authorizedUsers/{uid}                         # tylko bootstrap administracyjny (klient deny)
/users/{uid}/pilotProjects/{projectId}          # manifest / aktualna opublikowana rewizja
/users/{uid}/pilotProjects/{projectId}/revisions/{revisionId}
                                                 # niezmienny opis rewizji, hashes, ilości
/users/{uid}/pilotProjects/{projectId}/revisions/{revisionId}/chunks/{index}
                                                 # niezmienne kawałki binarne dokumentu
```

- `manifest`: wyłącznie stały `ownerUid`, `investorId`, `projectId`, liczba `generation` rosnąca o 1, `currentRevisionId`, `documentSha256`, `payloadSha256`, `updatedAt`, wersja formatu. To jedyny **autorytatywny wskaźnik opublikowanej rewizji**; nie kopiować niezależnego pełnego projektu obok.
- `revision`: losowe stabilne ID, `ownerUid`, `projectId`, `generationCandidate`, `chunkCount`, `byteLength`, `documentSha256`, `payloadSha256`, `formatVersion`, `createdAt`; niezmienna po utworzeniu. Bez snapshotów cen i globalnych tabel.
- `chunk`: `index`, `byteLength`, `bytes` (Firestore Blob, docelowo ok. 128 KiB na dokument), opcjonalny `sha256` części. **Dzielić dokładne bajty**, a nie obcinać tekst UTF-8. Czytnik skleja części w oryginalnej kolejności, weryfikuje długość, hashe fragmentów, oryginalne hashe CLOUD-1B i pełne referencje.
- Dla 800 KiB to najwyżej 7 części po 128 KiB, 1 dokument rewizji i 1 manifest (około 9 zapisów nowej rewizji, bez dodatkowych odczytów kontrolnych; koszty trzeba zmierzyć emulator/test). Nie zakładać, że limit Firestore 1 MiB można bezpiecznie wykorzystać przez jeden JSON.
- Pisanie: walidacja konta/oryginalnego eksportu i bazowej rewizji → utworzenie **nowych, niezmiennych** fragmentów i rewizji pod nowym ID → potwierdzenie kompletności → `runTransaction` odczytuje manifest oraz sprawdza `generation`, bazowy hash i oczekiwanego właściciela → publikuje wskaźnik na nową rewizję. Konflikt lub brak sieci = **bez publikacji**, brak deklaracji sukcesu, zachowanie dowodu błędu, żadnego `last write wins`.
- Klient nie traktuje zapisu niewidocznego/niepotwierdzonego jako sukcesu; po transakcji odczytuje manifest z serwera i weryfikuje wskaźnik, hash i generację. Po błędzie/timeout **wynik niepewny**: ponowny bezpieczny odczyt przed próbą powtórzenia; idempotency/retry na tym samym `revisionId` muszą być zaprojektowane/testowane przed uploadem.
- Przerwane przed publikacją fragmenty są **nieopublikowanymi artefaktami**, nigdy autorytetem. Nie kasować ich automatycznie przy CLOUD-2B; przyszłe porządkowanie i retencja wymagają planu (brak darmowego TTL).
- Firestore Security Rules: DENY domyślnie; `request.auth != null`, zatwierdzony UID, ścieżka zawężona do tego UID; `ownerUid` niezmienny; jawne klucze/typy i ograniczenia rozmiarów dokumentów, zakaz usuwania niezmiennych rewizji/fragmentów; manifest może zmieniać tylko zatwierdzoną generację/pointer. W emulatorze wymusić odmowy dla obcych UID, nieautoryzowanych UID, pól `apiKey`, zbyt dużego blobu, modyfikacji fragmentu, obniżenia rewizji i nielegalnego `projectId`.
- **Ograniczenie modelu zagrożeń:** Rules nie potrafią samodzielnie przeliczyć SHA-256 dowolnego Blob ani dowieść syntetyczności JSON. Integralność i brak sekretów potwierdzają ścisły klient/eksporter/testy; publikowanie tylko przez wąski zatwierdzony kod pilota. Nie twierdzić, że podpis SHA jest uwierzytelnieniem lub że każda treść od właściciela jest automatycznie bezpieczna.
- **CLOUD-2B tylko upload i potwierdzenie wskaźnika**, bez importu do lokalnych projektów. **CLOUD-2C** osobne pobranie, weryfikacja całego payloadu, hash i porównanie po restarcie/innym testowym kontekście. Bez nadpisywania lokalnych domen; test urządzenia docelowego osobno.

## 4. Model DOCELOWY (kierunek, nie wdrożony schemat)

```text
/users/{uid}/investors/{investorId}                   # jedna definicja inwestora
/users/{uid}/projects/{projectId}                     # właściciel, manifest, schema, rewizja
/users/{uid}/projects/{projectId}/rooms/{roomId}      # dane pomieszczenia; dalszy podział
/users/{uid}/globalDomains/{domainKey}/items/{itemId} # katalogi, ceny, stawki itp.
/users/{uid}/offers/{offerId}                         # niezależny zamrożony snapshot
```

- To **przykład logicznych domen**, a nie zgoda na bezpośrednie odwzorowanie każdego obecnego klucza `localStorage`. Duży pokój też może przekroczyć 1 MiB: dzielić wg stabilnych właścicieli (np. szafki/zestawy/produkcyjne grupy) z kontrolowaną wspólną rewizją, a nie tworzyć niezależne pełne kopie projektu.
- Inwestor jest niezależną domeną; wiele projektów może wskazywać ten sam `investorId`. Nie kopiować informacji inwestora jako kolejnego autorytetu projektu tylko dlatego, że pierwszy pilot eksportuje obie struktury w jednym opakowaniu.
- Pełny rejestr 46 stałych nazw + 3 rodziny dynamiczne w `CLOUD_DATA_REGISTER.md` pozostaje mapą źródeł do późniejszego transferu. Globalnie chronione: katalogi/okucia i kompatybilności, dostawcy, ceny, robocizna, zamienniki, magazyn, ustawienia, koszty firmy; przenosić po domenach, z read-back, konfliktami, referencjami, kontrolą prawa własności i zgodnością wartości. Dzisiejsze aliasy legacy nie stają się drugim źródłem prawdy.
- Oferta historyczna ma zachować `projectId`, `investorId`, exact offerScope, kwoty/pozycje i użyte ceny w **niemutowalnym snapshotcie**; nowy cennik nie przelicza starej oferty. Drafty ofert wymagają wcześniejszego rozstrzygnięcia zakresu własności.
- Lokalny cache, indeks, `derivedFacts`, cutlista, wskaźnik aktualnego pokoju, sesje i kopie nie są kolejnymi dokumentami autorytatywnymi.
- Globalne słoje i rotacja (Issue #47), `fc_edge_v1` i dormant `fc_rozrys_overrides_v1` mają nierozstrzygniętą własność: **nie usuwać, nie zgadywać i nie migrować przez przypisanie wybranemu projektowi**. Ten problem musi zostać rozwiązany przed pełną synchronizacją produkcyjną.

## 5. Koszt, offline, bezpieczeństwo i backup

**Stan oficjalnych warunków (sprawdzony 2026-10-15):** Firebase Spark bez danych płatniczych; **jedna bezpłatna baza Firestore** w projekcie; 1 GiB przechowywanych danych; 50 000 odczytów, 20 000 zapisów i 20 000 usunięć dokumentów dziennie; transfer wychodzący 10 GiB miesięcznie. Granica dokumentu 1 MiB. Reguły mogą powodować dodatkowe odczyty; kalkulować je osobno. Limity nie zapewniają nieograniczonego 0 zł — po wyczerpaniu usługa może odmówić działania. Bez automatycznej zmiany na Blaze.

- Minimalizować subskrypcje i readbacki, nie wczytywać każdego chunku przy każdej aktualizacji manifestu; ładować tylko zmienioną rewizję, bez zapisywania niezmienionych danych. Obliczyć scenariusze kosztów dla 1/10/100 projektów i 2–3 urządzeń przed pełną migracją. Ostrzeżenia o limitach są elementem przyszłego monitoringu, nie obecnym kodem.
- `runTransaction` wymaga połączenia; offline CLOUD-2B **odmowa publikacji**. Późniejsze offline może utrzymywać bezpieczny lokalny draft, lecz nie potwierdzać zapisu chmurowego ani tworzyć drugiego źródła prawdy. Nie włączać bezwarunkowych kolejek offline `setDoc` dla rekordów autorytatywnych.
- Firebase Cloud Firestore managed backup/PITR/restore wymagają billingu: **nie włączać**. Odrębny, odtwarzalny backup istotnych danych pozostaje obowiązkowym projektem na później, bez uploadu pełnego `fc_*` lub sekretów ORS, z kontrolą wersji i próbą przywracania. Lokalne backupy zachować w obecnym stanie; samo wersjonowanie Firestore nie zastępuje kopii niezależnej.
- Przed utworzeniem projektu podjąć świadomą decyzję o lokalizacji bazy Firestore (rezydencja danych/latencja; późniejsza zmiana lokalizacji może wymagać migracji). Przy działaniu na prawdziwych danych klientów dochodzą zasady przetwarzania danych osobowych.
- Zakaz Cloud Functions, płatnych Google APIs, płatnego storage i wszelkiego automatycznego podpinania Cloud Billing. Dane credential service account i inne sekrety nie mogą trafić do klienta ani repo.

## 6. Bramka wejścia CLOUD-2B / CLOUD-2C

1. **Oddzielna zgoda** na utworzenie projektu Firebase Spark i włączenie Google Auth + jednej darmowej bazy. Wskazanie regionu oraz domen autoryzowanych. Nie robić tego w CLOUD-2A.
2. W repo osobny, minimalny PR z **niewdrożonym do produkcyjnego UI** adapterem/testem + Firebase Emulator Suite i testowanymi Rules. Brak uploadu na etapie CI, żadnych kluczy administracyjnych.
3. Test Security Rules: wyłącznie dozwolony `uid`, brak dostępu między kontami, brak obcych pól / secretów / modyfikacji opublikowanej historii, walidacja limitów.
4. Test konfliktu dwu instancji: obie startują z `generation=N`; jedna publikuje `N+1`, druga odmawia i nie nadpisuje. Stare RAM, niepotwierdzony zapis, aktywna sesja, utrata sieci i restart **nie publikują**.
5. Pozytywny test kompletności CLOUD-1B: inwestor/projekt/pokoje/szafki/zestawy/PCV, `front.note`, źródła materiałowe i licznik; byte-for-byte roundtrip, SHA-256, `utf8Bytes`, bez mutacji źródła i bez danych globalnych. Dodatkowo testy dużego pilota w limicie 800 KiB i odmowy ponad limit.
6. Sprawdzić liczbę operacji i rozmiary dokumentów w praktyce; niczego nie usuwać bez osobnej decyzji. **CLOUD-2C** wymaga osobnej zgody na pobranie/weryfikację, nie na przywracanie do aktualnych lokalnych projektów.
7. Dopiero po pilotach: projekt migracji każdego istotnego magazynu globalnego, ochrony historycznych ofert, możliwości identycznego przeliczenia WYCENY na innym urządzeniu, konfliktów i offline. Test poprawnego wyświetlenia ≠ test wyceny ≠ test zachowania autorytatywnych danych.

## 7. Dokumentacja producenta — weryfikacja 2026-10-15

- Plany Spark/Blaze: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Darmowe limity i rozmiary: https://firebase.google.com/docs/firestore/quotas
- Google Sign-In (web): https://firebase.google.com/docs/auth/web/google-signin
- Redirect a third-party storage: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Transakcje, ponowienia i offline: https://firebase.google.com/docs/firestore/manage-data/transactions
- Reguły własności i autoryzacja: https://firebase.google.com/docs/firestore/security/rules-conditions
- Walidacja pól w regułach: https://firebase.google.com/docs/firestore/security/rules-fields
- Ograniczenia zapytań Rules: https://firebase.google.com/docs/firestore/security/rules-query

**Wynik CLOUD-2A:** dostawca i Google login są wybrane przez użytkownika; powyższe ścieżki, atomowość publikacji i szczegóły Rules to projekt techniczny do implementacyjnej weryfikacji, nie działający kontrakt bezpieczeństwa. Brak wdrożenia, DNS/Hostingu, SDK, projektu Firebase i danych produkcyjnych.

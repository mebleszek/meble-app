# Meble-App — Bramka 1 CLOUD-4.3a: sprawdzona metoda odczytu Rules

**Status procedury:** metoda faktycznie zadziałała 20.10.2026 w ChatGPT Work (Google APIs Explorer, dwa GET HTTP 200); poniższy opis służy do ponownego, świeżego odczytu. Nie jest dowodem, że produkcja nadal ma ten sam stan. **Bramka 1: STOP do czasu nowej kontroli i decyzji właściciela. Bramka 2: zamknięta.**

## Ważne: co zadziałało, a co nie

- **DZIAŁAŁO:** ChatGPT Work → Cloud Browser → oficjalny **Google APIs Explorer**, osadzony w dokumentacji dwóch metod Firebase Rules REST API. Właściciel przejął przeglądarkę i samodzielnie przeprowadził logowanie/autoryzację Google; następnie obie operacje GET dały HTTP 200. Work mógł skopiować JSON odpowiedzi i sprawdzić oryginalne pole `source.files[].content`.
- **NIE JEST TĄ METODĄ:** Cloud Shell (`shell.cloud.google.com`, także panel osadzony w Firebase), który w Work zwracał `Site Unavailable`. Cloud Shell nie jest wymagany.
- W jednej wcześniejszej próbie APIs Explorer wystąpiło `Error authorizing: immediate_failed`. Późniejsze interaktywne logowanie i ponowienie przez APIs Explorer zadziałało. Samego kliknięcia zgody nie uznawać za dowód; dowodem jest HTTP 200.
- Jeśli w konkretnej sesji Work **Cloud Browser jest `unavailable`**, Work nie może wykonać GET. W takiej sytuacji STOP; nowa sesja Work z działającym Cloud Browser albo wykonanie przez zwykły Chrome na koncie właściciela. Nie przedstawiać starego JSON jako świeżego odczytu.

## Docelowe, historycznie potwierdzone dane

- Repozytorium: `mebleszek/meble-app`; przygotowana gałąź: `cloud-4-3a-production-rules-baseline`, commit `965544c861d203b372d179c3a3fcf2ac3106e950`.
- Firebase project: `mebleszek-meble-app`; Firestore database: `(default)`.
- Release: `projects/mebleszek-meble-app/releases/cloud.firestore`.
- Historyczny ruleset: `projects/mebleszek-meble-app/rulesets/3e3729ee-6dae-4d91-9e7f-862e68899763`.
- Historyczne `createTime` release: `2026-10-15T22:31:21.277596Z`.
- Historyczne `updateTime` release: `2026-10-17T15:53:31.006324Z`.
- Historyczne `createTime` rulesetu: `2026-10-17T15:53:29.583599Z`.
- Historyczne źródło: dokładnie jeden plik `firestore.rules`, **635 B UTF-8**, SHA-256 `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`.
- Inny artefakt (repozytoryjny template Auth-only): **755 B**, SHA-256 `fd92cffababe500cba62ed6e592b482760ce9e66df35f01419c44edff2f10cd3`. NIE JEST wiernym rollbackiem produkcji 635 B.
- Minimalne pilotowe Rules (nie wdrożone): SHA-256 `eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`.
- Historyczna kontrola Spark/brak Blaze i rezerwy limitów: PASS według panelu w chwili tamtej kontroli; nie przedstawiać jej jako nowego pomiaru.

## Procedura odczytowa — powtórzyć tylko to

1. W **nowym zadaniu ChatGPT Work z działającym Cloud Browser** otworzyć oficjalną stronę:
   https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/get
2. W formularzu **Try it! / Google APIs Explorer** wpisać parametr `name`:
   `projects/mebleszek-meble-app/releases/cloud.firestore`
3. Wybrać **wyłącznie** zakres OAuth `https://www.googleapis.com/auth/firebase.readonly` (bez `cloud-platform` i szerszego `firebase`, bez API key). W razie potrzeby poprosić właściciela o **przejęcie przeglądarki**, wybranie konta Google i zakończenie zgody. Po przekazaniu kontroli **poczekać** na reakcję interfejsu.
4. Wykonać tylko `GET https://firebaserules.googleapis.com/v1/projects/mebleszek-meble-app/releases/cloud.firestore`. Potwierdzić **HTTP 200** i zapisać `name`, `rulesetName`, `createTime`, `updateTime`.
5. Otworzyć oficjalną stronę: https://firebase.google.com/docs/reference/rules/rest/v1/projects.rulesets/get
6. Drugie GET wykonać dla **rzeczywistego** `rulesetName` otrzymanego w świeżej odpowiedzi release — nie wpisywać starego ID na ślepo. Potwierdzić **HTTP 200**.
7. Zachować całą odpowiedź `ruleset` (`name`, `createTime`, `source.files`); wyliczyć rozmiar UTF-8 i SHA-256 **każdego odkodowanego JSON-owego pola `content`**. Nie normalizować końców linii, komentarzy ani whitespace. Sprawdzić pełną liczbę i nazwy plików.
8. Porównać **wszystkie pola** z historycznym baseline powyżej. Jeśli jest choć jedna niezgodność, brak dowodu, brak HTTP 200, brak przeglądarki albo błąd autoryzacji: **STOP**. Przy całkowitej zgodności opisać: `PASS — świeży odczyt zgodny z historycznym baseline; osobna decyzja właściciela nadal wymagana`. Nie zmieniać `baselineApprovedForGate2:false`.
9. Raport z datą i dwoma HTTP, metadanymi i hashami; zachować odpowiedzi jako prywatne dowody. Nie ujawniać tokenów, cookies ani sekretów.

## Nieprzekraczalne ograniczenia

Tylko dwa oficjalne **GET** do Firebase Rules API. Bez Cloud Shell, deployu, aktualizacji Rules, konfiguracji Firebase/IAM/grantów, billingu, odczytu dokumentów biznesowych, synchronizacji, uruchomienia LIVE, zmian GitHuba, PR/merge/Pages, ani Bramki 2. Bez obiecywania nowej obserwacji bez uzyskania HTTP 200. Cloud Browser `unavailable` = STOP, a nie fałszywy PASS.

## Gotowy krótki prompt do ponownego uruchomienia Work

> MEBLE-APP CLOUD-4.3a, ponowna Bramka 1. Wykonaj wyłącznie dwa GET Firebase Rules przez **Google APIs Explorer w Cloud Browser** (NIE Cloud Shell). Wejdź na https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/get, ustaw `name=projects/mebleszek-meble-app/releases/cloud.firestore`, zaznacz wyłącznie `firebase.readonly`. Poproś mnie o przejęcie logowania Google, poczekaj na ukończenie autoryzacji i wymagaj HTTP 200. Z nowego `rulesetName` otwórz https://firebase.google.com/docs/reference/rules/rest/v1/projects.rulesets/get i pobierz wskazany ruleset (GET, HTTP 200). Porównaj metadane oraz oryginalne bajty wszystkich `source.files[].content` z historycznym baseline 635 B / SHA-256 `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`, release `cloud.firestore`, ruleset `3e3729ee-6dae-4d91-9e7f-862e68899763`, updateTime `2026-10-17T15:53:31.006324Z` i pozostałymi czasami udokumentowanymi w CLOUD-4.3a. Sporządź raport PASS świeżej zgodności albo STOP. Niczego nie modyfikuj, nie przechodź do Bramki 2, `baselineApprovedForGate2:false` bez zmian. Jeśli Cloud Browser niedostępny — powiedz STOP bez udawania odczytu.

---

**Zapis przygotowany w rozmowie 20.10.2026.** Nie jest automatyczną kontrolą bieżącej produkcji.
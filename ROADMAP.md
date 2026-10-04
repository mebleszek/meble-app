# ROADMAP — kolejność dalszego rozwoju Meble-App

Data uporządkowania: **2026-10-04**

## Zasada nadrzędna

Program rozwijamy małymi etapami. **Najpierw opis zmian, zakres, ryzyko i testy. Modyfikacja dopiero po komendzie użytkownika „do dzieła”.**

Ta roadmapa łączy aktualne, nadal ważne cele rozsiane dotąd po `DEV.md`, `README.md`, `CLOUD_MIGRATION.md`, `OPTIMIZATION_PLAN.md`, `CABINET_CREATOR_PLAN.md` i `QUOTE_CALCULATION_REGISTER.md`.

Nie realizować starych wpisów historycznych bez sprawdzenia, czy nie zostały już wdrożone.

---

# ETAP 0 — wiarygodny punkt startowy

**Stan:** rozpoczęty teraz.

Cel:

- jedna aktualna mapa programu (`CURRENT_STATE.md`),
- jedna roadmapa,
- jawny baseline testów (`TEST_BASELINE.md`).

Nie zmieniać runtime.

**Tryb pracy:** Chat — GPT-5.6 Sol, High.

**Warunek zakończenia:** wiemy, co jest aktualne, co historyczne i co naprawdę jest do zrobienia.

---

# ETAP 1 — stabilizacja testów i jeden preflight

## 1A. Uporządkowanie obecnych FAIL-i

Najpierw poprawić wyłącznie testy/kontrakty, które są historyczne lub kruche. Osobno rozstrzygnąć wersję `BUILD` diagnostyki WYCENY.

Cel: **76/76 smoke PASS** + PASS `check-index-load-groups`.

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

Dopiero po Etapach 1–3.

## 5A. Model Firestore

Zaprojektować:

- kolekcje/dokumenty,
- stabilne ID,
- wielkość dokumentów,
- podkolekcje,
- reguły bezpieczeństwa,
- wersjonowanie danych.

Przykładowy kierunek z istniejącego planu:

- `users/{userId}/investors/{investorId}`,
- `users/{userId}/projects/{projectId}`,
- `users/{userId}/quotes/{quoteId}`.

Nie wrzucać całej aplikacji do jednego JSON-a.

## 5B. Authentication

Dodać logowanie użytkownika.

## 5C. Pilotaż ręczny

Najpierw tylko:

- `Wyślij do chmury`,
- `Pobierz z chmury`,
- raport porównania lokalne vs chmura.

Test: komputer → chmura → telefon → dane 1:1.

Nie robić jeszcze automatycznej dwukierunkowej synchronizacji.

**Tryb:** projekt architektury — Chat High; szeroki projekt wdrożeniowy może uzasadniać Work/Astra; implementacja i testy repo — Codex.

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

# Co robimy jako najbliższe trzy kroki

1. **Etap 1A:** uporządkować czerwone testy bez zmiany logiki biznesowej.
2. **Etap 1B:** zrobić jeden lokalny preflight.
3. **Etap 1C:** dopiero po zielonym baseline podpiąć go do GitHub Actions.

Dopiero po tych trzech krokach zaczynać właściwy audyt cloud-ready Etapu 2.

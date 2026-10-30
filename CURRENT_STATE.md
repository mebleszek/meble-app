# CURRENT_STATE — kanoniczny dziennik stanu Meble-App

> **Weryfikacja GitHuba: 30.10.2026.** Odczytany `main`: `f8e452813faaf6cd343704b3952d9501652222d3` (merge PR #86). Ta migawka jest dowodem z podanej daty, **nie automatycznie aktualizowanym statusem**. Przed następną decyzją sprawdź HEAD `main`, otwarte PR-y, Actions i Pages, a dopiero później poniższe wpisy.
>
> **Jedno źródło prawdy o wykonaniu:** niniejszy rejestr. `ROADMAP.md` opisuje **plany i zależności**, `AGENTS.md` — **procedurę i odpowiedzialność**, `tools/reports/*` — **szczegółowe dowody**. Dawne stany i pełną kronikę przeniesiono do [docs/archive/CURRENT_STATE_history_to_20261030.md](docs/archive/CURRENT_STATE_history_to_20261030.md); nie są aktualnym zleceniem.

## 1. ZROBIONE — nie otwierać ponownie bez nowego powodu

| Pakiet | Stan potwierdzony / dowód | Co to znaczy dzisiaj |
| --- | --- | --- |
| Nawigacja inwestora i bezpieczne „Wyjdź”, [PR #86](https://github.com/mebleszek/meble-app/pull/86) | **RELEASED**: HEAD `d3cd7ef15afdca1313400d27209d7b8d185b0700`, merge `f8e452813faaf6cd343704b3952d9501652222d3`; [CI PASS](https://github.com/mebleszek/meble-app/actions/runs/40971823833), [Pages PASS](https://github.com/mebleszek/meble-app/actions/runs/40972484916) | Kod jest na `main`. **PHONE_FAIL_REPORTED / FIX_PENDING**: fizyczny Android ujawnił nowe błędy; szczegóły w sekcjach 2–4. |
| Zaufane urządzenia i sesje tymczasowe, [PR #85](https://github.com/mebleszek/meble-app/pull/85) | **MERGED / CI PASS**: HEAD `d5a599a6775e9ea2bcaf64a046073be0dbdb6e2b`, merge `0a9522cf9277ef3de03d328a84dd9569a1958e46`, [CI](https://github.com/mebleszek/meble-app/actions/runs/40836513934) | Ukończony pakiet Auth; test urządzenia jest osobnym dowodem, nie częścią automatycznego CI. |
| Izolowany LOCAL-FIRST / IndexedDB / protokół jednego edytora, [PR #84](https://github.com/mebleszek/meble-app/pull/84) | **MERGED / CI PASS**: HEAD `60f597258f747351c640030ef2ce42482bc19c2b`, [CI](https://github.com/mebleszek/meble-app/actions/runs/40767553198) | **Ukończony kod bazowy, NIE działająca synchronizacja aplikacji**: startup, realne projekty, migracja i przełączenie danych nie są tym potwierdzone. |
| Naprawa pamięci i ratowanie IndexedDB, [PR #83](https://github.com/mebleszek/meble-app/pull/83) | **MERGED / CI PASS**: HEAD `094716519f3b0903e8979c0bdf1e8ce5ad777fca`, [CI](https://github.com/mebleszek/meble-app/actions/runs/40230504100) | Wydany odrębny pakiet naprawczy; nie utożsamiać z ukończoną migracją projektów ani etapem E recovery. |
| Normy robocizny i ilości okuć, [PR #79](https://github.com/mebleszek/meble-app/pull/79) | **MERGED** — status PR zweryfikowany na GitHubie; szczegółowy kontrakt norm obowiązuje w bieżącej wycenie | Nie rozpoczynać ponownie prac już ujętych w tym PR bez wykazanej luki. |
| CLOUD-4.6C–E oraz CLOUD-SYNC-1, [PR #75](https://github.com/mebleszek/meble-app/pull/75)–[#78](https://github.com/mebleszek/meble-app/pull/78) | **MERGED** — etapy przygotowania, emulatorów i nieaktywnej integracji | Nie są dowodem dopuszczenia produkcyjnego Firebase ani migracji danych. **LIVE_BLOCKED**. |

### Pakiet produktu w toku — 30.10.2026

Gałąź `integration/android-local-first-20261030`, poprzedni HEAD `f3ae3374dfa581ea93d4bffa80f6d338070ff898`, nowa baza `6588cac972fc1ebbfe57f80ad55b4d22620a7647`. Zachowano przygotowane poprawki Androida i regresje z raportu `android-local-first-integration-20261030.md`; nie są jeszcze wydane. PR #87 został scalony (merge SHA powyżej), porządek dokumentów i archiwum zachowane. W toku zatwierdzona integracja end-to-end na emulatorach; bez aktywacji produkcyjnej.

## 2. SPRAWDZONE — NIE POWTARZAĆ bez zmiany dowodów

- **PR #86:** pierwsza próba CI dla HEAD `ab93268dadcec9f7053d28260c3b7485131afb5f` miała [FAIL](https://github.com/mebleszek/meble-app/actions/runs/40928905654) (dowód historyczny: test odtworzonej sesji i natywny dotyk zakładki MATERIAŁ). Po poprawkowym HEAD `d3cd7ef...` [pełne wymagane CI przeszło PASS](https://github.com/mebleszek/meble-app/actions/runs/40971823833), auto-merge i Pages PASS. **Pierwotny FAIL nie jest dziś aktywnym blokerem**, lecz nie uprawnia do pomijania regresji przy nowym SHA.
- **Zaufanie urządzeń / Auth:** potwierdzony PR #85 i jego CI. Nie ponawiać całego audytu przy dokumentowaniu innego zadania; nowe zachowanie na telefonie wymaga osobnej kontroli właściciela.
- **STORAGE RECOVERY i LOCAL-FIRST:** zakresy odpowiednio PR #83 i #84 są wydane; nie zlecać ponownie ich implementacji ani zaliczonych testów. Brak podłączenia funkcjonalnego LOCAL-FIRST jest **innym, przyszłym etapem**, a nie błędem w opisie stanu PR #84.
- **Firebase Rules:** historyczne dwa odczyty GET z 20.10.2026 potwierdziły 635 bajtów i SHA-256 `9260ebcd…ffa91` dla ówczesnego release. **To nie jest świeże potwierdzenie stanu LIVE, uprawnień IAM ani billingu**. Nie ponawiać tych historycznych GET tylko z powodu utraty kontekstu.
- **Zakres i właściciele danych:** obowiązują istniejące `CLOUD_DATA_REGISTER.md`, `CLOUD_MIGRATION.md`, `BACKUP.md` oraz Issue #47. Nie tworzyć drugiego rejestru ani nie zgadywać własności danych legacy.
- **PR #41** to osobny, wciąż otwarty historyczny PR dokumentacyjny (stan zweryfikowany 30.10); nie scalać go ani nie zastępować zawartych tam decyzji bez osobnego zakresu.

### Zdarzenia po wydaniu PR #86 — zgłoszenia z fizycznego Androida

**PHONE_FAIL_REPORTED / FIX_PENDING:** po wylogowaniu nie można otworzyć jednego istniejącego inwestora; po utworzeniu nowego chwilowo widać pomieszczenia najstarszego inwestora, a po zapisaniu i ponownym wejściu nowy projekt jest pusty. Wymagana naprawa izolacji danych/aktywnego kontekstu, nie usunięcie rekordu. Do poprawy także poziomy separator pod statusami pomieszczeń oraz jednakowa czcionka i styl checkboxa Zaufany / Wyloguj. Zlecenie Codexowi przygotowano, lecz **brak potwierdzonego commita i wydania poprawki**. CI/Pages PASS #86 dotyczy poprzedniego kodu, nie naprawy zgłoszeń.

### CLOUD-4.6F — potwierdzenie właściciela 30.10

Google APIs Explorer: jednokrotny produkcyjny GET projects.getBillingInfo -> HTTP 200, billingEnabled:false, billingAccountName puste. **BILLING_PASS** dla tego odczytu, bez włączenia opłat. Historycznie (20.10) potwierdzono Spark i rezerwę co najmniej 500 odczytów / 30 zapisów; tych dowodów nie powtarzać tylko z powodu zmiany rozmowy, a świeżość potwierdzać dopiero przed operacją LIVE. W CLOUD-4.6F pozostają prywatny operator, niezależny STOP po utracie całego hosta, wyłączność IAM/publisherów, świeże Rules i osobne zgody wykonawcze. **OPERATOR_PARTIAL / LIVE_BLOCKED.**

**Reset aplikacji:** właściciel potwierdził brak rzeczywistych danych klientów w zresetowanej instalacji. Istnieją obecne testowe rekordy inwestorów, ale reset lokalny nie dowodzi pustego Firestore. Nie usuwać żadnych danych jako elementu dokumentacji.

## 3. BLOKERY / otwarte warunki (stan na 30.10.2026)

- **PHONE_FAIL_REPORTED / FIX_PENDING:** test fizycznego Androida wykazał błędy inwestorów i pomieszczeń oraz dwie kwestie wyglądu; brak dowodu wdrożenia naprawy. Szczegóły powyżej.
- **SYNC_NOT_ACTIVE:** moduły LOCAL-FIRST #84 istnieją, ale brak zatwierdzonego, bezstratnego podłączenia realnych projektów, globalnych zależności, `Zapisz/Anuluj` i startupu. Nierozstrzygnięte domeny, stare writery, wyłączność i migracja pozostają bramkami.
- **CLOUD-4.6F / Firebase LIVE:** `OPERATOR_PARTIAL / LIVE_BLOCKED`; brak ogólnej zgody na Rules, grant, produkcyjny READ/WRITE, billing, migrację i aktywację synchronizacji. Starsze raporty `LIVE_BLOCKED` nadal obowiązują, a historyczne zgody na samo przygotowanie niczego nie wykonują.
- **Etap E archiwum:** historyczny bloker dowodu wyłączności starych writerów nie został rozwiązany samym wydaniem PR #83. Nie zakładać możliwości destrukcyjnego przełączenia ani czyszczenia pamięci telefonu.

## 4. NASTĘPNY RUCH — jedno zadanie naraz

1. **Pakiet dokumentacyjny PR #87 wydany** na gałęzi [`docs/current-state-ledger-20261030`](https://github.com/mebleszek/meble-app/tree/docs/current-state-ledger-20261030): uporządkowanie głównej dokumentacji i zachowanie oryginalnych kronik w archiwum; **CODE_READY / CI_PENDING / RELEASE_BLOCKED**. Następny ruch: osobna decyzja właściciela o wydaniu dla dokładnie zweryfikowanego HEAD i BASE. **Bez PR Ready, CI, auto-merge i Pages przed tą zgodą.**
2. Naprawa Androida po PR #86: izolacja projektów i odzyskanie dostępu do istniejącego inwestora, potem poprawki wizualne. Dopiero po nowym zatwierdzonym wydaniu przeprowadzić ponowny test telefonu; nie kasować testowego rekordu.
3. Oddzielnie: CLOUD-4.6F — zapewnienie niezależnego STOP i prywatnego hosta operatora. Bez ponawiania zakończonych etapów C/D/E lub produkcyjnych LIVE bez zgód.

## 5. OBOWIĄZKOWY ZAPIS KOLEJNYCH KROKÓW

Każdy zatwierdzony i **rzeczywiście wykonany** etap dopisuje się **najpierw do tej aktualnej sekcji**, nie jako kolejny nagłówek z nową datą ponad poprzednim. Codex w ramach zatwierdzonego zakresu aktualizuje ten rejestr razem z odpowiednimi plikami: **data i zakres, gałąź, wejściowy BASE SHA, wynikowy HEAD SHA (jeśli znany), realne wyniki i linki do PR/CI/Pages, blokery, następny ruch**. Nie wpisywać PASS dla testu nieuruchomionego. Wynik wydaniowego CI po fakcie należy uzupełnić w kolejnym **osobno zatwierdzonym** pakiecie dokumentacyjnym; nie robić nieuzgodnionych pushy do `main` ani do PR w trakcie obsługi CI.

Przed nowym wątkiem ChatGPT ma **najpierw odczytać ten fragment, potem sprawdzić świeży GitHub** (main, otwarte PR-y, Actions, Pages) i rozróżnić potwierdzone, historyczne i planowane fakty. Gdy GitHub i zapis się różnią, nie zgadywać: odnotować rozbieżność i zaproponować jej korektę. Szczegółowe wyniki trzymać w istniejących raportach; `ROADMAP.md` nie powiela bieżących statusów. Zmiany repozytorium zawsze wymagają właściwej zgody właściciela zgodnie z `AGENTS.md`.

---


## 6. ARCHIWUM

[Pełna historyczna chronologia CURRENT_STATE](docs/archive/CURRENT_STATE_history_to_20261030.md) zawiera wcześniejsze wpisy i dowody. Ich dawne statusy nie stanowią bieżącej listy zadań.

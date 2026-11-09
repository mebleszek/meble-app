# Optymalizacja kontekstu Codexa — 09.11.2026

Zatwierdzony pakiet dokumentacyjny `mebleszek/meble-app`, gałąź `docs/codex-context-optimization`, BASE/main `e1e8d6c9825120434a06b7b75aabd601f02c574c`. Jeden wykonawca, bez szerokiego audytu aplikacji. Źródła odczytano w całości skryptowo; do kontekstu wybierano zasady, aktywne fragmenty i inwentarz historii. Wynikowy HEAD to jedyny commit zawierający raport; pełny SHA, push i CLEAN w przekazaniu po potwierdzeniu zdalnym.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**, bez wydania tego pakietu. [CURRENT_STATE](../../CURRENT_STATE.md) pozostaje jedynym aktualnym rejestrem; ten raport jest dowodem zakresu/kontroli na wskazanym BASE.

## Rozmiary

Bajty UTF-8 ze źródeł aktualnego main po fetch, nie starszego checkoutu.

| Plik | Przed (B) | Po (B) |
|---|---:|---:|
| [AGENTS.md](../../AGENTS.md) | 50067 | 19962 |
| [CURRENT_STATE.md](../../CURRENT_STATE.md) | 110225 | 10389 |
| [docs/agents/COLLABORATION.md](../../docs/agents/COLLABORATION.md) | — | 8291 |
| [docs/agents/PRICING.md](../../docs/agents/PRICING.md) | — | 2435 |
| [docs/agents/RELEASE.md](../../docs/agents/RELEASE.md) | — | 11042 |
| [docs/agents/TESTING.md](../../docs/agents/TESTING.md) | — | 6051 |
| [docs/archive/CURRENT_STATE_history_to_20261109.md](../../docs/archive/CURRENT_STATE_history_to_20261109.md) | — | 111167 |
| Raport optymalizacji (ten plik) | — | 8775 |

AGENTS i aktywny CURRENT_STATE razem są około 81% mniejsze. Całkowity rozmiar dokumentacji rośnie przez pełne archiwum; oszczędność dotyczy kontekstu startowego i selektywnych odczytów. Procedury czyta się przed odpowiednią czynnością. Archiwum i raport nie są automatycznym kontekstem każdego zadania.

## Zachowanie zasad

Sprawdzono wszystkie dotychczasowe §1–20. Numeracja AGENTS jest stabilna. Procedury stanowią część jednego kontraktu i nie tworzą nowych zgód. Konsolidacja dotyczy powtarzanych opisów startu, ról, pakietowania i ponawiania zgód.

| Źródłowe sekcje | Lokalizacja i zachowane warunki |
|---|---|
| §1, §5, §6, §8, §11 | Pełna treść w AGENTS: do dzieła, zakres/STOP, anonimowa diagnostyka telefonu, ryzyko domen, repository/store, dane globalne/testowe, migracja/kopia/rollback, osobne zgody. |
| §2 | AGENTS §2/COLLABORATION: pełny łańcuch audytu ChatGPT, fakty przed rekomendacją, największy spójny pakiet bez limitu punktów, odwracalny diff, brak pobocznego refaktoru/rename/formatowania, błędy powiązane vs niezwiązane, STOP danych. |
| §3, §9–10 | Pełna treść w TESTING, skrót/bramki w AGENTS: właściciele i faktyczne pokrycie CI dla SHA, testy wysokiego ryzyka, aktualne nazwy/zależności/listy serwerów/wersje, zachowane negatywy/brzegi, bez osłabiania dla PASS, jawny FAIL/luki, niezależne statusy. |
| §4 + 08.11 | Pełna treść w PRICING: wspólny kalkulator i jawne reguły WYCENY/CZYNNOŚCI/HARMONOGRAMU, źródła cen/czasu, przykład 80/250, pochodna cena km, zero/warunki/mnożnik/zakres/brak dublowania, LOCAL-FIRST, zamrożone oferty, bez migracji/UI/hurtowej naprawy z samej zasady. |
| §7 | AGENTS §7/mapa COLLABORATION: wszystkie źródła, Spark/Google i proponowane niewdrożone Rules razem z CLOUD_DATA_REGISTER; README/DEV mogą być historyczne; kod/testy/aktualne decyzje, pytanie przy niejasności. |
| §12 | Pełna treść w RELEASE: Ready, wykonawca ChatGPT/zastępstwo, osobna zgoda na repo/gałąź/HEAD/BASE/zakres, jeden CI, auto-merge/exact Pages, STOP po zmianie/FAIL, zakaz retry/ręcznego merge, Draft tylko potrzebny i chciany. |
| §13 | AGENTS §13/COLLABORATION: cały zakres ochrony UI, wyjątek B, wzorce 07.11 z galerią, rekomendacja biznesowa/ryzyko/testy/STOP, jeden pakiet/zgoda, brak równoległych zmian i konkurencyjnych źródeł, Zapisz/Anuluj, autorytet, globalne dane/oferty i telefon osobno. |
| §14 | AGENTS §14/COLLABORATION: ChatGPT GPT-6 High prowadzi i doradza Meble-App/MebLeszek, kwestionuje nietrafne pomysły i niezależnie kontroluje; Codex Sol High implementuje, Work dla złożonych analiz, Actions testuje/wydaje, właściciel decyduje. Granice roli i wyjątki wymagają zgody. |
| §15 | AGENTS §15/CURRENT_STATE §5/COLLABORATION: jeden dziennik, trwałe decyzje z datą/zgodą/stanem wdrożenia w istniejącym MD, pełna historia, bez commitów podczas obserwacji CI, późniejsze wyniki w kolejnym zatwierdzonym pakiecie; mapa dokumentów i zakaz ich usuwania. |
| §16 | Pełna treść w RELEASE: SW/ten sam profil, zakaz czyszczenia i reloadu edycji, progi 250/400/600/wyjątki, 75/90 s bez FAIL za czas, siedem grup, DEMO [5,1,2], SDK/Historical, 425 pinów/immutability/TAP/ci-summary, kompletne pokrycie i koszt runnerów, bez retry, wyjątkowa implementacja ChatGPT po zgodzie. |
| §17 | AGENTS §17: 0 zł, Spark/Pages/IDB/Google, brak obietnic nieograniczonych zasobów, cel telefon–komputer, FREE-FIRST, wstrzymane CLOUD-4.6G/VPS/STOP, bez usuwania zabezpieczeń w ciemno, owner-only/offline/autorytet/cenniki i osobne LIVE/CI/wydanie. |
| §18 | AGENTS §8/§18/COLLABORATION: brak resetu ustaleń/audytów/zgód, konkretna kontrola zamiast nowego planu, dostęp nie jest FAIL, metody przed wtyczką, brak sekretów, oryginalne cenniki nietknięte, RAW/IDB/offline chronione. Dodano selektywne odczyty, filtrowanie logów, jednego wykonawcę, diff dla drugiego Codexa i krótkie przekazanie. |
| §19 | AGENTS §19/COLLABORATION: właściciel decyduje o nowych zadaniach/zabezpieczeniach, luka nie musi blokować, STOP nie rozszerza zgody, produkt/sync/WYCENA/RYSUNKI i nieosłabione aktualne testy. |
| §20 | Pełna treść i szablon w RELEASE: implementacja/kontrole/dziennik, commit/push/CLEAN, świeże zdalne SHA 40 znaków, jawne braki/BLOCKED, bez PR/Actions/wydania/LIVE; kolejne SHA wymagają przekazania i zgody. |

Kontrola mechaniczna potwierdza pełne dawne sekcje **1,3,4,5,6,8,9,10,11,12,16,20** w AGENTS/procedurach (jedynie prefiks odwołań § wskazuje AGENTS). Pozostałe akapity porównano semantycznie według mapy. Nie jest to automatyczny dowód równoważności języka naturalnego.

## Archiwum i odnośniki

Pełny poprzedni CURRENT_STATE zachowano w nowym archiwum. Porównanie całej treści po rebazowaniu linków i odwrócenie zmian odnośników odtwarza oryginalne bajty. Daty, SHA, wyniki, normy, decyzje i dowody nie są streszczane ani usuwane z archiwum. Stare archiwum jest nietknięte. Aktywny stan zachowuje SYNC_BLOCKED, PHONE_PENDING, backup/device proof, repair/wyłączność/LOCAL-FIRST/LIVE, otwarty PR #41, odłożone prace i jeden następny ruch.

Względne linki archiwum przesunięto o `../../`. Naprawiono trzy istniejące błędne kotwice raportu `android-investor-open-20261030.md`, bez zmiany raportu/dowodu:

| Dawna kotwica | Działająca kotwica |
|---|---|
| `pr-91--celowana-korekta-nieaktualnej-gotowosci-gestu-31102026` | `pr-91--celowana-korekta-nieaktualnej-gotowości-gestu-31102026` |
| `pr-91--druga-proba-fail-i-instrumentacja-diagnostyczna-31102026` | `pr-91--druga-próba-fail-i-instrumentacja-diagnostyczna-31102026` |
| `pr-91--korekta-dwoch-blokad-ci-po-trzeciej-probie-31102026` | `pr-91--korekta-dwóch-blokad-ci-po-trzeciej-próbie-31102026` |

Kontrole skryptowe PASS: pełne archiwum odtwarza źródło SHA-256 `c18e60c7577a2551c1322d23c348d6d881745d79aa52e57c20b7b7716a6de591`, zachowano 121 wystąpień pełnych SHA; 12 sekcji zasad w pełnym brzmieniu; 90 lokalnych odnośników/kotwic, 66 odnośników zewnętrznych zachowanych bez ponownego pobierania; istniejące wejściowe linki i allowlista plików oraz `git diff --check` PASS. Sprawdzono wszystkie lokalne cele Markdown i fragmenty w ośmiu zmienionych plikach. Utrzymano wejściowe kotwice `local-first` oraz `android-quota--incydent-z-24102026` dla CLOUD_MIGRATION/ROADMAP; quota odsyła do historycznego incydentu. Zewnętrzne linki dowodowe zachowano, bez pobierania każdej historycznej strony. Aktualne PR #121/#123, otwarty #41 i CI/exact Pages #42539813337 sprawdzono odczytowo przez połączony GitHub; nie ponawiano testów.

## Zakres i ryzyka

Allowlista ośmiu plików `.md`, kontrola diffu/whitespace i kotwic. Bez zmian aplikacji, testów, workflow i danych telefonu. Odczyt triggerów workflow potwierdza, że push tej gałęzi nie uruchamia pełnego Preflightu ani izolowanych gałęzi emulatorowych. Bez PR, uruchamiania CI, merge/publikacji i Firebase LIVE.

Agent musi odczytać właściwą procedurę przed czynnością; obowiązek/linki są w AGENTS. Archiwum zawiera dawne „aktualny” i FAIL/PENDING, dlatego oznaczono je historyczną migawką. Późniejsza zmiana main/SHA wymaga świeżego przekazania. Kontrola dokumentacji nie jest testem aplikacji ani nową zgodą wydaniową/LIVE.

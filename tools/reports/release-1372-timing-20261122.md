# Wydanie PR #158 i czas Preflight #1372 — 22.11.2026

## USTALONE

Właściciel zatwierdził wydanie poprawek zapisu zakładek i duplikatu oferty oraz analizę i potrzebną optymalizację wydawania. Świeży odczyt wykazał, że dokładny pakiet został już wydany przez istniejący PR #158. Nie utworzono drugiego PR, nie ponowiono Actions i nie wykonano ręcznego merge. Po zakończeniu odczytowej kontroli wydania przygotowanie optymalizacji odbywa się osobno, na gałęzi chore/ci-release-timing-20261122 od aktualnego main.

## WDROŻONE — potwierdzone wydanie

- [PR #158](https://github.com/mebleszek/meble-app/pull/158): zamknięty, scalony automatycznie; HEAD dd3b2c4af18695f21ae0197b8fce8bca9dd8bd96, zatwierdzony BASE f8a3244e4169a16e4f8a205d0740a26c5ce2282e.
- [Preflight #1372](https://github.com/mebleszek/meble-app/actions/runs/44960192332): jedna próba, 85/85 success, w tym nowe tab-save i duplicate-replacement, auto-merge i post-merge-verify. Brak ponawiania.
- Merge/main ddeb79fd40f5763584a84d0f181e616138a51572, drzewo bddbbf0b051922af18a533b4f620730955c0ba36 identyczne z kandydatem. [Exact Pages #2467](https://github.com/mebleszek/meble-app/actions/runs/44960697345) success dla tego merge SHA.
- Odczyt publicznej strony: HTTP 200 i dokładne bajty index.html, offline-assets.js oraz wszystkich pięciu zmienionych modułów aplikacji. Nie używano profili właściciela, nie odświeżano jego kart i nie zmieniano Firebase LIVE. Odbiór telefonu pozostaje PHONE_PENDING.

## Rzeczywiste czasy

Źródło: komplet 85 jobów Preflightu i trzy joby Pages, 260 jednostek ze wszystkich 36 logów smoke. Timestamps API są UTC; PR otwarto 21.11 o 23:07:10Z (22.11 o 00:07:10 w Warszawie). Sum runnerów nie dodajemy do czasu ściennego.

| Etap | Pomiar |
| --- | ---: |
| PR → koniec safety | 20 s |
| Koniec safety → ostatni test, razem z kolejkami | 315 s / 5:15 |
| Ostatni test → automatyczne scalenie | 20 s |
| Scalenie → zakończenie Pages | 42 s |
| **PR → opublikowane Pages** | **397 s / 6:37** |
| PR → koniec całego workflow z końcowym raportowaniem | 418 s / 6:58 |
| Najdłuższa kolejka joba | 234 s / 3:54 |
| Wszystkie joby, suma czasu runnerów | 5335 runner-sekund |
| 76 nie-Windowsowych jobów roboczych | 5215 runner-sekund |
| Smoke: suma 260 pomiarów / najdłuższa jednostka | 1772,054 s / 120,415 s |
| Pages build / deploy | 23 s / 8 s |

Zaobserwowano maksymalnie 20 jednoczesnych jobów poza Windows. To pomiar runu, nie potwierdzenie planu/limitu konta. Przy tym samym obciążeniu i 20 slotach sama idealnie upakowana faza robocza potrzebuje co najmniej 260,75 s, przed safety, podsumowaniami i Pages. Cel czterech minut nie jest obecnie potwierdzony ani gwarantowany.

## Przygotowana optymalizacja — jeszcze niewydana

1. Nowy profil ci-smoke-timings-1372.json zawiera wszystkie 260 rzeczywistych pomiarów zamiast starych szacunków z #1367. Historyczny profil zachowany.
2. Jednostka wycena-labor-norms-smoke.js::8 wykonywała sześć niezależnych kombinacji adjustable/fixed × none/cabinet/offer, każdą ze świeżym fixture. Rejestrujemy je jako sześć osobnych przypadków, bez zmiany ich treści/asercji. Dziewięć dawnych przypadków staje się 14; osiem pozostałych callbacków pozostaje dokładnych. Mechaniczne porównanie ze źródłem main potwierdziło niezmienność całego ciała sześciu kombinacji (SHA-256 47fa5d97e3411b730efd8828aab4f7cd467eaa8a65af2bf6477474ae4580011b).
3. Plan nadal ma 36 obowiązkowych, rozłącznych grup, 229 plików i teraz 265 jednostek. P0-B/P1 ma nadal 27 segmentów / 42 przypadki. Nowe części otrzymują jawne szacunki z podziału 120415 ms; ostatni niezmieniony przypadek jest jawnie mapowany na nowy indeks 14. Nowe przyszłe testy pozostają wykonywane z oznaczonym szacunkiem startowym, zamiast odmawiać im uruchomienia z braku wcześniejszego pomiaru.
4. Największe planowane obciążenie grupy: 76511 ms, najmniejsze: 45769 ms. To szacunek nowego przydziału, nie zmierzony czas nowego CI. Suma modelowanych czasów pozostaje 1772054 ms; nie ukrywamy pracy ani nie skracamy asercji.

Model z 20 slotami, dotychczasową kolejnością startu i niezmienionym narzutem jobów: stara faza 308 s, nowa około 299,865 s, czyli około 8 s zysku. Rzeczywista stara faza trwała 315 s. Model nie gwarantuje kolejności GitHuba ani czasu nowych części. Skrócenie najdłuższej jednostki jest większe niż przewidywany zysk całego wydania, ponieważ pozostała praca i kolejki nadal dominują.

## Kontrole i ograniczenia

- Routing/pokrycie i release-speed smoke PASS: 36 grup, komplet 265 jednostek, wszystkie 14 części norm oraz każda z sześciu kombinacji dokładnie raz. Negatywy duplikatów/nieznanych partycji, integralność cache i npm ci zachowane.
- Mechaniczna kontrola niezmienności ośmiu callbacków i treści sześciu wydzielonych wariantów PASS. Kalkulator, cenniki, UI, Rules, runtime i manifest pozostają bez zmian.
- Celowane wykonanie sześciu nowych części **6/6 PASS**, każda osobnym procesem Node na Windows, lokalnie po dwie równolegle. Czasy 54–57 s/część na tym komputerze nie są pomiarem runnera GitHuba. Przeniesiony niezmieniony przypadek na nowym indeksie 14: **1/1 PASS**. Nie ponawiano pozostałych siedmiu przypadków ani pełnego CI.
- Dane źródłowe i model: ../../outputs/release-1372-evidence/timings.json oraz model.json. Kod i JSON profilu pochodzą z powyższego konkretnego runu, nie z szacowania historii rozmowy.

## BRAKUJE → PROPONOWANE

Wydane poprawki: RELEASED / CI_PASS / PAGES_PASS / PHONE_PENDING. Optymalizacja: CODE_READY / CI_PENDING / RELEASE_BLOCKED, BASE/main ddeb79fd40f5763584a84d0f181e616138a51572. Celowane kontrole zakończone; jeden commit/push bez PR i bez kolejnego wydania; nowy HEAD wymaga osobnej zgody wydaniowej.

Dalsze duże przyspieszenie wymaga zmniejszenia całkowitej zajętości runnerów lub innego modelu równoległości. Nie wdrażamy spekulacyjnie wspólnych emulatorów, współdzielonych danych/profili ani zmian limitów startu Chromium. P1 nadal ma rzeczywiste 120 s obserwacji, wszystkie bramki exact HEAD/BASE/425 pinów/ACK pozostają. Brak nowych płatnych usług. Nie zmieniono ani nie powtórzono wydania w ramach tego pomiaru.

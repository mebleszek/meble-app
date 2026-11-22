# Testy, raport i statusy

Szczegóły obowiązujących zasad z [AGENTS.md](../../AGENTS.md); dokument jest jego częścią, nie osobnym źródłem zgód. Numeracja § odsyła do AGENTS.md. Czytaj tylko przy pracy objętej poniższym zakresem. Przeniesione procedury zachowują daty decyzji.

## 3. Testy proporcjonalne do zmiany — decyzja właściciela 22.11.2026

Celem jest wiarygodny dowód poprawności, nie liczba testów. Ta decyzja zastępuje obowiązek pełnego zestawu dla każdej modyfikacji testu lub dokumentacji; nie usuwa zabezpieczeń aplikacji.

### Przygotowanie i testy lokalne

1. Ustal zmieniane zachowanie, jego ryzyko i zależności. Sprawdź istniejące pokrycie tego obszaru; nie czytaj całej aplikacji i historii dla drobnej poprawki.
2. Najpierw wykorzystaj istniejący test. Rozszerz go, gdy brakuje przypadku; nowy plik/zadanie CI tylko dla odrębnej izolacji lub dowodu. Komentarz, nazwa techniczna lub korekta bez zmiany zachowania nie wymaga automatycznie nowego testu.
3. Każdy nowy przypadek uzasadnij wymaganiem, błędem albo niepokrytym ryzykiem. Preferuj szybki test funkcji/domeny; integrację dla granicy magazynów/protokołów; prawdziwe UI dla ważnego przepływu użytkownika. Nie powtarzaj w Chromium wszystkich wariantów kalkulatora sprawdzonych domenowo. Zachowaj reprezentatywne UI oraz negatywy integracji.
4. Dla błędu pokaż właściwy RED→GREEN i potrzebne sąsiednie regresje. Nie ponawiaj PASS bez nowej zmiany, awarii lub luki. Lokalnie tylko celowane kontrole; pełna regresja należy do GitHub Actions.
5. Dostosuj powiązane istniejące fixture, kontrole statyczne, serwery testowe, wersje, manifesty i przydział CI do zatwierdzonego kontraktu. Nie zmieniaj guardów ani biznesu dla PASS.

### Automatyczny zakres zatwierdzonego CI

Safety czyta diff dokładnych commitów HEAD/BASE, nie etykietę PR. Implementacja: [ci-docs-scope.js](../../tools/ci-docs-scope.js) i [ci-test-maintenance.js](../../tools/ci-test-maintenance.js). Każdy wariant zachowuje kontrolę źródeł/manifestu/425 pinów, zgodę Ready, agregację i exact Pages.

| Zmiana | Wymagane CI |
|---|---|
| Wyłącznie modyfikacje istniejących zwykłych plików AGENTS.md, CURRENT_STATE.md, docs/agents/TESTING.md, docs/agents/RELEASE.md, docs/plans/test-strategy-playwright-20261115.md | `documents`: treść/odnośniki, niezmieniona aplikacja, kontrola zakresu i odmów źródeł; bez Chromium/SDK. |
| Wyłącznie modyfikacje sprawdzonych samodzielnych testów z zamkniętej listy ci-test-maintenance.js, ewentualnie wraz z powyższymi MD | `tests`: zmienione pliki testowe w całości, składnia/kolejność/zależności/storage, zakres, pełny przydział CI, DAG i odmowy źródeł. Bez emulatorów i niezwiązanych scenariuszy aplikacji. |
| Kod aplikacji, bezpieczeństwo, zapis/model, kalkulator/ceny, synchronizacja, wspólny fixture/harness, browser/SDK test, workflow/klasyfikator/lista zakresów, nowy/usunięty/przeniesiony plik, zmiana trybu, inna MD lub nieznany wpływ | `full`: komplet istniejącej regresji, 36 grup smoke, segmenty SDK/P0-B/P1, UI i Windows. |

`tests` obejmuje początkowo 10 przejrzanych testów VM bez eksportowanych fixture i bez znalezionych konsumentów w kodzie wykonawczym. To ograniczenie wdrożenia, nie dowód zbędności reszty. Zmiana aplikacji nadal wymaga pełnej regresji: globalny graf zależności nie daje obecnie dowodu bezpiecznego automatycznego wyboru mniejszego zestawu. Rozszerzenie szybkiej ścieżki wymaga przeglądu konsumentów i regresji klasyfikatora; zmiana samej polityki wykonawczej idzie przez `full`.

Brak/FAIL/cancelled/skipped wymaganego testu lub brak wyniku blokuje merge. Nieznany tryb blokuje agregację. Poza zakresem raportuj **NIE WYKONANO — nie dotyczy wykazanego diffu**, nigdy PASS odziedziczony z innego SHA. Raport podaje zakres. Workflow nie startuje na zwykły push; zgoda na wydanie pozostaje odrębna.

### Utrzymanie zestawu

- Nie dodawaj ciężkiego E2E, gdy wystarczy istniejący scenariusz lub niższa warstwa. UI/IndexedDB/ACK pozostają rzeczywistymi dowodami, gdy ich dotyczy zmiana.
- Duplikaty scalaj dopiero po porównaniu asercji, wariantów i izolacji. Zachowaj mapę wymaganie → pozostały test → grupa CI oraz negatywy. Podobna nazwa i długi czas nie dowodzą zbędności.
- Kruchy test naprawiaj przez rzeczywisty stan gotowości, deterministyczne dane i cleanup; bez ślepych retry, force-click, fikcyjnego sukcesu i podnoszenia timeoutów w ciemno.
- Mierz oddzielnie testy, przygotowanie, kolejkę i publikację. Nie powtarzaj całego audytu przy każdej poprawce.

Niemożliwa wymagana kontrola = luka, przyczyna i metoda sprawdzenia, np. fizyczny telefon; nigdy pozorny PASS. Bez zgody wydaniowej: `CODE_READY / CI_PENDING`. Przy FAIL ustal pierwszy punkt odmowy i przyczynę (produkcja/test/konfiguracja/założenie), napraw w zatwierdzonym zakresie. Retry wydania według §12.

## 9. Raport po wykonaniu zadania

Po zmianie podaj krótko:

- co zostało zmienione,
- które pliki zostały zmienione,
- czego świadomie nie ruszano,
- jakie kontrole i testy rzeczywiście wykonano, przez kogo i dla jakiego SHA; dla CI podaj link oraz zatwierdzone HEAD/BASE,
- wynik Preflightu i wymaganych regresji z CI albo jawne `CI_PENDING` / FAIL / BLOCKED, bez zaliczania testów niewykonanych i bez odziedziczenia PASS z innego SHA,
- osobno status implementacji, weryfikacji, wydania i zgód LIVE zgodnie z AGENTS.md §10,
- ewentualne pozostałe ryzyka lub decyzje do podjęcia.

Pakiet implementacyjny można przekazać jako `CODE_READY` z `CI_PENDING`, jeżeli nie zatwierdzono jeszcze CI/wydania. Nie przedstawiaj tego jako potwierdzenia jakości, gotowości produkcyjnej ani zakończonego wydania. Rozbieżności zakresu, FAIL i brakujące dowody zgłaszaj jawnie.

## 10. Definition of Done

Warunki zakończenia implementacji (`CODE_READY`):

1. wykonano wyłącznie uzgodniony zakres,
2. nie wprowadzono nieuzgodnionych zmian pobocznych,
3. zachowano kompatybilność istniejących danych albo jasno opisano uzgodnioną migrację,
4. przygotowano wymagane regresje, sprawdzono diff i przypisano weryfikację zgodnie z AGENTS.md §3,
5. wskazano wyniki faktycznie wykonanych kontroli i wszystkie brakujące dowody,
6. przedstawiono krótkie podsumowanie oraz osobno poniższe statusy.

| Status | Wymagany dowód i znaczenie |
|---|---|
| `CODE_READY` | Implementacja uzgodnionego pakietu jest gotowa; nie potwierdza zaliczenia CI ani gotowości produkcyjnej. |
| `CI_PENDING` | Wymagane testy jeszcze niewykonane lub niezakończone; raport wskazuje brakujące zestawy. Może współistnieć z `CODE_READY`. |
| `CI_PASS` | Wszystkie wymagane testy rzeczywiście zaliczone dla wskazanego SHA i zakresu; link do CI, HEAD/BASE oraz ewentualne dowody spoza CI. FAIL, BLOCKED lub niewykonany wymagany test wykluczają ten status. |
| `RELEASED` | Zatwierdzony pakiet scalony przez procedurę AGENTS.md §12, a Pages potwierdzone dla dokładnego merge SHA. Akceptację ergonomii na fizycznym telefonie raportuj oddzielnie. |
| `LIVE_BLOCKED` / `LIVE_APPROVED` | Niezależny status konkretnej operacji produkcyjnej: domyślnie zablokowana; zatwierdzona tylko po osobnej, wyraźnej zgodzie właściciela i spełnieniu wymaganych dowodów/bramek. Podaj zakres, artefakt i warunki zgody; nie jest to ogólne uprawnienie LIVE. |

`CI_PASS` nie udziela zgody na wydanie. `RELEASED` nie udziela zgody na Firebase LIVE, Rules, granty, billing ani migrację. `LIVE_APPROVED` nie uruchamia operacji automatycznie i nie znosi blokad technicznych; zgoda przygotowawcza nigdy nie jest wykonawczą. Zmiana SHA unieważnia przypisanie wcześniejszego PASS do nowej wersji.

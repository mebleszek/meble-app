# Testy, raport i statusy

Szczegóły obowiązujących zasad z [AGENTS.md](../../AGENTS.md); dokument jest jego częścią, nie osobnym źródłem zgód. Numeracja § odsyła do AGENTS.md. Czytaj tylko przy pracy objętej poniższym zakresem. Przeniesione procedury zachowują daty decyzji.

## 3. Testy są bramką bezpieczeństwa, nie celem samym w sobie

**GitHub Actions odpowiada za automatyczne testy objęte CI**, w tym `node tools/preflight.js`, regresje oraz właściwe zestawy Firebase Emulator Suite. Codex przygotowuje kod i testy, ale nie dubluje ich pełnym lokalnym uruchomieniem przed CI ani po jego zaliczeniu. ChatGPT kontroluje dowody zamiast powtarzać te same testy.

**Aktualność testów w ramach każdej modyfikacji aplikacji:** ChatGPT przed zleceniem identyfikuje regresje i oczekiwania zależne od zmienianego zachowania; Codex ma obowiązek przejrzeć powiązane istniejące testy i dostosować je w tym samym zatwierdzonym pakiecie do aktualnego kontraktu, nazw modułów, zależności (również list serwerów testowych) i wersjonowania. Aktualizuje wyłącznie nieaktualne asercje wynikające z jawnie zaakceptowanego kontraktu, dodaje uzgodnione przypadki nowego zachowania i sprawdza rzeczywiste włączenie do CI. Zachowuje wszystkie nadal obowiązujące zabezpieczenia, asercje negatywne i przypadki brzegowe. Nie wolno osłabiać asercji, usuwać wymaganych scenariuszy, maskować rzeczywistych błędów aplikacji ani zmieniać kontraktu biznesowego tylko po to, żeby uzyskać PASS. Aktualizacja powiązanego testu mieści się w zgodzie na implementację; pełne CI wciąż należy do GitHub Actions.

Przed implementacją ustal wymagane testy, ich właściciela i rzeczywiste pokrycie aktualnych workflow. Samo istnienie skryptu testowego lub workflow dla innej gałęzi nie oznacza wykonania testu dla bieżącego SHA. Dla zmian wysokiego ryzyka wymagane są także właściwe regresje domenowe; sprawdź, czy są częścią Preflightu lub osobnego zadania CI, zamiast uruchamiać je ponownie lokalnie.

Codex może wykonywać minimalną diagnostykę i celowaną reprodukcję niezbędną do napisania lub naprawienia kodu oraz kontrolę diffu. Nie ponawia automatycznie pełnych zestawów CI. Dodatkowy test wymaga konkretnej luki lub nowego błędu, a nie samej chęci ponownego potwierdzenia PASS.

Jeżeli wymagany test nie może działać w CI, opisz lukę, przyczynę, właściwego wykonawcę i sposób weryfikacji (np. fizyczny Android przez właściciela albo prywatny artefakt sprawdzony lokalnie bez publikacji). Nie oznaczaj go jako PASS ani nie uznawaj niepełnego CI za pełne potwierdzenie jakości. Przy braku zgody na uruchomienie wymaganej ścieżki CI raportuj `CI_PENDING`; samo zakończenie implementacji to `CODE_READY` (AGENTS.md §10).

Jeżeli test nie przechodzi:

- zatrzymaj się,
- wskaż dokładnie pierwszy niezaliczony etap,
- ustal, czy problem jest w kodzie produkcyjnym, teście, konfiguracji czy w nieaktualnym założeniu,
- nie zmieniaj kodu produkcyjnego tylko po to, aby test stał się zielony,
- nie pomijaj testów, nie usuwaj ani nie osłabiaj asercji dla uzyskania PASS,
- iteracje naprawcze muszą mieścić się w zatwierdzonym zakresie; ponowienie wydaniowego CI podlega AGENTS.md §12.

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

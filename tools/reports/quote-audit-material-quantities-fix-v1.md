# quote-audit-material-quantities-fix-v1

Zakres:

1. Ukryto zdublowane sekcje szczegółów z głównego widoku WYCENY.
2. Naprawiono konwersję wymiarów mm/cm w rejestrze materiałów WYCENY dla m² i obrzeży.
3. Dodano migracyjne dopisanie widocznej startowej pozycji `Obrzeże PCV standard`, gdy w cenniku użytkownika nie ma żadnego obrzeża/mb.
4. Zaktualizowano dokumentację `DEV.md`, `README.md`, `QUOTE_CALCULATION_REGISTER.md`.

Nie zmieniano PRO100, ROZRYS, backupów, import/export Excel ani pełnego modelu wymagań technicznych okuć.


## Katalog materiałów i billing — 08.11.2026

Gałąź `feat/material-catalog-authority-20261108`; BASE/main `2d11dcb6ccccd4eeb225049fd76fa17ead3e7544`, potwierdzony odczytem GitHuba. Zakres zaakceptowany przez właściciela; bez PR/Actions/wydań/LIVE.

### Kontrakt

- Jedna pozycja katalogowa ma stabilne id oraz jawne aliasy dawnych nazw. Rename dopisuje poprzednią nazwę. Wspólny resolver obsługuje katalog/WYCENĘ, grupowanie ROZRYSU, słoje i wyszukiwanie magazynowe. Zgodność HDF ogranicza się do białego HDF o tej samej grubości, w historycznej kolejności słów/odmianie koloru. Nigdy nie wybiera pierwszego z kilku pasujących materiałów. Brak/dwuznaczność blokuje nową kalkulację; jawna cena 0 pozostaje poprawna.
- UI wykorzystuje istniejące wzorce galerii, bez nowego komponentu. `purchasePrice` jest opcjonalne: brak dawnego kosztu nie staje się kosztem 0 ani rzekomym zyskiem. `pricingMode=manual` zachowuje dawne `price` bez dodatkowego narzutu. `markup` wymaga jawnego zakupu i liczy cenę klienta do groszy; nowy narzut 0%. Jawne zero zakupu/klienta pozostaje legalne. Widać wynik oraz różnicę, jeśli koszt jest znany. Import/odtworzenie nie może zawierać narzutu bez zakupu lub innego `price` niż jego wynik.
- Płytowy laminat/HDF: `billingIncrement` jest oddzielne od `priceUnit`. Wspólny materiał z zaznaczonych pomieszczeń jest agregowany przed ceil. Domyślnie laminat `sheet`, HDF `m2` (pełne metry w górę). Dla arkusza i pół arkusza podstawą jest rzeczywisty plan, nie suma pól. `virtualFraction=0.5` jest dowodem solvera; zwykły engine bez tej flagi może otrzymać pół arkusza tylko na podstawie faktycznych placements mieszczących się w półformacie po trimie, z istniejącą orientacją i odstępami kerfu. Obsługiwany także rzeczywisty półformat magazynowy. Puste arkusze nie doliczają ilości. Brak planu, workerFailed, nieułożone/brakujące elementy odmawiają kalkulacji. 0 sztuk = 0. Próg m² jest liczony z sumy mm², bez zaokrąglania powierzchni przed ceil. Gotowe fronty lakier/akryl zachowują wcześniejszą precyzję m², bez nowego ceil.
- Format (mm) i słoje wspólnie sterują ROZRYS/WYCENĄ i ich kluczem cache. Przy konwersji ceny arkusz↔m² stosowany jest ten sam format. Stare profile bez formatu zachowują dotychczasowy fallback magazynu; dopiero jawny zapis ustala nadrzędny format. Grubość jest opisem materiału, bez automatycznej zmiany geometrii korpusu. Kanoniczna grupa/id nie zmienia źródłowego `part.material` ani ledger/provenance PCV.
- Fabryczne PCV: standard 10, front 20 zł/mb. Dawne 3/5 są korygowane tylko przy zgodności kompletnej starej definicji, starterPrice i braku edycji/nowego trybu zakupu. Własne zmiany, ręczne zero i snapshoty pozostają. Start LOCAL-FIRST używa selektywnego planu materiałów obok istniejącego planu fabrycznych norm; dopisuje też brakujący billing HDF/laminatu, nie narzuca legacy formatu ani kosztu zakupu. Jedna istniejąca transakcja globals/ACK, zachowane RAW/IDB/outbox. Edycja materiałów zamyka/resetuje formularz przez istniejący afterCommit; na abort wartości zostają, a błąd renderu po ACK ma uczciwy komunikat bez nowego zapisu.

### Wykonane kontrole

- `material-catalog-authority-smoke`: **14/14 PASS**. Rzeczywisty factory HDF i stara nazwa; ambiguity; ręczna cena/koszt nieznany/zero; narzut; selektywny factory upgrade i zachowanie custom; progi 10×0,1=1 oraz 1,000001→2 m²; gotowe fronty; rzeczywisty small/large layout i half-stock; konwersje ceny/ilości; 2 pomieszczenia→1 wspólny arkusz; odmowa niekompletnego planu; rename/id; closed schema i niezgodna cena markup.
- `code-global-catalogs-smoke`: **7/7 PASS**. Artefakt zregenerowany z bieżących definicji, schema/id/provenance i source hashes zgodne.
- `quote-audit-material-quantities-fix-smoke`: **PASS**. Uzupełniony rzeczywistym engine zamiast opierania się na dawnym, ukrytym zerze bez planu; stare asercje PCV zachowane. Historyczna ręczna cena 3 w tym fixture nie została zamieniona na nową cenę fabryczną.
- `catalog-migration-test-fix-smoke`: **PASS**; `material-grain-read-safety-smoke`: **10/10 PASS**.
- Native `android-local-first-browser-smoke --material-catalog-only`: **PASS**. Prawdziwy stary profil po zimnym starcie, factory 3/5→10/20 i HDF resolution; standardowe UI i ukryty czysty Zapisz; zakup12+narzut25%=15; nazwa/format2500×1250; rzeczywisty abort IDB zachowuje wszystkie stores/RAW/formularz; ponowienie ACK; WYCENA używa tej samej ceny/id; coldrestart zachowuje format/cenę i zamrożoną wcześniejszą ofertę. Fizyczne originals, obca baza i kolejka dokładne, zero zewnętrznych żądań. Zrzut 390×844 sprawdzony — standardowy scroll nad stopką.
- Jeden końcowy pełny przebieg tego samego Android smoke po integracji: **19 grup PASS**. Nowy helper działa zawsze w domyślnym CI; flaga tylko skraca resztę. Powiązana asercja Cancel porównuje teraz dokładny stan istniejących/brakujących aliasów sprzed Cancel (po świadomym zapisie katalogu alias jest prawidłowo obecny), zamiast zakładać zawsze null.
- Syntax/diff/wersje/load groups/code asset/offline manifest: **PASS**. Zmienione moduły liczone regułami roboczego growth gate: **0 blokad**, bez nowych wyjątków. Routing: **210** bieżących smoke / **7** rozłącznych grup; nowy Node i natywny Android w shardzie **5**, audit/code-global/grain w **7**. Magazyn uzupełniony także w wejściu dev, aby korzystało z tej samej zależności.

W reprodukcjach natywnych wykryto i poprawiono rzeczywiste powiązane przyczyny: brak factory upgrade w adoptVerified LOCAL-FIRST (celowo bez normalizacji); reset inputów przez render przed ACK; zmianę źródłowej nazwy części kolidującą ze strażnikiem PCV. Żadnego guardu nie wyłączono. Początkowy izolowany fixture wymagał rzeczywistych sheet-model/speed-max zależności. Pełnego CI nie uruchamiano. Fizyczny Pixel po wydaniu pozostaje do sprawdzenia; aktualnych danych telefonu nie dotykano.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Niezależny review zakończony i zaakceptowany: mobile screenshot, kod, closed schema, LOCAL-FIRST plan startowy, provenance/aliasy, afterCommit i zmieniona asercja Cancel. Wykonawca otrzymał sygnał na jeden końcowy commit/push; HEAD i CLEAN w przekazaniu. Brak nowego PR, Actions i publikacji.

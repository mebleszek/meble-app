# Jawny tryb czynności — 11.11.2026

Repo: mebleszek/meble-app. Gałąź: `fix/quote-final-corrections-20261111`. HEAD wejściowy: `77bbb3284247918dc24807eaf8bfdd3438489ae2`; BASE/main: `2968f7b952ed5a6b533aceede65cd0e2e2b6760a`.

## Reguła właściciela
- Każdy edytor czynności pokazuje jeden z trybów: RĘCZNA, AUTOMAT lub AUTOMAT FABRYCZNY.
- Automaty fabryczne mają zablokowany wybór trybu, ale ich parametry finansowe, czasowe i formuły nadal są edytowalne.
- Nowe czynności są domyślnie ręczne. Własny automat wymaga prawidłowego aktywnego źródła liczbowego; źródła specjalistyczne transportu i wnoszenia pozostają obsługiwane przez dotychczasowe ścieżki.
- Zakres standardowo/pomieszczenie/wycena/dzień nie decyduje o trybie. Fabryczne czynności dodatkowe, np. Ø60 i wcięcie pod rurę, pozostają ręczne.

## Implementacja
- `laborCatalog.isFactoryAutomaticDefinition()` korzysta wyłącznie z kanonicznych fabrycznych ID i reguł. Wpis `automationMode:'manual'` nie może zdegradować automatu fabrycznego.
- `laborCatalog.automationMode()` zwraca tryb do formularza. Własne rekordy zapisują jawny `automationMode`; tylko stare, nieoznaczone definicje nadal rozpoznają domyślny automat przez źródło w celu zachowania istniejącej semantyki.
- `wycena-core-labor` czyta jawny tryb w selekcji automatów. Oba ręczne selektory używają tej samej kwalifikacji. Walidacja formularza odrzuca brakujące/nieobsługiwane źródła, a także próbę usunięcia źródła automatu fabrycznego.
- Schemat `global-data-contract` akceptuje opcjonalne nowe pole dla domen robocizny bez jego domyślnego dopisywania do katalogów fabrycznych.
- Uaktualniono skrypty, wersje wejść i manifest offline; kodowy model fabrycznych norm/cen pozostaje identyczny.

## Kontrola i granice
- Scenariusze celowane: niezmienność fabryczności, edytowalna cena/formuła, źródła, tryby ręczne, scopes, brak zapisu niekompletnych automatów, zapis i ponowne otwarcie, schema chmury, brak podwójnego naliczania.
- Weryfikacja izolowanych rzeczywistych modułów Node bez środowiska urządzenia; pełne CI, Chromium, telefon i GitHub Pages niewykonane. Wynik lokalny nie upoważnia do wydania.
- Bez nowego PR, merge, Firebase LIVE, zmiany Rules, IAM, migracji danych, resetu telefonu lub zmian innych elementów UI.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.**

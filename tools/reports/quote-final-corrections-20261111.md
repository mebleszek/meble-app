# P0 — ostatnie poprawki WYCENY, 11.11.2026

Repo: `mebleszek/meble-app`. Gałąź: `fix/quote-final-corrections-20261111`. BASE/main potwierdzony fetch: `2968f7b952ed5a6b533aceede65cd0e2e2b6760a`. Jeden commit zawierający raport; pełne HEAD/BASE oraz potwierdzenie push/CLEAN w końcowym przekazaniu. Bez PR, wydania i uruchamiania pełnego CI.

## Potwierdzone FAIL na BASE

Nowy `tools/quote-final-corrections-smoke.js` przed zmianą produkcji: **0/6 PASS**. Odtworzono dostępność automatów w ręcznych selektorach, ręczne wyłączenie automatów, fallback 123 zamiast fixedPrice 0, pominięcie brakującej ilości/warunku i zapisanie wyniku mimo niekompletnej automatyki. Istniejące fixture i realne moduły, bez Firebase.

Nowy scenariusz Chromium, oparty na istniejącym izolowanym LOCAL-FIRST harness, na niezmienionym kodzie BASE: **FAIL `Manual price must hide markup`**. Przygotowanie używa wyłącznie syntetycznego, tymczasowego profilu; nie jest resetem danych telefonu.

## Cztery poprawki

1. Wspólne `laborCatalog.isAutomaticDefinition/isManualDefinition` kwalifikują powiązania źródeł, zakresy i tożsamości operacji, a nie `internalOnly`. Oba selektory oferują dodatki, w tym wewnętrzne Ø60/rury. Usunięto mechanizm ręcznego tłumienia automatów; stare przypisania pozostają nietknięte, ale nie są ponowną opłatą ani wyłącznikiem. Konflikty powielonych norm nadal są blokowane według istniejącej tożsamości operacji. Sama nazwa nie identyfikuje operacji. Nie dodano automatyzacji ani nowych reguł do niepowiązanych definicji.
2. Kalkulator i opis używają braku wartości zamiast truthiness przy fixedPrice. Ręczne pozycje fixed/advanced korzystają z tego samego kalkulatora także przy zerze. Pole `price` nie zastępuje jawnego `fixedPrice:0`.
3. Brak źródła, null, pusty tekst, NaN/ujemna ilość oraz nieznany warunek tworzą diagnostykę `automatic-blocked`. Potwierdzone zero i poprawnie niespełniony warunek są pomijane bez błędu; znany fałsz w AND rozstrzyga także przy innym nieznanym warunku. Puste, poprawnie zwrócone wyniki generatorów są odróżniane od braku/awarii generatora. Przed zbudowaniem nowego snapshotu WYCENA sprawdza wynik **po istniejącej filtracji usług i agregacji zakresów** i odmawia z `labor_automation_incomplete`. Oferta/historyczny snapshot nie są aktualizowane.
4. Formularz materiału ukrywa istniejący wrapper narzutu w trybie ręcznym. Zakup + narzut pokazuje go i liczy podgląd. Przełączenie nie nadpisuje wpisanej ceny ręcznej ani narzutu i nie zapisuje katalogu. Jawny Zapisz z istniejącym potwierdzeniem utrwala cenę przez dotychczasowy normalizer: 299 × 1,5 = 448,50; różnica +149,50.

**Zakresy:** źródła `transport.*` nie należą do źródeł per szafka. Transport i dojazd nadal obsługuje istniejąca ścieżka oferty i wspólny harmonogram. Nowa kontrola nie może błędnie oznaczać braku takich danych w każdej szafce ani dodawać wielokrotnych opłat. Nie zmieniano zakresów room/quote/day, wyboru usług, norm, mnożników, stawek i definicji materiałów.

## Kontrole celowane

Wykonawca: Codex, roboczy pakiet względem wskazanego BASE. Wyniki dotyczą tej implementacji; nie są pełnym CI.

- Nowe regresje Node: **9/9 PASS**, oba selektory, automat + Ø60 (+37,50 przy istniejącej stawce fixture), zachowanie automatów i starych przypisań, fixedPrice 0/fallback dla braku, typy brakującej ilości, warunki AND, poprawne zero generatorów i blokada przed zapisem nowego snapshotu z zachowaniem historii.
- Nowy Chromium: **PASS** widoczności i zachowania wartości w obu trybach; brak zapisu przy przełączaniu/Anuluj; 448,50 utrwalone dopiero przez potwierdzony Zapisz; prawdziwy LOCAL-FIRST i nowy snapshot odrzucony przy braku `leg.count`, natywna historia bez zmiany. Istniejąca kontrola abortu IDB w tym samym harness zachowuje formularz/RAM/RAW/cztery magazyny.
- Istniejące normy: **9/9 PASS**. Harmonogram/work-plan: **23 grupy PASS**. Materiały: **15/15 PASS**. PDF: **13/13 grup PASS**. Zestaw wszystkich uruchomionych skryptów jest poniżej.

Testy oczekujące zastąpienia automatów zmieniono na asercje niezmienionej automatycznej ilości/czasu/kosztu, braku drugiej opłaty i zachowanych danych przypisania. Zachowano i rozszerzono negatywy konfliktów. Fixture orkiestracji harmonogramu uzupełniono o istniejące moduły szuflad i wnoszenia oraz kontrakt błędu walidacji; brak zależności nie może już udawać potwierdzonego zera. Nie zmieniano produkcji dla nieaktualnego oczekiwania testu.

## Spójność i ograniczenia

Wersje zmienionych skryptów w obu wejściach, rejestr wersji i manifest integralności zaktualizowane razem. Artefakt `sync/code-global-catalogs.generated.mjs` ma odświeżoną proweniencję źródeł; porównanie JSON potwierdza **identyczne model i rules**, bez zmiany żadnej fabrycznej ceny/normy. To nie jest zmiana działania synchronizacji ani operacja na danych.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.** Fizyczny Pixel i pełne CI niewykonane. Nie modyfikowano Auth, writer-fence, CAS, synchronizacji, Firebase, aktualizatora, workflow ani innych elementów UI. Bez migracji/resetu, zapisu danych telefonu i przeliczania zamrożonych ofert. Starsze historyczne przypisania są zachowane w danych, ale nie przejmują już automatycznego naliczania przy tworzeniu **nowej** wyceny. Następny krok: niezależna kontrola diffu i dokładnych HEAD/BASE przez ChatGPT.

## Uruchomione skrypty

Polecenia `node tools/<nazwa>.js` (bez pełnego Preflightu). Nowe testy są automatycznie odkrywane przez obecny Preflight: kontrakt w grupie 4/7, Chromium w 5/7. Nie zmieniano workflow.

| Skrypt | Wynik |
|---|---|
| quote-final-corrections-smoke | 9/9 PASS |
| quote-final-material-browser-smoke | PASS, natywny Chromium/LOCAL-FIRST |
| wycena-labor-norms-smoke | 9/9 PASS |
| wycena-labor-pdf-smoke | 13/13 grup PASS |
| labor-work-plan-smoke | 23 grupy PASS |
| material-catalog-authority-smoke | 15/15 PASS |
| labor-appliance-separate-automats-smoke | PASS |
| labor-appliance-category-clean-rebase-smoke | PASS |
| labor-cabinet-single-accordion-dedupe-smoke | PASS |
| quote-labor-single-truth-smoke | PASS |
| quote-audit-material-quantities-fix-smoke | PASS |
| labor-readable-modes-accordion-smoke | PASS |
| labor-time-minutes-smoke | PASS |
| labor-quantity-values-link-smoke | PASS |
| labor-quantity-source-selector-smoke | PASS |
| labor-conditions-remove-auto-role-smoke | PASS, brak warunku to blokada, nie zwykłe pominięcie |
| wycena-labor-persistence-smoke | PASS |
| wycena-labor-compatibility-smoke | PASS |
| labor-audit-readable-lines-smoke | PASS |
| transport-settings-pricing-smoke | PASS |
| wycena-labor-ui-browser-smoke | PASS, rozmiary Android/Windows |
| quote-exact-calculations-smoke | 83 przypadki PASS |

W teście dokładnych obliczeń fixture samego widoku DOM uzupełniono o rzeczywisty generator szuflad, który dla tej szafki potwierdza pustą listę. Nie pominięto STOP ani walidacji widocznych równań; brak generatora ma osobną negatywną regresję w nowym teście.

Statycznie: składnia zmienionych JS/MJS, dokładne wersje obu wejść, load groups, aktualność manifestu i artefaktu katalogów, identyczność fabrycznego model/rules, odnośniki dokumentacji, diff whitespace i kryteria rozrostu modułów — PASS. Największy zmieniany moduł robocizny skrócił się z 1036 do 1006 linii; nie wykonano refaktoru za rozmiar.

Łącznie: **22 skrypty celowane PASS** (20 istniejących i 2 nowe). Nie nadano CI_PASS i nie uruchamiano pełnego CI.

## Dokładna lista plików

- `CURRENT_STATE.md`
- `dev_tests.html`
- `docs/agents/PRICING.md`
- `index.html`
- `js/app/cabinet/cabinet-modal-labor.js`
- `js/app/material/price-modal-item-form.js`
- `js/app/pricing/labor-catalog.js`
- `js/app/pricing/work-quantity-facts.js`
- `js/app/wycena/wycena-core-labor.js`
- `js/app/wycena/wycena-core-offer.js`
- `js/app/wycena/wycena-core.js`
- `js/app/wycena/wycena-labor-picker.js`
- `js/app/wycena/wycena-tab-manual-labor.js`
- `offline-assets.js`
- `sync/code-global-catalogs.generated.mjs`
- `tools/android-local-first-browser-smoke.js`
- `tools/helpers/material-catalog-browser.js`
- `tools/labor-conditions-remove-auto-role-smoke.js`
- `tools/labor-work-plan-smoke.js`
- `tools/quote-exact-calculations-smoke.js`
- `tools/script-versions.js`
- `tools/wycena-labor-norms-smoke.js`
- `tools/wycena-labor-pdf-smoke.js`
- `tools/helpers/quote-final-material-browser.js`
- `tools/quote-final-corrections-smoke.js`
- `tools/quote-final-material-browser-smoke.js`
- `tools/reports/quote-final-corrections-20261111.md`

## Korekta QA P0 — 11.11.2026

Kontynuacja wyłącznie na `fix/quote-final-corrections-20261111`. Zweryfikowany wejściowy HEAD: `f174cfa748fa62e799c24369d71e246da775f55f`; BASE/main nadal `2968f7b952ed5a6b533aceede65cd0e2e2b6760a`. Jeden dodatkowy commit; jego SHA/push/CLEAN w końcowym przekazaniu. Wcześniejsze wyniki powyżej dotyczą poprzedniego pakietu i nie oznaczają ponownego wykonania pełnych zestawów.

**FAIL przed zmianą produkcji:** `node tools/quote-qa-p0-smoke.js` dał **3/6 PASS**: advanced bez fixedPrice z price 100 dawał 0 zamiast 100, również przy tworzeniu/zapisie definicji przez formularz. Jawne zero i pozostałe sprawdzane tryby już przechodziły. Rozszerzony `quote-final-material-browser-smoke` dał **FAIL `Inactive manual price must be hidden in markup mode`**. Oba pliki produkcyjne były wówczas identyczne z wejściowym HEAD.

**Minimalny diff produkcji:**

- `labor-catalog.js`: jeden warunek normalizera rozszerzony o advanced; brak/null fixedPrice dziedziczy price. Jawne fixedPrice 0 zachowuje pierwszeństwo. Bez zmian pozostałych formuł/norm.
- `price-modal-item-form.js`: istniejący wrapper ręcznej ceny jest ukrywany w narzucie i pokazywany po powrocie; wartość inputu i podgląd nie są zmieniane. Getter zapisu advanced zachowuje istniejące jawne fixedPrice, w tym zero, zamiast gubić je w payloadzie formularza. Bez nowego pola ani automatycznego zapisu.

**Po poprawce:**

| Kontrola | Wynik |
|---|---|
| `node tools/quote-qa-p0-smoke.js` | **6/6 PASS**: brak/null i idempotencja normalizacji; jawne zero; rzeczywiste getCurrentServiceDraft → saveServiceFromForm dla nowej/legacy/zerowej definicji; stałe, jednostkowe, start+jednostka i czasowe formuły oraz ilość 0 |
| `node tools/quote-final-material-browser-smoke.js` | **PASS**: ręczna cena widoczna w manual, ukryta w markup, podgląd nadal widoczny; 448,50 i dodatnia różnica 149,50; powrót przywraca 500 oraz narzut 50; przełączanie/Anuluj bez zapisu. Istniejąca kontrola jawnego Save i odmowy nowej wyceny także PASS |
| `node tools/labor-time-minutes-smoke.js` | PASS |
| `node tools/wycena-labor-persistence-smoke.js` | PASS: formularz, Save/Cancel, odczyt, backup i zamrożona historia |
| Składnia, wersje obu wejść, manifest, load groups, spójność artefaktu, odnośnik i diff | PASS |

Wersje zmieniono tylko dla dwóch skryptów. Manifest i kodowy artefakt katalogów odświeżono z powodu hasha źródła normalizera; porównanie pełnego JSON **model/rules identyczne z wejściowym HEAD**. Nie zmieniono definicji katalogów, działania synchronizacji, Firebase, innych automatów ani danych użytkownika. Nie migrowano utrwalonych zer: obecne jawne zero pozostaje zerem; poprawka nie zgaduje jego pochodzenia.

Zakres plików tej korekty: dwa powyższe moduły; `index.html`, `dev_tests.html`, `tools/script-versions.js`, `offline-assets.js`, hash/proweniencja `sync/code-global-catalogs.generated.mjs`; nowy `tools/quote-qa-p0-smoke.js`, rozszerzony `tools/helpers/quote-final-material-browser.js`; CURRENT_STATE i ten raport. Nowy smoke jest automatycznie odkrywany przez istniejący Preflight. Workflow bez zmian.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.** Bez pełnego CI, PR, merge i wydania. Następny krok: niezależna kontrola nowego HEAD i diffu QA przez ChatGPT.

## Dodatkowa korekta QA — 11.11.2026, wykonana przez ChatGPT

BASE/main `2968f7b952ed5a6b533aceede65cd0e2e2b6760a`, wejściowy HEAD `fbaf5f3ea50b6377a93ad6241716d8062d73f5d6`. Odtworzono gubienie jawnej zerowej kwoty w trybie fixed przy ponownym zapisie oraz błędne uznawanie ręcznych zakresów room/quote/day za automaty.

Minimalne zmiany: kwalifikacja auto przez rzeczywiste powiązania i fabryczną definicję (zachowano systemową przerwę, transport i montaż); w fixed i advanced formularz pokazuje faktyczny fixedPrice, jeśli istnieje, a zapis traktuje aktualnie edytowane pole jako wartość źródłową. Wykaz testów regresyjnych rozszerzono o scope, zero i zmianę ceny 0→75 zł.

Weryfikacja izolowanych rzeczywistych modułów JavaScript i sprawdzenie spójności SHA256 wygenerowanych plików wykonane poza Codexem. Pełny Node/Chromium/CI nieuruchomiony. Żadnego PR, wydania, migracji ani Firebase LIVE.

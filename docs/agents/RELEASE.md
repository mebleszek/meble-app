# PR, CI, wydanie i przekazanie

Szczegóły obowiązujących zasad z [AGENTS.md](../../AGENTS.md); dokument jest jego częścią, nie osobnym źródłem zgód. Numeracja § odsyła do AGENTS.md. Czytaj tylko przy pracy objętej poniższym zakresem. Przeniesione procedury zachowują daty decyzji.

## 12. PR, CI i scalanie — zatwierdzona procedura (2026-10-15)

Ta sekcja jest obowiązująca również **na początku nowych wątków**. W razie rozbieżności ze starszymi raportami lub planami o Draft PR decyduje aktualna procedura i rzeczywisty plik `.github/workflows/preflight-js.yml`.

- **Nie twórz Draft PR jako domyślnego etapu.** Po ukończeniu i przeglądzie zmiany, jeżeli użytkownik wyraźnie zatwierdził próbę scalenia/wydania, utwórz PR od razu jako **Ready** (bez zbędnego Draft). Samo zlecenie kodowania **„do dzieła”** nie jest automatycznie zgodą na Ready, auto-merge ani publikację — sprawdź zakres zgody.
- Jeżeli nie ma jeszcze zgody na scalenie, pozostań przy gałęzi roboczej; Draft PR dopuszczalny tylko wtedy, gdy rzeczywiście jest potrzebny do przeglądu i użytkownik go chce. Jeśli zaakceptowany PR już jest Draft, wystarczy przełączyć go na Ready; nie twórz duplikatu.
- **Stały wyjątek operacyjny — PR Ready obsługuje ChatGPT (2026-10-21).** Po **każdorazowej, osobnej zgodzie właściciela** na konkretną próbę wydania (repozytorium, gałąź, dokładne HEAD i BASE SHA oraz zakres), ChatGPT może samodzielnie utworzyć **jeden PR bezpośrednio jako Ready** przez połączony GitHub, aby ograniczyć zużycie limitu Codexa. Przed operacją odczytowo weryfikuje wskazane SHA, diff, wymagane pokrycie CI i brak istniejącego PR; zmiana któregokolwiek warunku oznacza STOP i potrzebę nowej zgody. Po utworzeniu PR ChatGPT wyłącznie odczytowo obserwuje wyniki CI, automatyczny merge i Pages. **Nie** zmienia w tym trybie plików, commitów, gałęzi, workflow ani testów, **nie** scala ręcznie, nie ponawia prób i nie wykonuje żadnych operacji Firebase LIVE. Samo to upoważnienie **nie jest** zgodą na żadne konkretne wydanie. Jeżeli bezpośrednia obsługa PR przez ChatGPT jest niedostępna, Codex albo właściciel może wykonać tę samą operację wyłącznie po uzgodnieniu wykonawcy, nadal z osobną zgodą na wydanie.
- **Jedno pełne uruchomienie Preflight w GitHub Actions na zatwierdzoną próbę:** zdarzenie `opened` dla niedraftowego PR lub `ready_for_review` przy przejściu Draft → Ready. Utworzenie Draft, samo wypchnięcie commita (`synchronize`), merge do `main` ani zwykły push nie uruchamiają ponownego pełnego Preflightu wydaniowego. Odrębne, izolowane workflow mogą reagować na push wyłącznie na wskazane w nich gałęzie. Codex nie dubluje lokalnie testów CI (AGENTS.md §3); bez zatwierdzonej próby pakiet pozostaje `CODE_READY` / `CI_PENDING`.
- Przed Ready sprawdź faktyczne pokrycie wymaganych testów dla zatwierdzonego HEAD/BASE. Jeżeli brakuje zadania wysokiego ryzyka, przygotuj właściwą kontrolę CI w uzgodnionym zakresie przed próbą wydania; nie zastępuj jej deklaracją ani PASS innej gałęzi. Ręczny `workflow_dispatch` nie stanowi obejścia zgody ani powodu do ponownego pełnego CI.
- Workflow po zielonym Preflight **automatycznie scala** PR, wyłącznie jeśli `head SHA` i `base SHA` są identyczne ze stanem zatwierdzonej próby. Błąd testów, zmiana którejkolwiek gałęzi lub cofnięcie do Draft blokują merge. Nie wykonuj drugiego, ręcznego merge „dla pewności” i nie omijaj zabezpieczeń.
- Po merge workflow sprawdza GitHub Pages **dla dokładnego merge SHA** bez kolejnego pełnego Preflightu. Rozróżniaj: PR scalony, CI PASS i Pages PASS; nie deklaruj wdrożenia jako gotowego, jeśli Pages nie zostało potwierdzone.
- Każda zmiana `head SHA`, ponowienie po FAIL oraz nowa próba wdrożenia wymagają nowej świadomej zgody użytkownika. Nie uruchamiaj ukrytego auto-merge z samego commita lub automatycznego ponowienia.
- Każdy nowy wątek dotyczący Meble-App powinien przed proponowaniem Ready/merge sprawdzić aktualne `AGENTS.md`, `CURRENT_STATE.md`, dokumenty decyzji i faktyczny workflow. Starsze zasady „obowiązkowy Draft PR” nie są już aktualne. Pozostałe zasady ochrony danych, UI oraz planowania zmian pozostają w mocy.

## 16. Wydania: aktualizacja klienta, monolity, równoległe CI — decyzja 31.10.2026

**Wersja widoczna u użytkownika jest obowiązkową częścią wydania, niezależną od PASS GitHub Pages.** Przy zmianie aplikacji aktualizuj spójnie wersje zasobów `?v=`, manifest offline i powiązane sumy integralności; nie wystarczy sam merge. Mechanizm aktualizacji ma wykrywać dostępne wydanie, pokazywać użytkownikowi komunikat **„Dostępna nowa wersja — odśwież”** i bezpiecznie przeprowadzać stary Service Worker do nowej wersji bez utraty danych. Nie wolno wymuszać przeładowania podczas niezapisanego formularza, aktywnej edycji lub niepotwierdzonego zapisu offline. Usuwanie starych zasobów dopiero po dowodzie, że nie kontrolują już aktywnej sesji. Żadnego czyszczenia IndexedDB, localStorage inwestorów/projektów/cenników, resetów urządzenia ani ukrytych migracji. Wymagana regresja real Chromium: **stary worker i dane tego samego profilu → nowy deploy → wykrycie wersji → bezpieczna aktualizacja → widoczna nowa funkcja + zachowane dane**. Ten kontrakt jest obowiązujący; jego pełna automatyzacja w produkcie wymaga oddzielnej implementacji i testu, nie wolno udawać, że sam cache-busting już go spełnia.

**Kontrola rozrostu kodu i odpowiedzialności:** bazą są istniejące progi z `tools/dependency-audit-lib/scan-dependencies.js`: **250+ linii = ostrożność, 400+ = ostrzeżenie/analiza, 600+ = wysoki koszt ryzyka i konieczność uzasadnienia przed rozbudową**. Nie mieszać w jednym nowym module renderowania/UI, bezpośredniego storage, domeny, recovery i orkiestracji. Przekroczenie progu 600 linii przez nowy moduł produkcyjny lub rozrost starego modułu 600+ z mieszaną odpowiedzialnością jest blokowane przez kontrolę przyrostu, zamiast blokowania istniejącego kodu tylko za jego rozmiar. Wyjątki wymagają uprzedniej, osobnej decyzji właściciela oraz kontraktu regresji; sam wzrost liczby linii nie usprawiedliwia automatycznego refaktoru. Kontrola obejmuje też raportowanie rozrostu kodu testowego. Nie dokładać funkcji do monolitu wyłącznie dlatego, że łatwiej ją tam umieścić.

**Budżet wydajności GitHub CI:** target **90 s wykonywania każdej grupy testów**; po **75 s** i **90 s** pokazywać czytelne ostrzeżenie z prośbą o ocenę/optymalizację. **Przekroczenie czasu nigdy samo nie daje FAIL, nie przerywa testu ani nie unieważnia PASS.** Realne FAIL to błąd testu, integralności, niepełne pokrycie, niepotwierdzona grupa albo brak wymaganych zabezpieczeń. Czas uruchomienia runnera, instalacji zależności, scalenia i Pages mierzyć i raportować osobno od czasu samych testów; nie obiecywać 90 s całego wydania.

**Wszystkie długie testy uruchamiać równolegle tam, gdzie są niezależne:** Preflight ma siedem deterministycznych grup smoke z izolacją przeglądarek, kontrole statyczne osobno; Firebase Current zachowuje trzy odrębne procesy DEMO emulatora `[5,1,2]`, ale startują równolegle; historyczny smoke i SDK to osobne zadania. Każdy test i plik SDK musi należeć do dokładnie jednej obowiązkowej grupy, również po dodaniu nowych testów. Brak grupy, pominięcie/skipped, failed, niekompletne TAP, zmieniony HEAD/BASE, 425 pinów, naruszenie immutability historycznej lub błąd ochrony danych = **RELEASE_BLOCKED**. `ci-summary` i auto-merge uwzględniają pełne zestawy, nigdy tylko najszybszy shard. Bez automatycznych retry, bez omijania testów; kalkulować również koszt większej liczby runnerów. Zmiany workflow nie uruchamiają ani ponawiają CI bez osobnej zgody właściciela na konkretne HEAD/BASE.

**Rozdział wykonania i zgód:** te zasady są trwałe we wszystkich kolejnych wątkach; ChatGPT kontroluje ich przestrzeganie niezależnie od pamięci konwersacji. Standardowo programuje Codex, ale po **odrębnej, wyraźnej zgodzie na określony zakres** ChatGPT może wyjątkowo implementować kod i zapisać osobną gałąź/commit; nie daje to domyślnej zgody na PR Ready, CI, merge, Pages, migrację lub Firebase LIVE.

## 20. Stały protokół przekazania do wydania — decyzja właściciela 03.11.2026

Po zakończeniu każdego zatwierdzonego zadania Codex:

1. Kończy implementację, wykonuje wymagane testy celowane i aktualizuje `CURRENT_STATE.md` oraz właściwy istniejący raport. Nie dubluje pełnego CI (AGENTS.md §3).
2. Wykonuje commit i push na gałąź roboczą oraz potwierdza czyste drzewo.
3. Bezpośrednio przed przekazaniem sprawdza aktualny GitHub: dokładny HEAD gałęzi roboczej oraz BASE docelowego `main`. Podaje pełne SHA 40 znaków potwierdzone zdalnie; nie używa nieaktualnych SHA z pamięci lub dokumentacji.
4. Przekazuje krótki raport gotowy do skopiowania do ChatGPT, według wzoru poniżej. Wyniki dotyczą faktycznie wykonanych kontroli; wcześniejszy PASS oznacza wraz z jego SHA i nie przypisuje go automatycznie do nowego HEAD (AGENTS.md §10). Dla zmian wyłącznie dokumentacyjnych wystarcza właściwa kontrola diffu; nie ponawia testów aplikacji bez nowej przyczyny.
5. Nie tworzy PR, nie uruchamia GitHub Actions, nie scala ani nie publikuje samodzielnie i nie wykonuje Firebase LIVE. Wydanie obsługuje ChatGPT: niezależnie kontroluje pakiet, po osobnej zgodzie właściciela na dokładny HEAD/BASE tworzy jeden PR Ready i odczytowo obserwuje CI, auto-merge oraz GitHub Pages (AGENTS.md §12). Awaryjne zastępstwo wykonawcy wymaga osobnego uzgodnienia; nie jest domyślną częścią implementacji.

Jeżeli zadanie jest niedokończone albo wymagane testy nie przeszły, raportuj **BLOCKED**, wskaż konkretną przyczynę i nie przedstawiaj pakietu jako gotowego do wydania. `CODE_READY / CI_PENDING / RELEASE_BLOCKED` oznacza gotowość do kontroli pakietu; nie jest zgodą ani dowodem wydania. Każda późniejsza zmiana HEAD/BASE wymaga nowego przekazania i osobnej zgody wydaniowej.

Obowiązkowy format przekazania (pola w nawiasach zastąpić faktami):

```text
MEBLE-APP — PAKIET DO WYDANIA

Repo: mebleszek/meble-app
Gałąź: [nazwa]
HEAD: [pełny SHA 40 znaków]
BASE/main: [pełny SHA 40 znaków]

Status: CODE_READY / CI_PENDING / RELEASE_BLOCKED

Zmiany:
[2–4 zdania, co faktycznie zrobiono]

Testy:
[nazwy i rzeczywiste wyniki PASS/FAIL; BLOCKED, jeśli wymaganej kontroli celowanej nie wykonano]

Ograniczenia:
[co nadal nie działa, co jest zablokowane]

Drzewo robocze: CLEAN
Commit i push: POTWIERDZONE

Przekazanie: Pakiet gotowy do kontroli wydania przez ChatGPT. Wymagana osobna zgoda właściciela na dokładny HEAD/BASE.
```

Dla pakietu zablokowanego zastąp status i zdanie „Przekazanie” jednoznacznym **BLOCKED** z przyczyną; nie deklaruj CLEAN/push, jeżeli nie zostały faktycznie potwierdzone.

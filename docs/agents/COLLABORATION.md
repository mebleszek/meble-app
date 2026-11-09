# Współpraca, wznowienie wątku i dziennik

Część obowiązującego [AGENTS.md](../../AGENTS.md), szczegóły §13–15 i §18–19. Nie tworzy osobnej zgody ani konkurencyjnego statusu. Konsoliduje decyzje 17/24/30/31.10 oraz 01/02/03.11.2026; aktualny stan wykonania jest wyłącznie w [CURRENT_STATE.md](../../CURRENT_STATE.md).

## Prowadzenie i rekomendacje

ChatGPT GPT-6 High odpowiada za analizę, architekturę i prowadzenie Meble-App oraz niezależne doradztwo biznesowe dla marki MebLeszek: koszty, korzyści, rentowność, priorytety, ryzyko i wartość firmy. Konstruktywnie kwestionuje nietrafne, nieopłacalne lub nadmiernie skomplikowane pomysły, rekomenduje rozwiązanie zamiast bezrefleksyjnego potwierdzania. To kontrakt prowadzenia projektu, nie osobistego stylu rozmowy.

Na „co dalej?” rekomenduje jeden największy sensowny, bezpieczny i testowalny pakiet, biorąc pod uwagę wcześniejszą pracę i rzeczywisty main. Wskazuje rezultat biznesowy, obszary kodu/danych, ryzyko, testy, warunek STOP i osobne zgody. Alternatywy przedstawia tylko gdy zmieniają koszt, bezpieczeństwo lub funkcjonalność; nie oddaje właścicielowi wyboru nazw funkcji, plików, flag ani technicznych wariantów bez skutków biznesowych. Nie obiecuje terminu bez podstaw.

Przed większą pracą krótko rekomenduje tryb Chat/Work/Codex, model i poziom rozumowania. Work służy szczególnie złożonym analizom przekrojowym wielu plików/aplikacji/systemów, tylko przy rzeczywistej korzyści; nie uruchamia Work/Codexa wyłącznie do produkowania planów. ChatGPT przygotowuje jeden kompletny prompt dla Codexa Sol High: zakres, decyzje, testy i zgody; użytkownik przekazuje raport, ChatGPT niezależnie go kontroluje. Nie pyta ponownie, czy właściciel ma Codexa albo chce prompt. Standardowo nie przejmuje programowania; wyjątek wymaga odrębnej wyraźnej zgody na konkretny zakres. Stały wyjątek PR Ready podlega AGENTS.md §12.

## Jeden pakiet i granice

Najpierw plan i „do dzieła” dla całego uzgodnionego zakresu; potem wykonanie do wyniku lub obiektywnego blokera bez pytań przy każdym pliku, teście, drobnej poprawce i dokumentacji w tym zakresie. Nie przygotowuj kolejnych promptów na prace już objęte zgodą. Checkpointy i iteracje naprawcze mogą być wewnętrzne; preferuj jedną gałąź, zrozumiały raport i jedną świadomie zatwierdzoną próbę wydaniową. Nie prowadź równoległych zmian tego samego pliku. Dla dokumentacji też ogranicz odrębne gałęzie/PR, aktualizuj powiązane statusy w dozwolonym pakiecie.

STOP/decyzja są potrzebne dla wyjścia poza zakres, brakującej reguły biznesowej, konfliktu kontraktu, nieoczekiwanej utraty danych/ryzyka bezpieczeństwa, FAIL bez uzgodnionej naprawy lub osobnej zgody produkcyjnej. Wykryta luka nie oznacza automatycznego zadania: przedstaw dowód, wpływ i rekomendację; właściciel decyduje o nowych pracach/dodatkowych zabezpieczeniach. Powiązaną przyczynę niezbędną dla zatwierdzonego celu naprawiaj w jego granicach (AGENTS.md §2). STOP nie upoważnia do dodania mechanizmu naprawczego.

Przygotowanie transportu, Rules na emulatorach, syntetycznego uploadu i odczytu może być jednym pakietem; publikacja Rules i pierwszy prawdziwy zapis Firestore pozostają odrębnymi decyzjami produkcyjnymi. Zgoda implementacyjna nie obejmuje Ready/auto-merge/Pages, uploadu/migracji, grantów/konta, resetu, sekretów, billingu ani innych działań produkcyjnych. Test syntetyczny nie zastępuje zatwierdzenia rzeczywistych danych; Chromium nie zastępuje akceptacji telefonu.

## Start, narzędzia i krótka komunikacja

Nowy ChatGPT po uzyskaniu dostępu odczytuje AGENTS i aktywne CURRENT_STATE 1–5, sprawdza faktyczny main, odpowiednie PR/CI/Pages, HEAD/BASE i istotne ustalenia/raporty. Nie wczytuje instrukcji automatycznie; właściciel nie musi ich ponownie tłumaczyć. GitHub rozstrzyga przestarzałą migawkę MD. Nie odczytuj ponownie całych archiwów ani zakończonych audytów bez nowej sprzeczności/ryzyka. Korzystaj z aktualnych ustaleń.

Raport Codexa porównaj z repo i rzeczywistym PASS/FAIL/BLOCKED; zleć następną konkretną dozwoloną kontrolę, jeśli plan i brakujące warunki już istnieją, zamiast nowego planu/audytu. Brak dostępu nie jest negatywnym wynikiem ani wykonanym Preflightem. Nie powtarzaj zaliczonych testów; dodatkowa kontrola ma wskazywać lukę, np. telefon, niezależny odczyt Firebase albo prywatny artefakt niedostępny w CI, w granicach roli i zgody.

Rozróżniaj plan, jednorazowy odczyt, implementację, wydanie dla dokładnego HEAD/BASE i LIVE WRITE. Nie ponawiaj udzielonej zgody na ten sam odczyt: wykonaj go legalnie uwierzytelnionym sposobem. Przy braku dostępu podaj BLOCKED i jedno praktyczne odblokowanie, bez obchodzenia zabezpieczeń. Najpierw sprawdź dostępne połączenia/metody Codexa; wtyczka Firebase dla Codexa nie jest automatycznie narzędziem ChatGPT ani wymogiem produktu. Nie kieruj właściciela bez potrzeby do ustawień Androida/ChatGPT lub instalacji wtyczek, nie deklaruj uprawnień bez dowodu i nie proś o tokeny, sekrety ani klucze w rozmowie. Wymagane działanie właściciela przedstaw jako jedną dokładną czynność.

Raportuj krótko: ustalone / rzeczywiście wykonane i zweryfikowane / blokery / jeden następny ruch, z linkami. Nie zasypuj logami i kopiami historii. Prompt/materiał do wklejenia podaj w jednym kompletnym bloku. Gdy kontekst rośnie lub grozi pomyłka, przygotuj oparte na GitHubie krótkie przekazanie według AGENTS.md §18 i §20; właściciel nie rekonstruuje historii ręcznie. Drugi uzgodniony Codex otrzymuje zakres i diff, bez całej historii i ponownego audytu.

## Aktualizacja kanonicznego dziennika

CURRENT_STATE jest jedynym rejestrem wykonania. ROADMAP opisuje przyszły plan, nie duplikat aktualnego statusu. Po faktycznie wykonanym, zatwierdzonym kroku Codex w tym samym pakiecie aktualizuje aktywne sekcje: data, cel/zakres, gałąź, BASE/HEAD gdy dostępny, rzeczywisty wynik, dokładne linki PR/run/Pages/raport, blokery i jeden następny ruch. Szczegółowe dowody są w istniejącym raporcie. Przy zastąpieniu stanu archiwizuj pełny stary zapis, bez utraty dat, SHA, decyzji, norm, historycznych ofert i dowodów. Nie doklejaj długich „aktualnych stanów” ponad poprzednimi.

Istotne decyzje biznesowe/techniczne (zaakceptowane, odłożone, odrzucone) utrwalaj z datą, granicami zgody i odrębnym stanem wdrożenia w odpowiednim istniejącym MD, w najbliższym zatwierdzonym pakiecie. ChatGPT pilnuje zgodności, Codex zapisuje w zakresie zgody. Bez konkurencyjnych STATUS/PROGRESS/rejestrów ani osobnych PR na każdą decyzję. Uzgodnienie w rozmowie samo nie zezwala na zapis do GitHuba.

Dokumentacja też wymaga zatwierdzonego zakresu. Obserwując PR/CI odczytowo, nie zmieniaj GitHuba, nie dopisuj commitów i nie pushuj do main w celu dogonienia statusu. Późniejsze CI/merge/Pages utrwalaj w następnym osobno zatwierdzonym pakiecie lub następnym dozwolonym zakresie. Rozbieżność (np. MD CI_PENDING, GitHub RELEASED) najpierw zweryfikuj dla konkretnego PR/SHA, zgłoś i skoryguj po zgodzie; nie przedstawiaj starego statusu jako aktualnego. Brak poświadczenia/blokada = BLOCKED z luką, bez automatycznego retry lub zgadywania PASS. Dziennik nie udziela zgód na wydanie/LIVE.

## Mapa dokumentów

- [README](../../README.md) — wejście; [DEV](../../DEV.md) — workflow; [CURRENT_STATE](../../CURRENT_STATE.md) — aktualny stan; [ROADMAP](../../ROADMAP.md) — przyszły plan.
- [CLOUD_MIGRATION](../../CLOUD_MIGRATION.md), [CLOUD_DATA_REGISTER](../../CLOUD_DATA_REGISTER.md), [BACKUP](../../BACKUP.md), [QUOTE_CALCULATION_REGISTER](../../QUOTE_CALCULATION_REGISTER.md) — kontrakty.
- [TEST_BASELINE](../../TEST_BASELINE.md), [DEPENDENCY_MAP](../../DEPENDENCY_MAP.md), [PREFLIGHT](../../PREFLIGHT.md) — testy i zależności.
- [tools/reports](../../tools/reports) i [docs/archive](../archive) — historia i dowody. Plików nie usuwaj bez osobnej zgody; kandydaci w [MD_CLEANUP_AUDIT](../../MD_CLEANUP_AUDIT.md).

README, DEV i starsze materiały mogą zawierać historię. Przy sprzeczności nie zgaduj: sprawdź kod/testy, CURRENT_STATE i bieżące ustalenia; nadal niejednoznaczne = decyzja właściciela.

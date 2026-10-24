# SESSION-QUOTA + EXACT-CALCULATIONS — 24.10.2026

Gałąź `fix/session-quota-exact-calculations-20261024`, worktree `/workspace/session-quota-exact`. BASE/main zweryfikowany na GitHubie: `e37502125dd846ae883f65e013ecdf0489dc500f`, tree `09a4e6b76d2b9a029b5aeea1162b476cac365bc8`. Potwierdzono przodka `58f10a01a44b9d35a063d5f9e13290ff56d8cac7`, istniejące gałęzie i odrębne worktree; nie nadpisywano równoległych prac. PR #79 został wydany według potwierdzenia właściciela. Końcowe HEAD i push są podane w raporcie przekazania, bez próby zapisania własnego SHA w tym pliku.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Nie uruchomiono pełnego Preflightu, Chromium, SDK/Rules, nowego PR, Ready, merge, Pages ani Firebase LIVE.

## A. Quota — co wiadomo

Raport telefonu potwierdza czytelność obserwowanych kluczy oraz kod ostatniej odmowy `SESSION_QUOTA_EXCEEDED`; nie podaje zajętości profilu, limitu ani kosztu aktualizacji klucza. `ram:true` oznacza obecność obiektu sesji, nie niezapisaną edycję. `active` dotyczy zapisanego payloadu, więc przy `present:false` nie ustala aktywności sesji RAM. Brak payloadu nie dowodzi utraty projektu. Nie odczytano prywatnej pamięci telefonu i nie odzyskano jego sesji.

Wcześniejsze rozwiązania są już w bazie: pełny rekord właściciela zamiast całego magazynu projektów, brak zbędnego zapisu niezmienionego wskaźnika, kody odmowy i ograniczone ponowienie pierwszego begin. Nie wdrażano ich ponownie i nie zmieniono `session.js`, Zapisz/Anuluj, rewizji lub recovery.

Pozostałe mechanizmy rozdzielono:

| Mechanizm | Dowód / granica |
|---|---|
| Wiele projektów powiększa magazyn, lecz nie nowy snapshot innych właścicieli | Rzeczywiste moduły i strukturalne porównanie pełnego rekordu właściciela na danych syntetycznych |
| Duży pojedynczy właściciel/pokój może nadal wymagać zbyt dużego payloadu | Warunkowy budżet liczby jednostek UTF-16 odtwarza QuotaExceededError; dowód i wszystkie RAW zachowane |
| Suma projektów, katalogów, historii i backupów może wypełnić magazyn mimo ograniczonej sesji | Model rzeczywistego sumowania kluczy i wartości, bez mocka stale zwracającego odmowę |
| Aktualizacja istniejącego klucza może wymagać dodatkowej przestrzeni tymczasowej | Osobny model szczytowego kosztu wykazuje zachowanie blokady po utracie ACK. Nie ustalono, że konkretny Chrome tak rozliczył zapis na telefonie |
| Powrót z innej karty / ponowny start dokumentu | Samo przejście nie dowodzi przyczyny quota. Restart może uruchomić istniejący nowy begin; nie jest dowodem utraty danych ani zgody na przyjęcie RAM |
| Nieudany pierwszy begin | W tym samym dokumencie ponowienie wymaga oryginalnego, niezmienionego baseline; nowsza rewizja odmawia. Po restarcie brakujący payload nie przywraca utraconego RAM ani znacznika pierwszej próby |
| C=B, C=E, C≠B/E | Zachowano istniejącą walidację; obca/nowsza niepotwierdzona rewizja nie jest nadpisywana |

Nie potwierdzono nowego błędu protokołu sesji, który można bezpiecznie naprawić przez automatyczne odzyskanie miejsca. **W tym pakiecie dodano diagnostykę, nie kolejne zmniejszanie/przepisywanie snapshotu.** Znane ograniczenie zajętości nadal zapewnia wcześniejszy owner-only begin. Pełna pamięć i zbyt duży właściciel mogą nadal blokować edycję.

## Odczytowa diagnostyka

Istniejący ekran wywołuje wspólny kolektor z opcją `storageUsage:true`. Auth/origin gate obowiązuje przed odczytem, podczas skanu i przed zwrotem raportu. Raport ma wyłącznie stałe kategorie i liczby: sesja, projekty, inwestorzy, katalogi/cenniki, historia ofert, kopie bezpieczeństwa i pozostałe; ponadto liczby rekordów, największy rekord projektu/wartość, rozmiar bieżącego rekordu, zapisany payload i szacunek payloadu aktywnej sesji RAM.

Suma obejmuje długości kluczy i wartości w jednostkach UTF-16, UI pokazuje oszacowanie ~2 bajty/jednostkę. To rozmiar tekstu, nie pomiar faktycznej quota, dostępnego miejsca ani rozmiaru IndexedDB. Szacowany przyrost przy zastąpieniu payloadu również nie dowodzi dostępnej przestrzeni; tymczasowy koszt zapisu pozostaje nieznany. `navigator.storage.estimate()` nie jest wywoływane. Skan ma granice 2000 kluczy / 8 Mi jednostek; brak kompletności odmawia pomiaru, bez fałszywego wyniku.

Kolektor nie wywołuje setItem/removeItem/clear, begin, save, cancel ani recovery. Nie tworzy wpisów, nie wysyła danych, nie zmienia storage ani uprawnień. Nazwy kluczy, nazwy/ID rekordów, dane i treści wyjątków nie trafiają do raportu. Zmiana obserwowanych danych lub wygaśnięcie Auth odmawia zwrotu pomiaru. Tryb dotychczasowego odczytu pozostaje zgodny; wygenerowany bookmarklet zsynchronizowano ze wspólnym kolektorem, bez zalecania go właścicielowi jako procedury odzyskania.

## B. Dokładne opisy WYCENY

Usunięto zaokrąglanie operandów czasu `round2(timeBlockHours)` z budowy opisów. Cały nowy wzór przechodzi kontrolę zgodności z istniejącą kwotą do grosza. Minuty, mnożniki, przygotowanie/kroki/progi, rzeczywista objętość i stawki pozostają widoczne. Jeśli nie można odtworzyć wzoru z danych pozycji, pokazujemy brak kompletnego rozbicia oraz kwotę źródłową. Nie wymyślamy normy lub stawki.

Potwierdzono dawny błąd: tekst pakowania dawał `2 × 0.08 h × 150 = 24`, przy prawidłowo zapisanych 25 zł. Nowy zapis:

- 2 × 5 min × 150 zł/h ÷ 60 = **25,00 zł**;
- (2 + 4) × 1 min × 250 zł/h ÷ 60 = **25,00 zł**;
- 4 × 1 min × 150 zł/h ÷ 60 = **10,00 zł**;
- (5 + 2 × 1) min × 250 zł/h ÷ 60 = **29,17 zł**;
- (60 min + 0,20352 m³ × 15 min/m³) × 150 zł/h ÷ 60 = **157,63 zł**.

Jawne syntetyczne kontrole, przy dwóch frontach i czterech zawiasach: moduł 60×82×50 cm z jedną półką → **352,50 zł**; standardowa wisząca HDF 60×106×32 cm z dwiema półkami → **421,80 zł**. Wyniki porównano z kodem BASE bez zmian norm. To odtwarzalne kontrole zgodnych kwot, nie odczyt parametrów prywatnego projektu z telefonu.

Kontrola obejmuje również ręczne pozycje ofertowe, projekt, wnoszenie, transport, materiały, okucia, usługi, rabat i sumy. Opisy metrów PCV/powierzchni nie udają równań z operandami uciętymi do trzech miejsc; nie zmieniono obliczeń PCV. Długie działania używają istniejących zawijanych wierszy faktów, zamiast niezawijanego pola ilości/ceny. Ręczna pozycja przekazuje istniejące dane normy/stawki do opisu; jej ilości i ceny nie są zmieniane. Konflikt transportu nadal daje STOP i zero naliczenia. Naprawiono dodatkowo wyłącznie prezentację `grand=0`: rabat 100% nie zastępuje już zera sumą przed rabatem.

Zachowano finansową regułę rejestru, opisaną w QUOTE_CALCULATION_REGISTER: Math.round do groszy, dział z niezaokrąglonych kwot źródłowych, suma z zaokrąglonych działów, niezależne zaokrąglenie rabatu i wyniku odjęcia niezaokrąglonego rabatu. Widok ujawnia składniki oraz potencjalną różnicę sumy wyświetlonych groszy pozycji. Nie wprowadzono nowego modelu finansowego.

## Dane i granice bezpieczeństwa

Nie zmieniono norm/cenników, kalkulatora robocizny, formatów projektu/snapshotów, importu/eksportu, synchronizacji, Rules ani storage. Archiwalne oferty nie są przeliczane ani przepisywane. Widok starszego opisu może użyć wyłącznie jego zapisanych operandów i zapisanej kwoty — bez dzisiejszych cen. Test odmawia odczytu aktualnego cennika przy takim renderowaniu i porównuje niezmienność całego archiwalnego obiektu.

Zachowano rozdzielenie CLOUD/CI: historyczne testy nadal dotyczą zamrożonego źródła, nowe smoke są automatycznie wykrywane w aktualnym kontekście. Nie zmieniono workflow, historycznych hashy/pinów, manifestów CAS, podpisów ani bramek LIVE. Aktualne skrypty mają spójne nowe wersje w obu HTML i ścisłym walidatorze.

## Weryfikacja i odpowiedzialności

- `session-quota-usage-smoke.js`: **7/7 grup PASS** — wiele/duży projekt, sumaryczna quota, retry i restart, koszt zastąpienia/utrata ACK, C=B/E/obcy, Zapisz/Anuluj, niezmienione pozostałe RAW, prywatność i Auth także podczas skanu.
- `quote-exact-calculations-smoke.js`: **82 kontrole PASS** — niezależny parser liczący widoczne operandy, 1/4/5/6/7/9/10/13/15/45 min, 150/250 zł/h, mnożniki, prywatne stawki z ułamkami, siedem trybów z zerem, przygotowanie/progi, gabarytoczas, projekt/wnoszenie, transport i konflikt, usługi/materiały/okucia, grosze/sumy/rabaty, rzeczywisty renderer DOM i niezmienione archiwum.
- Porównanie rejestru z BASE obejmuje wszystkie istniejące pola poza tekstem opisu i znacznikiem czasu; kontrola transportu/ręcznych pozycji porównuje dotychczasowe ilości i ceny. Źródła porównawcze mają sprawdzane dokładne Git blob SHA. Lokalny adapter wykonania blokował Node `execFileSync`; dostarczono te same, zweryfikowane bajty BASE odczytane Git-em przez Python, bez mockowania kalkulatora. CI może odczytać BASE normalnie z pełnej historii Git.
- Istniejący `wycena-labor-ui-browser-smoke.js` rozszerzono o rzeczywisty DOM/CSS raportu quota, anonimowy pomiar natywnego storage, odmowę bramki, brak zapisów i zawijanie dokładnych działań w obu profilach Chromium. Te nowe przypadki są **CI_PENDING**, nie uruchamiano ich lokalnie. To izolowany komponent z jawną fasadą autoryzowanego okna; nie jest testem Google Auth ani prawdziwego origin aplikacji. Pełny istniejący runner `session-diagnostics-screen-browser.js` zachowuje kontrolę realnego shellu i ma zaktualizowany ścisły kontrakt anonimowego rozszerzonego raportu; jego wykonanie również pozostaje niewykonane.
- Regresje są podłączone przez istniejące wykrywanie `tools/*-smoke.js`; pełne Preflight/Chromium/SDK/Rules wykona wyłącznie GitHub Actions po osobnej zgodzie. Wyniki innych SHA nie są dziedziczone.
- Kontrola składni zmienionych JS: **12/12 PASS**; dokładne wersje loaderów, zgodność wygenerowanego artefaktu diagnostycznego i kontrola diffu: **PASS**. Fizyczny Android pozostaje nieweryfikowany.

## Późniejsza świadoma procedura właściciela

Po osobno zatwierdzonym wydaniu, bez wymuszania restartu i bez rozpoczynania nowej edycji, użyć istniejącego „Diagnostyka sesji” przy odmowie. Skopiować anonimowy raport lub zrobić zrzut; sprawdzić kategorie rozmiarów, rozmiar rekordu i szacowanego payloadu. Nie czyścić danych, nie kasować sesji, nie zmieniać projektu na potrzeby diagnozy i nie powtarzać Zapisz/Anuluj w celu zwolnienia miejsca.

Przy utrzymującej się blokadzie potrzebna jest odrębna zgoda na zabezpieczenie **wszystkich RAW** w niezależnej prywatnej kopii, jej weryfikację oraz ustalenie właściciela i rewizji C/B/E. Dopiero potem można osobno rozważyć archiwizację danych lub migrację miejsca zapisu z planem cofnięcia. Brak dowodu, obca rewizja, uszkodzony payload lub niewystarczająca przestrzeń zachowują blokadę. Nie podejmowano tych działań ani żadnej operacji na telefonie właściciela.

## Zmienione pliki

- `CURRENT_STATE.md`
- `QUOTE_CALCULATION_REGISTER.md`
- `dev_tests.html`
- `index.html`
- `js/app/quote/quote-calculation-register.js`
- `js/app/ui/session-diagnostics-readonly.js`
- `js/app/ui/session-diagnostics.js`
- `js/app/wycena/wycena-core-material-plan.js`
- `js/app/wycena/wycena-core-offer.js`
- `js/app/wycena/wycena-summary-details-modal.js`
- `tools/diagnostics/pixel-session-bookmarklet.txt`
- `tools/quote-exact-calculations-smoke.js`
- `tools/reports/session-quota-exact-calculations.md`
- `tools/script-versions.js`
- `tools/session-diagnostics-screen-browser.js`
- `tools/session-diagnostics-screen-smoke.js`
- `tools/session-quota-usage-smoke.js`
- `tools/wycena-labor-ui-browser-smoke.js`

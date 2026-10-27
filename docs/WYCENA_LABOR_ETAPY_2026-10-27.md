# Meble-App — plan etapowego wdrożenia WYCENY, robocizny i katalogu akcesoriów

**Data decyzji:** 27.10.2026  
**Status:** PLAN / DOKUMENTACJA — bez zgody na implementację, CI, wydanie lub Firebase LIVE.  
**Repozytorium:** mebleszek/meble-app  
**Baza przeglądu:** main 149f9a126a85f9972f5fc1cd19afdc264be98cc7, po wydaniu PR #83.  
**Źródła biznesowe:** ustalenia bazowe 23.10, kontynuacja 26.10, „Meble-App_podsumowanie_ustalen_2026-10-27.pdf” (21 stron) oraz audyt kodu WYCENY z 27.10.

## 1. Nadrzędne decyzje właściciela

1. **Najpierw doprowadzić CLOUD v1 do bezpiecznego działania**, następnie wdrażać duże pakiety WYCENA-LABOR. Sam syntetyczny pilot Firebase nie oznacza zakończenia chmury. W przypadku zewnętrznego blokera możliwe są niezależne prace przygotowawcze lub odseparowany pakiet robocizny po osobnej decyzji właściciela.
2. **Najpierw ukończyć dział RYSUNEK, dopiero potem wdrażać blaty, blendy, cokoły i inne funkcje lub czynności wymagające informacji z RYSUNKU.** To twarda zależność, nie tylko preferencja kolejności. Nie uruchamiać prowizorycznej automatyki „z wymiarów szafek” dla geometrii kuchni.
3. Istnieje **jeden centralny cennik robocizny**, który zasila WYCENĘ; nie tworzyć osobnego kalkulatora ani alternatywnego cennika.
4. **Obowiązkowy audyt braków w katalogach akcesoriów i ich uzupełnianie** w toku wdrożeń. Prowadząca projekt (ChatGPT) identyfikuje brakujące informacje i dopytuje właściciela. Realne rekordy oraz ceny uzupełnia dopiero zatwierdzony wykonawca (Codex lub właściciel w aplikacji), bez zgadywania towarów i cen.
5. Zachować historyczne oferty, prywatne cenniki, istniejące poprawne normy, magazyn, wybrane warianty okuć, dotychczasowe UI i zasady chmury. Bez nieuzgodnionych zmian danych, Firebase LIVE ani procedury wydania.

## 2. Kolejność i bramki

**CLOUD v1 → fundament WYCENY i audyt katalogów → szuflady oraz samodzielne operacje montażowe → mechanizmy i AGD niezależne od rysunku → RYSUNEK → cokoły/blendy/blaty i pozostałe zależności od rysunku → audyt końcowy.**

Audyt i uzupełnianie akcesoriów to praca **przekrojowa**: rozpoczyna się przed automatami, a przed uruchomieniem każdego nowego rodzaju robocizny trzeba potwierdzić kompletność jego materiału. Nie trzeba czekać z całym projektem na katalog wszystkich przyszłych produktów.

### Etap 0 — CLOUD v1 / zakończenie rozpoczętego toru chmury

**Rezultat:** bezpieczny dostęp do tych samych projektów oraz domen globalnych na Pixelu i komputerze, także z ochroną pracy offline.

- Kontynuować istniejące CLOUD-4.6F, CLOUD-SYNC-1 i dalsze uzgodnione etapy; nie powtarzać zakończonych CLOUD-1/2/3/4.
- Zakończyć obowiązkowe bramki dla kontrolowanego pilota, a następnie synchronizację globalnych katalogów, cen, okuć, magazynu, projektów oraz trwałe lokalne transakcje/kolejkę zmian.
- Jeden aktywny edytor projektu, brak cichego nadpisania offline, automatyczne wznowienie synchronizacji, niezależne potwierdzenia zapisu i bezstratne recovery.
- Przed zmianami modelu cennika potwierdzić, jak wersjonowane i synchronizowane są definicje stawek, katalogi i powiązania materiał–robocizna.
- **Bramka DONE:** odpowiednie CI/Pages i kontrola na prawdziwych urządzeniach (telefon ↔ komputer, zerwanie internetu, konflikt, restart), bez utraty danych. Firebase LIVE/Rules/grant/WRITE/READ wymagają zawsze osobnych zgód. PR #83 to zabezpieczenie pamięci, nie dowód zakończenia LOCAL-FIRST.
- **Bloker zewnętrzny:** można dokumentować reguły i katalog, ewentualnie prowadzić izolowaną implementację po osobnej zgodzie, ale nie nazywać CLOUD v1 zakończonym.

### Etap 1 — przygotowanie wspólnego cennika, źródeł ilości i audytu akcesoriów

**Przed etapem:** odczytowa kontrola aktualnego main, AGENTS.md, CURRENT_STATE.md, ROADMAP.md, QUOTE_CALCULATION_REGISTER.md, CLOUD_DATA_REGISTER.md; audyt istniejących rekordów i zależności bez nadpisywania prywatnych ustawień.

**Część robocizna:**
- Ujednolicić zakres, jednostkę, profil stawki, wariant, źródło ilości i opis „?” dla każdej czynności. Rozróżnić normy **zatwierdzone / robocze / do decyzji** z raportu Worka; nie uruchamiać roboczych jako pewnych automatów.
- Dodać mechanizm **zakresu wspólnego przygotowania**: korpus, front, szuflada, partia, pomieszczenie, kuchnia, całe zlecenie. Naliczanie startu tylko przy rzeczywiście wykonanej pracy. Brak znanej ilości ma dawać ostrzeżenie/STOP, nie fikcyjną wartość lub ciche zero.
- Wykorzystać obecne profile stawek i czas 1/5/15/30/60 min; historyczne 45 min zachować. Czas złożony reprezentować jako sumę bloków (np. 15+5), a nie dodawać dowolnych bloków wyboru.
- Przygotować mapę zastąpień legacy (szczególnie stare „15 min montaż szuflady / prowadnic”, stare cokoły, AGD i konfliktujące operacje). Zachować ręczne przypisania i zamrożone oferty.
- Zbudować dowody z jednego źródła: **MATERIAŁ + robocizna + rejestr kalkulacji**; cena pozycji, stawka, czas, ilość, źródło i rozbicie obliczenia muszą się zgadzać.

**Część katalog akcesoriów — obowiązkowa, powtarzana przy kolejnych etapach:**
- Przeprowadzić odczytową inwentaryzację rzeczywistych zapisanych katalogów **akcesoriów, materiałów, producentów, preferencji i magazynu**. Repozytorium nie dowodzi kompletności prywatnego katalogu użytkownika.
- Porównać wymagania szafek oraz źródła ilości z istniejącymi rekordami. Utworzyć listę **BRAK / NIEKOMPLETNE / NIEJEDNOZNACZNE / ZWERYFIKOWANE**; nie tworzyć duplikatów produktów tylko dlatego, że mają inną nazwę.
- Najpierw skontrolować **nóżki, zawieszki, szyny, elementy mocujące, zawiasy, prowadniki, podpórki półek, wkręty i łączniki**. Następnie kolejno: systemy szuflad, prowadnice/sprzęgła, uchwyty, cargo, podnośniki, klipsy/cokoły, materiały do blatów i LED — zgodnie z etapem, w którym dane będą potrzebne.
- **ChatGPT dopytuje właściciela o każdy realny brak** (po jednym logicznym rodzaju produktu, bez wielkich formularzy): rodzaj i zastosowanie, producent/model/symbol, wariant i parametry, opakowanie i jednostkę rozliczenia, zakup netto/brutto i VAT, ewentualnie dostawcę oraz powiązanie z magazynem. Jeśli cena lub parametr są nieznane, pozostają oznaczone jako nieustalone.
- Po akceptacji właściciela **uzupełniać** brakujące lub niepełne pozycje w **istniejącym katalogu**, poprzez Codexa w zatwierdzonym pakiecie albo ręcznie przez właściciela. ChatGPT prowadzi rejestr decyzji i kontroluje wynik; nie wpisuje fikcyjnych cen i nie włącza Firebase LIVE przy okazji.
- Weryfikować, że ilość okuć w MATERIALE i odpowiednia ilość operacji robocizny pochodzą z tych samych wymagań; brak ceny materiału nie może po cichu dawać „kompletna wycena”.

**Bramka:** możliwość policzenia reprezentatywnych korpusów bez dubli, poprawne ostrzeżenia o brakach katalogów i bez naruszenia istniejących cen/ofert.

### Etap 2 — szuflady oraz montaż korpusów niezależny od RYSUNKU

**Przed etapem:** domknąć katalog odpowiednich prowadnic/szuflad/uchwytów i źródła rzeczywistych ilości, bez czytania DOM jako źródła prawdy.

**Zakres jednego pakietu robocizny:**
- Szuflady systemowe i skrzynkowe (dolny montaż vs kulkowe/rolkowe), wewnętrzne, przygotowanie wspólne, złożenie, prowadnice, zaczepy, fronty, foliowanie, wpięcie i regulacja u klienta. Usunąć równoległe naliczanie starego automatu 15 min.
- Korpusy stojące i wiszące: rozfoliowanie, ustawienie, poziom, szyna i właściwy wariant mocowania przez plecy 18 mm; nie naliczać obu wariantów wiszących ani dodatkowego przygotowania wbudowanego w 60 min korpusu.
- Uchwyty: wspólne 30 min **na całe zlecenie**, 5 min/uchwyt oraz 1 min/śrubę (liczba śrub z ustalonego wariantu, nie automatyczne założenie dla wszystkich).
- Dodatkowe ręczne punkty mocowań, jeśli dane nie umożliwiają pewnego automatu.
- Konflikt regulacji drzwi: zapis bazowy z raportu 1 min startu + 1 min/zawias (np. 4 fronty × 2 = 9 min) kontra obecny kod naliczający fronty + zawiasy. **Przed zmianą rozstrzygnąć jednostkę startu i mapę starych pozycji**.
- **Powiązania zależne od układu sąsiadów w RYSUNKU**: docelowe wykrywanie liczby połączeń szafek odłożyć do etapu RYSUNEK; nie projektować teraz drugiego układu geometrii. Tymczasowy biznesowy przelicznik „jedno połączenie na szafkę” z raportu można utrzymać tylko w jawnie zaakceptowanym zakresie, z ostrzeżeniem, że nie jest rzeczywistym licznikiem sąsiedztwa.

**Bramka:** mieszana szafka systemowa/skrzynkowa, szuflady wewnętrzne, dwa warianty prowadnic, zero szuflad, ręczne nadpisania; pełna kwota w WYCENIE i rejestrze bez podwójnych przygotowań.

### Etap 3 — AGD, cargo, podnośniki i czynności LED niezależne od układu

**Przed etapem:** kompletność okuć dla określonych mechanizmów, źródła liczby fizycznych elementów, warianty montażu i stawki warsztat/montaż.

- AGD: rozbić stare pojedyncze normy na zatwierdzone etapy (zmywarka, lodówka, piekarnik, okapy, płyty, mikrofala, zlew) i jawnie wyłączać poprzedni automat. **Nie** dopisywać podłączeń hydraulicznych, gazowych ani elektrycznych AGD.
- Lodówka: osobno integracja i regulacja frontu, rozróżnić własne zawiasy urządzenia od zawiasów meblowych; nie zgadywać normy w nieustalonym wariancie.
- Cargo i systemy narożne: prawdziwa liczba prowadnic, zaczepów i mechanizmów; robocze lub nieprzypisane profile montażu wymagają decyzji, zanim staną się automatami.
- AVENTOS: wykorzystać obecny model HK-XS/HK-S/HK top/HS top/HL top/HF; rozdzielić warsztat, regulację szczelin i dodatkowe 5 min regulacji siły na podnoszony front. Nie podwajać frontu łamanego bez decyzji.
- LED: rozpocząć od **katalogu materiałów i czynności niezależnych od geometrii**, np. przygotowania i cięcia profili, montażu zasilacza, włączników — tylko po zatwierdzeniu miejsca/stawki i bez zdublowania czynności. **Prowadzenie przewodów między fizycznymi elementami, odcinki i zależności od trasy odłożyć do etapu po RYSUNKU**, o ile nie ma innego jednoznacznego źródła liczby odcinków.
- Pozycje o nieustalonym profilu/stawce i przypadki zależne od fizycznego układu pozostają ręczne lub oznaczone STOP, nie są cicho automatyzowane.

**Bramka:** przypadki mieszane mechanizmów i AGD, obsługa wyłączenia montażu, zachowanie materiału bez robocizny tam, gdzie to uzasadnione, brak dubli i pełna kompatybilność ofert.

### Etap 4 — dokończenie działu RYSUNEK (obowiązkowa bramka przed elementami wykończeniowymi)

**Rezultat:** RYSUNEK ma być wiarygodnym i zapisanym źródłem układu dla WYCENY, MATERIAŁU oraz przyszłych czynności zależnych od geometrii. **Ten etap poprzedza etap 5 bez wyjątku.**

**Przed wdrożeniem:** osobny audyt funkcjonalny istniejącego RYSUNKU i akceptacja konkretnych zmian UI/UX, jeśli okażą się konieczne. Nie przebudowywać interfejsu w pakiecie robocizny.

Minimalny kontrakt danych RYSUNKU:
- segmenty i rzędy zabudowy, kolejność i sąsiedztwo korpusów, rzeczywiste połączenia, przerwy, długości odcinków, L/U/naroża;
- jednoznaczne elementy wykończeniowe (cokół, blenda, bok obcy, ścianka zamykająca), liczba sztuk/odcinków i ich techniczne wymiary, wspólne zakresy robót;
- plan/blaty jako obiekty techniczne, nie sama suma szerokości szafek: odcinki, miejsca łączeń, podporządkowane korpusy, otwory oraz warianty obróbki; brakujące informacje wymagają projektu osobno zatwierdzonego, nie zgadywania;
- stabilne identyfikatory i zgodność z projektem, ROZRYS/MATERIAŁ, zapisem offline, chmurą i eksportem; jeden autorytet ilości, bez ukrytych równoległych modeli.

**Bramka RYSUNEK_DONE:** użytkownik potwierdza na telefonie rysunek prostej kuchni, L i U; zapis/odtworzenie; logiczne rozpoznanie elementów i długości; brak konfliktu z istniejącymi projektami. Dopiero po tej bramce wolno wdrażać automaty powiązane z rysunkiem.

### Etap 5 — cokoły, blendy, blaty i wszystkie pozostałe zależności od RYSUNKU

**Warunek bezwzględny:** RYSUNEK_DONE z etapu 4. Bez tego etapu nie dodawać automatycznej wyceny tych prac na podstawie przybliżonej geometrii.

- Cokoły: kuchenne na klipsach kontra zlicowane na wkręty; EKO/Standard/Premium, starty na partię/pomieszczenie, odcinki, prawdziwe długości, klipsy/listwy i liczba korpusów, które obejmują.
- Blendy, boki obce, ścianki: wyszukanie elementów wspólne z cokołami tylko raz; baza/rowki/wklejanie oraz wariant dopasowania, z rzeczywistych elementów RYSUNKU.
- Blaty: odcinki, warsztat, osadzenie i osobne przykręcanie, silikon przy ścianie, otwory/kształty, przenoszenia na blat, łączenia na łyżwę, śruby i akcesoria, wspólne przygotowania na kuchnię. Nie sumować roboczych norm szablonu, odrysu i osadzenia bez wcześniejszego rozstrzygnięcia zakresów.
- Elementy wynikające z RYSUNKU: docelowe liczenie połączeń sąsiadujących szafek, rzeczywistych punktów mocowań, geometrii przewodów LED i pozostałych operacji zależnych od układu.
- **Przed automatyzacją blatów** właściciel zatwierdza nadal otwarte decyzje z raportu: osadzenie/szablony 30/60/do 120 (robocze), start silikonowania przy wielu blatach, mieszane otwory, niepewne warianty. Nie zamieniać szacunków w nieodwołalne automaty.
- Dla materiałów (klipsy, śruby, silikon, klej, listwy, profile, przewody) najpierw realna inwentaryzacja i pytania o właściwe produkty oraz zużycie. Nie przyjmować automatycznie „jeden kartusz na otwór”.

**Bramka:** układy prosty/L/U z mieszanymi wykończeniami; długości i sztuki z RYSUNKU zgodne z materiałem i robocizną; przygotowanie jednorazowo w prawidłowym zakresie; żadnych podwójnych pozycji.

### Etap 6 — końcowy audyt i zamknięcie WYCENA-LABOR v2

- Regresja pełnej wyceny przykładowych kuchni: tylko systemowe, mieszane szuflady, wiszące HDF/18 mm, cargo, podnośniki, AGD, uchwyty, L/U, cokoły/blendy, blaty, LED, pozycje ręczne i świadomie wyłączone.
- Kontrola spójności: **katalog akcesoriów → wymagania techniczne → MATERIAŁ/MAGAZYN → robocizna → rejestr kalkulacji → oferta/snapshot → eksport/zapis/synchronizacja**.
- Testy pustych i brakujących danych (0 oznacza rzeczywiste zero; brak danych oznacza brak dowodu i ostrzeżenie), poprawki zapisanych cen, warianty z wzajemnym wykluczeniem, konflikty definicji.
- Nie przeliczać historycznych snapshotów ani nie zmieniać istniejących zleceń bez jawnej polityki i zgody.
- Po zatwierdzonym wydaniu właściciel wykonuje na Pixelu praktyczną wycenę rzeczywistego projektu, a gdy dotyczy, kontrolę przepływu z Windows.
- Dopiero po zamknięciu powyższych etapów rozważyć osobne pakiety szaf/garderób i dalszych typów zabudowy.

## 3. Otwarty rejestr decyzji — bez blokowania niepowiązanych etapów

- Regulacja zawiasów/drzwi: 1 min wspólnego startu + 1 min/zawias z raportu vs dotychczasowe liczenie front+zawias w kodzie; potwierdzić **zakres wspólnego startu**.
- Zerowa liczba nóżek przy poziomowaniu stojącej: brak docelowej reguły.
- Zawieszenie / podłączenie okapu: które etapy zawierają bazowe skręcanie 60 min i zawieszenie szafki.
- Fronty łamane: jednostka regulacji siły i rozdział od szczelin; lodówki z własnymi zawiasami — jednostka regulacji.
- Cargo i LED: realne miejsce wykonania oraz właściwy profil stawki; osobno mechaniczne mocowanie zasilacza.
- Blaty: niezamknięte warianty, grupowanie startów, mieszane otwory i szablony — **rozstrzygać przed etapem 5**, już po dopracowaniu RYSUNKU.
- **Akcesoria i ich ceny:** rejestr braków ustalany na danych rzeczywistej instalacji, nie na domysłach ze źródeł GitHuba. Pytać właściciela tylko o te parametry, których nie potwierdza katalog.

## 4. Tryb wykonania i granice zgód

- ChatGPT GPT-6 High: właściciel planu, audyt i weryfikacja, pytania o brakujące akcesoria, kontrola spójności i priorytetów; bez samodzielnej implementacji zmian w aplikacji.
- Codex Sol High: wykonanie odrębnie zatwierdzonych etapów, skryptów/kontraktów, dokumentacji, testów i commitów na gałęzi.
- GitHub Actions: jedyne pełne testy CI i zatwierdzony proces PR Ready → auto-merge → GitHub Pages. Nie dublować Preflightu lokalnie.
- Właściciel: normy, rzeczywiste ceny i warianty akcesoriów, zgody na zakres kodowania, na **każdą** próbę wydania z dokładnym HEAD/BASE oraz osobne zgody Firebase LIVE.

**Każdy pakiet:** analiza i zakres → wyraźne „do dzieła” → Codex CODE_READY/CI_PENDING → odczytowy przegląd SHA i diffu → osobna zgoda na próbę PR Ready → pełne CI i automatyczny merge/Pages → test właściciela na telefonie. Nie scalać ręcznie i nie uruchamiać LIVE „przy okazji”.

**Niniejszy dokument to plan i zapis zależności, nie zatwierdzenie jego implementacji ani wydania.**

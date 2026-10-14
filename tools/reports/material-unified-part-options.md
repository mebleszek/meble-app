# Wspólne „Opcje formatki” — 2026-10-14

Implementacja na bazie `582e084e` po PR #43 i #44. Raport opisuje nowy Draft PR, a nie już scalone zachowanie main. Decyzja użytkownika z 2026-10-14 zastępuje rozdzielenie edytorów opisane historycznie w `c2-1b2c3-project-pcv-ui-activation.md`; nie przepisujemy tamtego raportu.

## Interfejs i właściciele

MATERIAŁ ma jeden przycisk **Opcje**, otwierający istniejące `FC.materialPartOptions.openOptionsModal()` pod tytułem **Opcje formatki**. Cztery checkboxy 1A/1B/2A/2B i cztery kierunki słojów są dostępne równocześnie; ten sam podgląd reaguje na obie zmiany. Zachowano oryginalny wzór proporcji mapy, klasy CSS, rozmieszczenie krawędzi, stopkę Wyjdź / Anuluj + Zapisz oraz przycisk **Przywróć domyślne PCV**. Przelicz projekt pozostaje bez zmian.

PCV nadal należy do fizycznego projektu i adresu elementu/grupy: `projectPcvOverrides.get/setEdges/clearEdges`. Lewy i prawy bok pozostają niezależne, półki i standardowe fronty zachowują grupy, fronty zestawu właściciela setId. Nie zmieniono modelu adresów ani API nadpisań.

Słoje nadal korzystają z istniejącego `fc_material_part_options_v1`, podpisu i planera semantic revert. Nie zapisujemy PCV do `fc_edge_v1`, nie przenosimy słojów do projektu i nie zmieniamy rotacji. Kierunek początkowy i RAW otwarcia pochodzą z tego samego odczytu, żeby nie połączyć dwóch wersji globalnego rekordu.

## Kontrakt wspólnego zapisu

`material.js` przekazuje mały adapter `projectEditor`: walidację właściciela, odczyt rekordu projektu i existing setEdges/clearEdges. Przed otwarciem porównujemy również rekord użyty do renderowania wiersza, żeby stary DOM nie udostępniał mapy ani podpisu słojów z dawnych wymiarów. Rekord jest sprawdzany przed i po pobraniu krawędzi podczas otwarcia, a jego pełny fingerprint obowiązuje do zapisu. Właściwa walidacja projektu, RAM, pokoju, geometrii i sesji pozostaje w istniejących guard/API.

`materialPartOptions.saveProjectDraft()` koordynuje jeden lokalny draft:

1. Weryfikuje właściciela, aktualność rekordu projektu i dokładny globalny RAW z otwarcia. Błędny JSON nie jest zastępowany pustym store.
2. Rozpoznaje no-op; Wyjdź, brak zmian i reset już domyślnego PCV nie powodują nowego begin ani zapisu.
3. Dla realnej zmiany wymaga udanego durable begin i inspectNavigationState. Ponawia jedynie istniejący kontrakt początkowego failed begin; nie resetuje baseline.
4. Ponownie planuje słoje z durable baseline, weryfikuje poprzedni RAW, zapisuje je jako pierwszą część i potwierdza wynik oraz exact read-back. False, wyjątek i silent no-op oznaczają błąd.
5. Ponownie sprawdza projekt i RAW, następnie wykonuje wyłącznie odpowiedni setter/clearer kanonicznego PCV. Zmiana samych słojów nie zapisuje projektu, zmiana samych krawędzi nie zapisuje globalnych słojów.
6. Kończy sukcesem i zamyka okno tylko po sprawdzeniu efektywnych krawędzi, globalnego RAW, kontekstu i trwałego dowodu sesji.

## Awaria, konflikt i kompensacja

Kolejność grain → project pozwala przy zwykłej odmowie zapisu projektu cofnąć pierwszą część bez kompensacyjnego zapisu całego projektu. Cofamy globalny RAW tylko wtedy, gdy nadal jest dokładnie naszym potwierdzonym nextRaw; ponownie sprawdzamy go bezpośrednio przed undo i potwierdzamy przywrócony RAW. Nowszego globalnego rekordu nie nadpisujemy.

Przy projectSaved:true, zmianie centralnego rekordu podczas próby, niepewnym odczycie lub niemożliwej kompensacji nie odtwarzamy starego projektu. Zachowujemy potwierdzone PCV, draft obu pól i original snapshot; istniejąca markUnconfirmedProjectWrite blokuje dalszy zapis/commit starego RAM. Komunikat odróżnia nieudany zapis od częściowego/niepotwierdzonego wykonania. Nie ma automatycznego Cancel, commit ani adopcji najnowszej rewizji.

## Zapisz / Anuluj całej sesji i ograniczenia

Lokalny Anuluj z potwierdzeniem odrzuca draft i niczego nie zapisuje. Globalny Zapisz nadal kończy poprawnie potwierdzoną sesję, a globalny Anuluj nadal cofa projektowe PCV w jego pokoju.

**Istniejąca blokada C2.0 globalnego Cancel pozostaje:** jeśli globalny kierunek słojów różni się od session baseline, cancel zwraca `UNSCOPED_PART_ROLLBACK_BLOCKED`. Nie omijamy tej ochrony i nie deklarujemy projektowej własności słojów. Jawny semantic powrót słojów do baseline pozwala potem na dotychczasowy room-scoped Cancel. To odrębne ograniczenie pozostawione do przyszłej decyzji o słojach; D1–D6 nie są tutaj całkowicie zamknięte.

localStorage nie zapewnia atomowego compare-and-swap pomiędzy kartami. Koordynator używa świadków RAW, conditional confirmed save, read-back i blokad przy wykrytej niezgodności; nie jest transakcją chmurową ani trwałym dziennikiem operacji. Restart po stanie niepotwierdzonym korzysta z istniejących zabezpieczeń sesji, bez auto-rollbacku. Nie zmieniono recovery/snapshot schema.

Nie zmieniono WYCENY, ROZRYSU, geometrii, stawek, zapasu 10%, katalogów, słowników, ustawień ani historii. Testy używają izolowanego MemoryStorage; nie dotykają magazynu użytkownika.

## Weryfikacja

- `material-part-active-editor-smoke`: stary edytor, jeden projektowy launcher, obie kontrolki, rzeczywiste wymiary i niezmienny wzór mapy, live preview.
- `material-part-project-save-smoke`: oba/samodzielne zapisy, no-op, default reset, lokalny Cancel, exact RAW roundtrip, begin/storage/project/revision failures, kompensacja, konkurencyjny writer, nowszy pokój, częściowy zapis, restart, własność PCV, globalne domeny i istniejąca blokada globalnego Cancel.
- `project-pcv-ui-activation-smoke`: rzeczywisty MATERIAŁ → ROZRYS → WYCENA; aktualizacja wyłącznie oczekiwań wynikających z zatwierdzonego wspólnego okna.
- Wynik końcowy: `node tools/preflight.js` — PRE-FLIGHT PASS, smoke 118/118, APP 110/110, składnia 524/524, load order 318, audyty zależności i storage PASS. Celowane wyniki: aktywny edytor 28/28, wspólny zapis 21/21, integracja PCV UI 60/60. `node --check` zmienionych JS 5/5 i `git diff --check` PASS. Referencje nadal wynoszą 16,440 → 17,122 → 18,834 mb; fronty 5,010 → 5,511 mb; niezależny rozkrój 4/3/6 arkuszy.

Ręczna akceptacja na Androidzie pozostaje po stronie użytkownika: wyłącznie projekt testowy, otwarcie Opcje lewego boku, zmiana PCV i kierunku, jeden Zapisz, ponowne otwarcie, kontrola prawego boku i drugiej szafki, reset PCV oraz lokalny Anuluj. Test symulowanego DOM nie zastępuje fizycznego urządzenia; istniejące responsywne klasy dla telefonu/tabletu/komputera pozostały nietknięte.

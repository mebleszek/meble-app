# C2.1b.1a — zgodna geometria standardowych frontów szuflad

Baza: `5218d378e1155892eefced81f83a5a99f22cca37` (main po PR #33).

## Jedno obowiązujące wyliczenie

`FC.cabinetCutlist.resolveDrawerFrontGeometry(cabinet, room)` jest wspólnym, read-only resolverem. Wykorzystuje istniejące `bodyHeightCm()` z generatora korpusu. Pole `cabinet.height` jest w cm. Dla stojącej szafki obejmuje nóżki, o ile `details.heightIncludesLegs` nie oznacza false/0. Efektywna wysokość nóżek pochodzi najpierw z `details.legHeightCm`, potem z `room.settings.legHeight`. Dla modułu nie odejmuje się nóżek. Nie używamy wysokości boku pomniejszonej o grubość wieńca jako wysokości korpusu.

Geometria produkcyjna jest wyrażona w mm. Dla `3_1_2_2`:

```text
H_mały = H_korpusu - 7 - 2*4 - 2*283 = H_korpusu - 581
fronty = [H_mały, 283, 283]
suma frontów + 4 + 4 = H_korpusu - 7
```

Nie odejmujemy dodatkowych 7 mm od frontów. Nie rozdzielamy tych 7 mm arbitralnie między odstęp nad i pod frontami.

| Korpus (mm) | Mały front (mm) | Duże fronty (mm) | Suma z dwiema szczelinami (mm) |
|---|---:|---|---:|
| 600 | 19 | 283, 283 | 593 |
| 650 | 69 | 283, 283 | 643 |
| 700 | 119 | 283, 283 | 693 |
| 720 | 139 | 283, 283 | 713 |
| 800 | 219 | 283, 283 | 793 |
| 900 | 319 | 283, 283 | 893 |

Przykładowo 82 cm wysokości całkowitej z nogami 10 cm daje korpus 720 mm. Tak samo 72 cm z `heightIncludesLegs:'0'`, 87 cm z indywidualnymi nogami 15 cm lub moduł 72 cm bez odejmowania nóg.

`drawerLayout` jest źródłem liczby frontów. Stare `details.drawers` nie jest nim: obecny cleaner usuwa to pole, a wymagania szuflad już wcześniej korzystały z `drawerLayout`. Brak layoutu oznacza istniejący default `3_1_2_2`.

Układy `1_big`, `2_equal`, `3_equal`, `5_equal` zachowują podział stosowany dotąd przez `cabinet-fronts.js`: równe wysokości, zaokrąglenie do mm i korektę ostatniej sztuki. Czytnik materiałowy przyjmuje te same wymiary zamiast niezależnego podziału `fh / drawers`. Uwzględnienie `heightIncludesLegs` i indywidualnych nóg usuwa błędne odejmowanie nóg również dla tych układów. Pozostałe typy frontów nie zmieniają wyliczeń.

## Przepływ i grupy

- `cabinet-fronts.js` używa resolvera przy generowaniu istniejących rekordów frontów.
- `front-hardware-fronts.js` używa go do frontów w cutliście zarówno stojącej szafki, jak i modułu.
- MATERIAŁ, oba agregatory ROZRYSU i źródło WYCENY otrzymują identyczną geometrię przez dotychczasowy przepływ.
- Grupy pozostają `front.drawer.small` (1) i `front.drawer.large` (2), z tym samym właścicielem. `front.drawer.standard` pozostaje grupą równych układów. Zmiana geometrii nie tworzy indywidualnych slotów ani nowych ID właściciela.
- Gdy mały front również ma 283 mm (korpus 864 mm), wiersz agreguje `qty:3`, ale nadal zachowuje dwa wkłady grup: 1 + 2. Nie ma podwójnego liczenia.
- Cache został wersjonowany ponownie i uwzględnia efektywną geometrię frontów, w tym zmianę pokojowego `legHeight`. Odtwarzalne `derivedFacts` nadal nie jest trwałym źródłem projektu.

## Nieprawidłowe wymiary

Korpus ≤581 mm dla mieszanego layoutu daje `{ok:false, code:'body_too_short', panels:[]}`. Nie powstają fronty ujemne ani zastępcze. Nieznany układ lub niedodatnie/nieskończone wymiary również dają failure.

Modal waliduje lokalny draft przed durable begin i przed pierwszą mutacją projektu. Używa istniejącego infoBox, pozostaje otwarty i zachowuje draft.

Generator mutujący fronty zgłasza `INVALID_DRAWER_FRONT_GEOMETRY` PRZED usunięciem wcześniejszych frontów lub zmianą licznika. Wyjątek jest celowy: dotychczasowy bulk caller ignorowałby wartość false, lecz istniejący mechanizm bulk recovery obsługuje wyjątki i przywraca baseline RAM bez zapisu centralnego. Dedykowana regresja sprawdza tę ścieżkę.

Czytniki cutlisty/cache i źródło WYCENY propagują ten konkretny błąd. Nie mogą wrócić do starego cache ani pustego zestawu frontów i udawać prawidłowej kalkulacji. Nie zmieniono obsługi innych błędów, silnika cen ani optymalizatora.

## Rzeczywiste porównanie przed/po

Diagnostyka uruchomiła oryginalne moduły obu generatorów z bazowego main oraz wersję poprawioną na tym samym testowym korpusie 720 mm, szerokości 600 mm i czterech domyślnie oklejanych bokach frontu. Nie modyfikowała danych użytkownika.

| Stan | Zapisane fronty (mm) | Fronty MATERIAŁU (mm) | Powierzchnia frontów | PCV frontów |
|---|---|---|---:|---:|
| Main, bez legacy `details.drawers` | 144, 288, 288 | 720 (1 szt.) | 0,432 m² | 2,64 m |
| Main, legacy `details.drawers:3` | 144, 288, 288 | 240, 240, 240 | 0,432 m² | 5,04 m |
| Po poprawce, oba warianty | 139, 283, 283 | 139, 283, 283 | 0,423 m² | 5,01 m |

Wyliczenie PCV 5,01 m: `2 * (3 * 600 + 139 + 283 + 283) / 1000`. Szczeliny nie są materiałem frontu ani okleiną.

Cenniki i wzory cen pozostają niezmienione. Zmieniają się prawidłowe ilości wejściowe. Rzeczywisty collector WYCENY w teście wylicza 0,423 m² × kontrolna cena 100 zł/m² = 42,30 zł. To cena syntetyczna wyłącznie w fixture; nie jest nową wartością globalnego cennika. Arkuszowy koszt nadal wynika z rzeczywistego rozkroju wybranego zakresu, a nie z ręcznie ustalonej liczby arkuszy.

Referencja Kuchnia/Salon/wspólny zakres nadal wynosi **4/3/6 arkuszy**. Jej rzeczywisty test optymalizuje niezależne panele 2700 × 950 mm, a nie zmienione fronty szuflad; nie podmieniano oczekiwań. Nowy test dodatkowo umieszcza wszystkie trzy fronty o nowych wymiarach na jednym arkuszu w rzeczywistym optimizerze i sprawdza ich placements.

## Zakres plików i weryfikacja

Produkcja: `cabinet-cutlist.js` (resolver), `cabinet-fronts.js` i `front-hardware-fronts.js` (delegacja), `cabinet-modal-finalize.js` (walidacja przed mutacją), `cabinet-derived-facts.js` (cache i blokada błędnych odczytów), `wycena-core-source.js` (propagacja błędu), `index.html` i `dev_tests.html` (cache-busting).

Testy: nowy `drawer-front-geometry-smoke.js`; `template-part-groups-smoke.js` i `part-provenance-stability-smoke.js` zachowują pełną kontrolę ilości, rozpoznając wkład jednej grupy w kilku wierszach geometrycznych i canonical layout count; trzy smoke cache otrzymują wyłącznie nową wersję; `app-dev-smoke.js` otrzymuje ścisłe oczekiwanie nowej wersji zmienionego źródła WYCENY; fixture `wywiad-room-durable-save-smoke.js` ładuje wspólny resolver i dodatkowo sprawdza recovery przy błędnej geometrii.

Nowy smoke obejmuje 18 scenariuszy: przykłady korpusu, sumy z odstępami, nogi i moduł, oba generatory, MATERIAŁ/ROZRYS/WYCENA, realne placements i koszt m², powierzchnię/PCV, adresy grup, agregację, pozostałe układy i zaokrąglenia, default/legacy count, walidację przed usunięciem frontów, brak fallbacku kalkulacji, modal, cache po zmianie nóg, read-only i confirmed save/owner rollback.

Końcowe wyniki na Node 22.23.3:

- Nowy smoke geometrii: **18/18 PASS**; grupy szablonów: **21/21 PASS**; stabilne pochodzenie: **18/18 PASS**.
- Pełny preflight: **PASS**, JavaScript **514/514**, kolejność **315**, smoke **111/111**, APP **110/110**.
- Dependency **PASS** (JS domenowe 391, index 315, dev_tests 343); storage **PASS** (326 referencji, 40 plików).
- Bezpośrednie testy Zapisz/Anuluj, owner rollback, durable begin, MATERIAŁU, ROZRYSU, nóg/korpusu, szuflad, zestawów oraz kalkulacji wielopomieszczeniowej: **PASS**. WYWIAD durable room save z nową regresją bulk: **18/18 PASS**.
- `node --check` wszystkich zmienionych/dodanych JS: **14/14 PASS**; `git diff --check`: **PASS**.
- Diagnostyka D1–D6: **6/6 otwartych defektów odtworzonych**, poza testami akceptacyjnymi.

Pierwszy preflight wykrył nieaktualną whitelistę wersji źródła WYCENY i fixture WYWIADU bez nowej współdzielonej zależności. Dostosowano wyłącznie oczekiwanie cache-bustingu i kolejność ładowania fixture, zachowując dotychczasowe asercje trwałego zapisu, odzyskiwania i ilości. Końcowy przebieg obejmuje wszystkie powyższe poprawki i dodatkowe testy rzeczywistych placements/kosztu.

## Pozostałe ryzyka

- Nie migrujemy ani automatycznie regenerujemy istniejących zapisanych `room.fronts`. Nowe generowanie używa nowego wzoru; stary RAW i historyczne oferty pozostają nietknięte. Bieżąca cutlista jest odtwarzana ze źródłowej konfiguracji szafki.
- Zastana szafka o nieprawidłowych parametrach może zablokować bieżącą kalkulację do czasu ich poprawienia. Nie jest naprawiana domyślnymi wymiarami.
- Zmiana geometrii zmienia stare podpisy globalnych nadpisań. Nie przypisujemy automatycznie osieroconych PCV/słojów do nowych frontów; migracja tych danych nie należy do tego etapu.
- D1–D6, przeniesienie nadpisań do projektu i kreator niestandardowy pozostają poza zakresem. Adresy grup dla obsługiwanej geometrii są już spójne; C2.1b.2 nadal wymaga scoped, durable, confirmed zapisu w kanonicznym projekcie.
- Nie określono dodatkowej technologicznej minimalnej wysokości dodatniego małego frontu. Walidacja tego zadania odrzuca niedodatni wynik wzoru; nie wymyśla dodatkowego progu.

Nie zmieniono globalnych katalogów, cenników, backupów, storage keys, historii ofert ani semantyki Zapisz/Anuluj.

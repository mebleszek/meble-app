# PROJECT_DECISIONS — obowiązujące decyzje Meble-App

Ten krótki rejestr należy odczytać **razem z `AGENTS.md` przed każdą zmianą kodu lub interfejsu oraz na początku każdego nowego wątku dotyczącego Meble-App**. Nie zastępuje `ROADMAP.md`, `CURRENT_STATE.md` ani dokumentacji danej domeny. Jeśli dokumenty się różnią, sprawdź bieżący kod i zapytaj użytkownika; nie wybieraj samodzielnie nowej reguły.

Oznaczenia: **ZATWIERDZONE** = obowiązująca decyzja; **DO WDROŻENIA** = zakres zaakceptowany, ale nieukończony; **DO OMÓWIENIA** = brak decyzji; **ODŁOŻONE** = poza bieżącym zakresem.

## 2026-10-14 — decyzje obowiązujące

### ZATWIERDZONE — nienaruszalność interfejsu
- Bez wcześniejszej konkretnej zgody użytkownika nie dodawać, nie usuwać, nie ukrywać ani nie przenosić żadnych elementów UI ani nie zmieniać ich zachowania. Proponować i omawiać przed implementacją.
- Użytkownik potwierdził, że **pozostałe zmiany UI w ostatnich 40 PR były zatwierdzone**. Wyjątek stanowią nieuzgodniony przycisk **„Włącz projektowe PCV”** i związany z nim dodatkowy dialog aktywacji w PR #40; ich usunięcie zostało już zaakceptowane.
- Istniejący przycisk **„Przelicz projekt”** pozostawić na razie wizualnie bez zmian; nie usuwać go przy okazji poprawki PCV. Sprawdzić jego działanie, a o losie przycisku rozmawiać osobno.

### ZATWIERDZONE — różne klasy danych
- **Inwestorzy i projekty: niemal testowe**. Na obecnym etapie **nie wymaga się wstecznej kompatybilności** z ich dawnymi formatami, nie trzeba budować kolejnych adapterów legacy ani przenosić dawnych przykładów za wszelką cenę. Ewentualne kasowanie/reset istniejących danych wymaga jednak osobnego, jawnego zakresu; brak kompatybilności nie jest upoważnieniem do samowolnego usuwania.
- **Dane globalne: bezwzględnie chronione i zgodne wstecznie**. Obejmuje co najmniej: cenniki i stawki, katalogi materiałów i okuć, dane techniczne okuć, dostawców i producentów, słowniki, ceny dostawców, ustawienia globalne i konfiguracje wypracowane z użytkownikiem. Żadnych zmian, resetów, migracji czy przepisania starych rekordów bez osobnej zgody. Każda implementacja przy storage musi dowieść regresjami, że te dane są nietknięte.
- Inne obszary (np. utrwalona historia ofert) mają własne ograniczenia; tej decyzji **nie rozszerzać samodzielnie** na kolejne magazyny. Oferty już zapisane nie mogą samoczynnie zmieniać się przy kolejnych wycenach ani zmianach katalogów.
- Architektura docelowa: **jeden projekt = jedno źródło prawdy**; cache odtwarzalny nie jest drugim źródłem danych. Migracja chmurowa w etapach, bez tworzenia pobocznych magazynów.

### ZATWIERDZONE — procedura współpracy
- Najpierw przeczytać aktualne `AGENTS.md` + ten plik (także **przed każdą zmianą i przy rozpoczęciu nowego wątku**), następnie dokumenty danego zakresu i kod/testy. Nie obciążać Codexa ponownym pełnym audytem, jeśli zakres jest już ustalony.
- Po nowym uzgodnieniu zanotować decyzję tutaj: datę, status, zakres, wyłączenia i powiązany PR. Jeżeli decyzja zmienia starszą, zaznaczyć nadpisanie; nie usuwać jej znaczenia milcząco. Brak dostępu do repo = zgłosić ograniczenie, nie udawać odczytu.
- ChatGPT rekomenduje tryb/model/wysiłek; Chat/Work do analizy, Codex głównie do kodowania i testów. Android jest obecnie jedynym urządzeniem ręcznej akceptacji użytkownika. Bez samodzielnego Ready, merge ani publikacji.

## 2026-10-14 — zatwierdzony następny etap PCV

**Status: DO WDROŻENIA. Nie jest to jeszcze aktualne zachowanie `main`.**

1. Projektowe PCV uruchamia się **automatycznie** dla nowych projektów oraz bezpiecznie przy przejściu istniejących projektów testowych; brak przycisku i osobnego dialogu aktywacji. Decyzja o nowym trybie jest trwała w fizycznym rekordzie projektu, a nie w odrębnym magazynie.
2. Naprawić integrację modułów `FC` / `window.FC` w zakładce MATERIAŁ i sprawdzić poprawność wywołania `Przelicz projekt`, **bez zmiany wyglądu tego istniejącego przycisku**.
3. Nie importować globalnych nadpisań PCV do projektowych danych, nie usuwać ani nie nadpisywać ich. Nowe krawędzie mają wartości technologicznie domyślne, a ręczne zmiany są projektowe.
4. Jeśli nie da się wiarygodnie potwierdzić inwestora, fizycznego projektu lub sesji, odmówić zapisu i obliczeń zależnych od niepotwierdzonego PCV, zamiast przełączać się potajemnie na legacy. Nie dopuszczać zapisu przypadkowego projektu, resetu sesji, starego RAM ani naruszenia rollbacku.
5. Zachować zatwierdzone pozostałe UI: panel edycji PCV krawędzi, odrębne opcje słojów, wszystkie inne elementy. **Nie wprowadzać żadnych nowych kontrolek i dialogów.**
6. Utrzymać dwa strumienie/stawki PCV, tylko jeden zapas 10%, zgodne metry między MATERIAŁ/ROZRYS/WYCENA, geometrię i referencję rozkroju 4/3/6. Nie zmieniać globalnych danych, stawek, katalogów, historii ofert ani przyszłego modelu dekorów.
7. Implementacja po osobnej komendzie „do dzieła” w Draft PR i testach, a następnie ręczne sprawdzenie na Androidzie.

## DO OMÓWIENIA — poza obecną poprawką
- Docelowa rola istniejącego przycisku „Przelicz projekt” po potwierdzeniu automatycznego odświeżania faktów pochodnych.
- Pełne dekor/kolor PCV oraz przyszły cennik i szczegóły słojów projektowych.
- Ewentualne nowości UI w procesie chmurowym — wymagają osobnej zgody.

## ODŁOŻONE
- Automatyczna zamiana producentów i systemów okuć w istniejących szafkach.
- Pełna synchronizacja chmurowa do czasu domknięcia niezbędnych granic danych oraz przeprowadzenia pilotażu.

# LOCAL-FIRST — plan rozwoju

Decyzje właściciela z 14.11.2026 oraz kontrakt P0-B z 16.11.2026. Status dotyczy wykonania i odbioru etapu. Opis celu i kryteriów dokumentuje zatwierdzoną koncepcję.

## Zasady obowiązujące we wszystkich etapach

- Belka **Zapisz / Anuluj / Wyjdź** zachowuje aktualne zachowanie i wygląd.
- Zapis lokalny działa niezależnie od powodzenia wysyłki do Firebase. Obowiązują kontrola uprawnień, CAS i blokada pojedynczego edytora.
- Sukces można pokazać po potwierdzeniu trwałego zapisu lokalnego.
- Komunikaty synchronizacji ograniczają się do informacji potrzebnych użytkownikowi. Rzeczywiste zagrożenia dla danych są widoczne.
- Historia zaakceptowanych ofert pozostaje zachowana w zwykłej pracy. Przy zatwierdzonym usunięciu inwestora P0-B kopie historyczne pozostają w backupach i technicznych rewizjach.
- Implementujemy po jednym etapie. Rozpoczęcie kolejnego etapu wymaga odrębnego zakresu.

## P0-A — trwałe szkice lokalne

**Status: PASS lokalnej weryfikacji P0-A.** Implementacja jest na gałęzi roboczej. Wyniki i bieżąca blokada są w [CURRENT_STATE](../../CURRENT_STATE.md#p0-a--trwałe-szkice-szafek).

**Cel.** Zatwierdzenie dodania, edycji lub usunięcia szafki zapisuje szkic w IndexedDB w obu trybach pracy. W trybie synchronizacji dopiero główne **Zapisz** zatwierdza projekt lokalnie i tworzy operację synchronizacji. **Anuluj** cofa zmiany od ostatniego zatwierdzenia. Restart odzyskuje szkic.

**Kryteria odbioru.** Pełna aplikacja Chromium potwierdza zapis szafek i wariantów do IndexedDB, brak zmian outboxa i rewizji Firestore podczas pracy ze szkicem, odtworzenie szkicu po restarcie i cofnięcie zmian. Główne **Zapisz** tworzy jedną operację, która po powrocie online otrzymuje ACK bez podwójnej publikacji. CAS i blokada drugiego edytora działają. Awaria transakcji zachowuje formularz i kod odmowy bez komunikatu sukcesu.

**Ryzyka.** Przedwczesna publikacja szkicu, utrata punktu cofnięcia, otwarcie drugiego edytora, ponowna publikacja po niepewnym ACK.

## P0-B — usuwanie inwestorów i wyłączność projektu

**Status: BLOCKED.** Kontrakt zatwierdzony przez właściciela 16.11.2026. Implementacja czeka na zatwierdzenie kontraktu danych, Rules i zgodności ze starszymi klientami. [Stan i dowody](../../CURRENT_STATE.md#p0-b--wyłączność-projektu-i-usuwanie-inwestorów-16112026).

**Wyłączność i dane wspólne.** Dany projekt może być otwarty na jednym urządzeniu. Różne projekty tego samego inwestora mogą być otwarte równocześnie na różnych urządzeniach. Każdy projekt zachowuje własną blokadę i CAS. Zapis projektu chroni pozostałe projekty i wspólną kartotekę inwestora. Edycja kartoteki musi sprawdzać niezależną rewizję danych wspólnych i zachować zmiany w razie konfliktu.

**Usuwanie i historia.** Zostają dotychczasowe podsumowanie i potwierdzenie, również dla wielu zaznaczonych inwestorów. Usunięcie obejmuje inwestorów z 0, 1 lub wieloma projektami i wymaga potwierdzenia bezpiecznego zwolnienia wszystkich ich projektów. Na każdym urządzeniu znika aktywna kartoteka wraz z projektami, pomieszczeniami, wycenami, szkicami i wszystkimi aktywnymi ofertami, także zaakceptowanymi. Historyczne kopie w starych backupach i technicznych rewizjach pozostają nienaruszone. Trwałe oznaczenie usunięcia musi obowiązywać przy odbiorze starej repliki, odtworzeniu backupu i ponowieniu wpisu kolejki.

**Bramka techniczna.** Potrzebne są autorytatywna rewizja kartoteki inwestora, kompletna informacja o jego projektach, trwałe oznaczenie usunięcia i znacznik potwierdzenia całej operacji. Weryfikacja zwolnienia projektów musi wykluczyć wyścig z ich otwarciem lub utworzeniem przed zatwierdzeniem. Rules muszą chronić te warunki także przed starszym klientem. Zgodność istniejących danych i starszych klientów wymaga osobnej decyzji przed wdrożeniem, w tym rozstrzygnięcia, czy potrzebna jest migracja. Kandydat z PR #133 wymagał jednego inwestora i jednego projektu, więc nie pokrywa zatwierdzonego zakresu.

**Kryteria odbioru.** Równoczesna edycja i zapis kuchni oraz garderoby tego samego inwestora, odmowa drugiego otwarcia tego samego projektu i bezpieczny konflikt edycji kartoteki. Usuwanie zestawów 0/1/N projektów oraz wielu zaznaczonych inwestorów. Drugi profil online i offline, restart, utrata ACK, konflikt CAS, odmowa przy zajętym projekcie, brak częściowego usunięcia i odtworzenia przez starszą replikę. Potwierdzenie zachowania kopii historycznych, pozostałych inwestorów i katalogów.

**Ryzyka.** Nadpisanie kartoteki starszą kopią, niepełna lista projektów, nowy edytor podczas usuwania, częściowa propagacja, utrata historii lub odtworzenie danych przez starszą wersję.

## P1 — inteligentna synchronizacja

**Status: PLAN.**

**Cel.** Grupować kolejne zatwierdzone zapisy. Wysyłać po 2 minutach bez nowego zapisu, najpóźniej po 5 minutach oczekiwania przy działającej aplikacji. Wcześniejsza próba przy wyjściu z pomieszczenia oraz ręczne **Synchronizuj teraz**.

**Kryteria odbioru.** Oba limity i oba wyzwalacze działają. Zamknięcie i restart zachowują zatwierdzone dane oraz kolejkę. Operacje `inflight` i `uncertain` oraz zaakceptowane, niezmienne oferty pozostają poza grupowaniem.

**Ryzyka.** Głodzenie kolejki przy kolejnych zapisach, utrata danych przy zamknięciu, duplikaty po niepewnym ACK, naruszenie historii ofert.

## P2 — wskaźnik synchronizacji

**Status: PLAN.**

**Cel.** Wskaźnik po **prawej stronie nazwy pomieszczenia**. Stany: **szkic lokalny**, **oczekuje**, **zsynchronizowano**, **wymaga uwagi**. Kliknięcie pokazuje szczegóły. Menu główne pokazuje status zbiorczy.

**Kryteria odbioru.** Wskaźnik odróżnia trwały szkic, operację w kolejce, potwierdzony ACK i stan wymagający działania. Inne urządzenia pokazują ostatnią potwierdzoną rewizję i ostatni znany stan edytora. Opis jednoznacznie wskazuje zakres wiedzy urządzenia o niewysłanych zmianach.

**Ryzyka.** Pozorny sukces, mylenie ostatniej znanej rewizji z bieżącą edycją, nadmiar komunikatów.

## Później — podgląd online dla klienta

**Status: PLAN.**

**Cel.** Odrębny podgląd projektu dla klienta, niezależny od trwałej synchronizacji.

**Kryteria odbioru.** Przed implementacją ustalić zakres udostępnianych danych i reguły dostępu. Podgląd nie zmienia szkicu, kolejki ani zaakceptowanych ofert.

**Ryzyka.** Ujawnienie roboczej rewizji lub danych właściciela, powiązanie podglądu z uprawnieniami edytora.

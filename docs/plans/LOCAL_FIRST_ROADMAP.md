# LOCAL-FIRST — plan rozwoju

Decyzje właściciela z 14.11.2026. Status dotyczy wykonania i odbioru etapu. Opis celu i kryteriów dokumentuje zatwierdzoną koncepcję.

## Zasady obowiązujące we wszystkich etapach

- Belka **Zapisz / Anuluj / Wyjdź** zachowuje aktualne zachowanie i wygląd.
- Zapis lokalny działa niezależnie od powodzenia wysyłki do Firebase. Obowiązują kontrola uprawnień, CAS i blokada pojedynczego edytora.
- Sukces można pokazać po potwierdzeniu trwałego zapisu lokalnego.
- Komunikaty synchronizacji ograniczają się do informacji potrzebnych użytkownikowi. Rzeczywiste zagrożenia dla danych są widoczne.
- Historia zaakceptowanych ofert pozostaje zachowana.
- Implementujemy po jednym etapie. Rozpoczęcie kolejnego etapu wymaga odrębnego zakresu.

## P0-A — trwałe szkice lokalne

**Status: PASS lokalnej weryfikacji P0-A.** Implementacja jest na gałęzi roboczej. Wyniki i bieżąca blokada są w [CURRENT_STATE](../../CURRENT_STATE.md#p0-a--trwałe-szkice-szafek).

**Cel.** Zatwierdzenie dodania, edycji lub usunięcia szafki zapisuje szkic w IndexedDB w obu trybach pracy. W trybie synchronizacji dopiero główne **Zapisz** zatwierdza projekt lokalnie i tworzy operację synchronizacji. **Anuluj** cofa zmiany od ostatniego zatwierdzenia. Restart odzyskuje szkic.

**Kryteria odbioru.** Pełna aplikacja Chromium potwierdza zapis szafek i wariantów do IndexedDB, brak zmian outboxa i rewizji Firestore podczas pracy ze szkicem, odtworzenie szkicu po restarcie i cofnięcie zmian. Główne **Zapisz** tworzy jedną operację, która po powrocie online otrzymuje ACK bez podwójnej publikacji. CAS i blokada drugiego edytora działają. Awaria transakcji zachowuje formularz i kod odmowy bez komunikatu sukcesu.

**Ryzyka.** Przedwczesna publikacja szkicu, utrata punktu cofnięcia, otwarcie drugiego edytora, ponowna publikacja po niepewnym ACK.

## P0-B — usuwanie inwestorów w synchronizacji

**Status: PLAN.**

**Cel.** Osobno naprawić usuwanie inwestorów w trybie synchronizacji. Wybrać wymagane zmiany z PR #133 po przeglądzie zakresu. Bez automatycznego scalenia całego PR.

**Kryteria odbioru.** Zatwierdzone usunięcie propaguje się między urządzeniami, zachowuje historię oraz respektuje CAS i blokady edytora. Przerwanie albo konflikt pozostawia stan możliwy do odzyskania, a ponowienie jest bezpieczne.

**Ryzyka.** Utrata historii, odtworzenie usuniętego rekordu ze starej repliki, nadpisanie cudzej edycji.

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

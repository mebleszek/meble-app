# PR #136 — naprawa trzech niezaliczonych zadań Preflight

BASE `6099fa0fdd116582e9d1f8979db1cd12a3c46df4`. [Pierwsza próba](https://github.com/mebleszek/meble-app/actions/runs/43493997569).

- Scheduler zachowuje oczekujące zakresy po offline. Równoległy ręczny flush lub zdarzenie online wznawia cykl. Przed wysyłką obowiązuje `LF_OFFLINE`, po niepewnej wysyłce pozostaje błąd transportu i odczyt potwierdzający. PASS `local-first-crash-smoke.js` w WSL z Chromium.
- Zdarzenie online wybudza discovery niezależnie od synchronizacji wskazanego zakresu. PASS startup 9/9.
- Wstępna kontrola limitu identyfikuje fazę kontekstu Auth po weryfikacji tożsamości. PASS Auth 40/40 i diagnostyka 9/9.
- Emulator potwierdził CLOUD-SYNC-1 08 po przerwaniu między zatwierdzoną porcją trzech rekordów a CAS. Brak głowy i rewizji, brak przyjęcia niekompletnego katalogu.
- Synchronizator usuwa własne listenery i czeka na aktywny cykl. Kanały zamyka wyłącznie właściciel. Pełny runtime buduje nowe kanały przy wznowieniu, a testowe kompozycje mogą ponownie użyć pożyczonych kanałów. Zakończenie trwałej sesji wybudza odroczony odczyt. PASS LOCAL-FIRST 8/8, w tym utrata ACK i SIGKILL bez ponownej publikacji. PASS automatycznej replikacji dwóch profili, w tym konflikt edytora, chroniona edycja, odroczony odczyt i offline outbox.

Celowane testy granicy produkcyjnej 10/10 oraz CAS, ACK i backoff PASS. Pełny Preflight oczekuje osobnej zgody.

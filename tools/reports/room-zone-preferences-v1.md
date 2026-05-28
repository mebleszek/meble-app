# room-zone-preferences-v1 — 2026-05-16

Baza: `site_000_program_defaults_rozrys_sync_v1.zip`.

Zakres:
- Ustawienia globalne w trybiku: akordeony `Materiały` i `Okucia` są domyślnie zwinięte.
- `room.preferences` przechodzi na model strefowy:
  - `lower` — strefa dolna / stojące,
  - `middle` — strefa środkowa / moduły,
  - `upper` — strefa górna / wiszące.
- W WYWIADZIE nie ma sekcji „Domyślne”. Fallback użytkownika pozostaje globalny w trybiku (`fc_program_defaults_v1`).
- Preferencje strefowe obejmują: korpus, materiał frontu, kolor frontu, plecy i otwieranie.
- Standard wykończenia i standard blend zostały jako ogólne standardy pomieszczenia, nie jako domyślne materiały.
- UI preferencji w WYWIADZIE używa aplikacyjnych launcherów ROZRYS, bez natywnych pickerów telefonu.
- Nowa szafka po wyborze typu kopiuje ostatnią szafkę tego samego typu: stojącą, moduł albo wiszącą. Jeżeli nie ma poprzednika danego typu, bierze preferencje odpowiedniej strefy, potem globalne domyślne z trybiku, a na końcu awaryjne fallbacki programu.

Nietknięte:
- PRO100,
- usługi stolarskie,
- ROZRYS,
- WYCENA,
- hurtowa zmiana istniejących szafek,
- fronty łączone/wieloczęściowe,
- zamiana producentów okuć.

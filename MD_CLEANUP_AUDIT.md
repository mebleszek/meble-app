# Audyt dokumentacji Markdown — 30.10.2026

Na zweryfikowanym main przed porządkowaniem było **303 pliki .md**: 16 w katalogu głównym, 286 w tools/ i 1 w docs/. To migawka, nie aktualizowany automatycznie licznik.

## Nowa struktura

- [CURRENT_STATE.md](CURRENT_STATE.md) — jedno kanoniczne źródło statusu wykonania, dowodów, blokerów i następnego ruchu.
- [AGENTS.md](AGENTS.md) — obowiązek aktualizacji i kontroli GitHuba; [ROADMAP.md](ROADMAP.md) — plan przyszły.
- [README.md](README.md) i [DEV.md](DEV.md) — krótkie wejścia; pełne dawne historie przeniesiono bezstratnie do [docs/archive/](docs/archive/).
- CLOUD_MIGRATION, CLOUD_DATA_REGISTER, BACKUP i QUOTE_CALCULATION_REGISTER — wiążące kontrakty. TEST_BASELINE, PREFLIGHT, DEPENDENCY_MAP — kontrola techniczna.
- tools/reports i docs/archive — historyczne dowody, **nie nowa kolejka zadań**.

## Kandydaci do usunięcia/przeniesienia — tylko propozycje, nie zgoda

1. **DEV_HISTORY_20260425.md** — ok. 250 KB historycznego dziennika; przenieść do docs/archive po sprawdzeniu odnośników.
2. **OPTIMIZATION_PLAN.md** — częściowo historyczne pomysły, ale zawiera nierozstrzygnięte założenia; po rozdzieleniu przenieść starszą część do archiwum.
3. **MD_CLEANUP_AUDIT.md** — jednorazowy audyt; po zamknięciu prac rozważyć archiwizację.
4. **PREFLIGHT.md** — krótka instrukcja, możliwa do połączenia z TEST_BASELINE po sprawdzeniu linków.

Nie usuwać bez osobnej zgody żadnych raportów, norm, planów nierozstrzygniętych ani kontraktów bezpieczeństwa. W tym pakiecie **nic nie usunięto**. Bez zmian kodu, workflow, LIVE, PR Ready i wydania.

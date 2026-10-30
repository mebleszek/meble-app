# Meble-App

Aplikacja do obsługi inwestorów, projektów mebli na wymiar, pomieszczeń, wywiadu, materiałów, rysunku, czynności, wyceny i rozrysu. Docelowo ma obsługiwać bezstratną pracę offline i bezpieczną synchronizację jednego aktywnego edytora.

> **Zawsze zaczynaj od [CURRENT_STATE.md](CURRENT_STATE.md)** i [AGENTS.md](AGENTS.md), następnie porównaj dokumentację z rzeczywistym stanem GitHuba. Stara kronika nie dowodzi aktualnego wydania.

## Mapa dokumentów

- [CURRENT_STATE.md](CURRENT_STATE.md) — zakończone kroki, dowody, blokery i jeden następny ruch
- [AGENTS.md](AGENTS.md) — podział ról i bramki zgód
- [ROADMAP.md](ROADMAP.md) — plan przyszłych prac
- [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md), [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md), [BACKUP.md](BACKUP.md) — kontrakty danych, chmury i odzyskiwania
- [QUOTE_CALCULATION_REGISTER.md](QUOTE_CALCULATION_REGISTER.md) — uzgodnione zasady wyceny
- [TEST_BASELINE.md](TEST_BASELINE.md), [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md), [PREFLIGHT.md](PREFLIGHT.md) — testy i wpływ zmian
- [DEV.md](DEV.md), [tools/reports/](tools/reports/) — workflow i szczegółowe dowody

Wydaniowy CI należy do GitHub Actions. Akceptacja fizycznego Androida jest osobna. Firebase LIVE, publikacja Rules, granty, billing, migracje i realne zapisy wymagają oddzielnych decyzji; sama obecność modułów LOCAL-FIRST nie uruchamia synchronizacji.

**Pełny dawny README zachowano w [docs/archive/README_history_to_20261030.md](docs/archive/README_history_to_20261030.md).**

## Regresje cennika

Pakiet `site_pricing_modes_auto_tests_v1.zip` opisuje testy trybów naliczania cen: kwoty startowe, jednostki, czas i progi. Obowiązkowy Preflight uruchamia `tools/pricing-modes-calculation-coverage-smoke.js`; zasady obliczeń pozostają w QUOTE_CALCULATION_REGISTER.md, pełna historia w archiwum README.

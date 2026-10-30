# DEV — workflow projektu

Ten plik nie jest bieżącym dziennikiem wydań. **Jedynym rejestrem stanu wykonania jest [CURRENT_STATE.md](CURRENT_STATE.md).** Zasady: [AGENTS.md](AGENTS.md).

1. Przed pracą przeczytaj aktualny stan, plan i kontrakt, a następnie sprawdź rzeczywisty main/PR/CI/Pages.
2. Codex implementuje wyłącznie zatwierdzone zakresy, na gałęzi z testami i raportem. Pełne CI jest wykonywane przez GitHub Actions, nie dublowane lokalnie.
3. Osobne zgody obowiązują na próbę wydania dla konkretnego HEAD/BASE oraz na każdy wymagany etap produkcyjnego Firebase LIVE.
4. Po wykonanym, zatwierdzonym kroku uaktualnij CURRENT_STATE z datą, SHA, dowodami, blokerami i jednym następnym ruchem.

Dokumentacja: [ROADMAP.md](ROADMAP.md), [TEST_BASELINE.md](TEST_BASELINE.md), [PREFLIGHT.md](PREFLIGHT.md), [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md), [QUOTE_CALCULATION_REGISTER.md](QUOTE_CALCULATION_REGISTER.md), [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md), [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md), [BACKUP.md](BACKUP.md).

**Pełny wcześniejszy DEV zachowano w [docs/archive/DEV_history_to_20261030.md](docs/archive/DEV_history_to_20261030.md)**, starszy kwietniowy dziennik w [DEV_HISTORY_20260425.md](DEV_HISTORY_20260425.md).

# DEV — workflow projektu

Ten plik nie jest bieżącym dziennikiem wydań. **Jedynym rejestrem stanu wykonania jest [CURRENT_STATE.md](CURRENT_STATE.md).** Zasady: [AGENTS.md](AGENTS.md).

1. Przed pracą przeczytaj aktualny stan, plan i kontrakt, a następnie sprawdź rzeczywisty main/PR/CI/Pages.
2. Codex implementuje wyłącznie zatwierdzone zakresy, na gałęzi z testami i raportem. Pełne CI jest wykonywane przez GitHub Actions, nie dublowane lokalnie.
3. Osobne zgody obowiązują na próbę wydania dla konkretnego HEAD/BASE oraz na każdy wymagany etap produkcyjnego Firebase LIVE.
4. Po wykonanym, zatwierdzonym kroku uaktualnij CURRENT_STATE z datą, SHA, dowodami, blokerami i jednym następnym ruchem.

Dokumentacja: [ROADMAP.md](ROADMAP.md), [TEST_BASELINE.md](TEST_BASELINE.md), [PREFLIGHT.md](PREFLIGHT.md), [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md), [QUOTE_CALCULATION_REGISTER.md](QUOTE_CALCULATION_REGISTER.md), [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md), [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md), [BACKUP.md](BACKUP.md).

**Pełny wcześniejszy DEV zachowano w [docs/archive/DEV_history_to_20261030.md](docs/archive/DEV_history_to_20261030.md)**, starszy kwietniowy dziennik w [DEV_HISTORY_20260425.md](DEV_HISTORY_20260425.md).

## Kontrakty regresji interfejsu i cennika

**Podgląd oferty klienta — usługi w cenie v3** korzysta z zamrożonego `clientOffer`, zachowuje usługi zawarte w cenie i nie przelicza historycznej oferty z bieżących danych. Kontrola: `tools/client-offer-preview-smoke.js` w obowiązkowym Preflight.

Testy trybów naliczania (`site_pricing_modes_auto_tests_v1.zip`) obejmują kwoty startowe, jednostki, czas, progi i transport; wykonuje je `tools/pricing-modes-calculation-coverage-smoke.js` w obowiązkowym Preflight. Szczegóły historyczne pozostają w archiwum DEV.

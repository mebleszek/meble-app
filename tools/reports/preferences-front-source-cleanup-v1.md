# preferences-front-source-cleanup-v1 — 2026-05-17

## Baza

- Start: `site_000_fridge_set_material_cleanup_v1.zip`.
- Cel: Etap 1C.2 — uporządkowanie fundamentu preferencji strefowych i źródeł materiału frontu przed hurtową zmianą.

## Zakres wykonany

1. Dodano centralny resolver materiałów strefowych w `js/app/room-preferences/room-preferences-model.js`:
   - `resolveZoneDefaults(room, zoneOrType, fallback)`,
   - `resolveZoneFrontMaterial(room, zoneOrType, fallback)`,
   - `applyZoneDefaultsToDraft(room, draft, zoneOrType)`.
2. Resolver utrzymuje kolejność:
   - strefa pomieszczenia,
   - globalne domyślne z trybiku,
   - awaryjny fallback programu.
3. Nowy draft szafki używa centralnego resolvera zamiast osobno wywoływać globalne domyślne i preferencje pokoju.
4. Zestaw nadal startuje z dolnej strefy, ale przez ten sam resolver, a nie przez osobną kopię logiki.
5. Źródło materiału frontu dla lodówki/zestawu pobiera materiał strefowy przez centralny resolver frontu.
6. Dodano testy:
   - browser/dev suite w `js/testing/cabinet/tests.js`,
   - szybkie kontrakty Node w `tools/app-dev-smoke.js`.

## Ograniczenia świadome

- Nie robiono hurtowej zmiany istniejących szafek.
- Nie dodawano frontów wieloczęściowych.
- Nie ruszano PRO100, usług, WYCENY, ROZRYS ani backup policy.
- `cabinet-modal-set-wizard.js` nadal jest dużym plikiem historycznym; w tej paczce zmieniono tylko małą ścieżkę domyślnych zestawu. Pełny split set-wizarda zostaje osobnym etapem, gdy będzie realna potrzeba.

## Testy

- `node --check` dla nowych/zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 89/89 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — OK.
- `node tools/dependency-source-audit.js` — OK.
- `node tools/wycena-architecture-audit.js` — OK.
- `node tools/hardware-accessories-dev-smoke.js` — 39/39 OK.
- `node tools/hardware-import-export-deep-smoke.js` — 18/18 OK.
- `node tools/service-pro100-dev-smoke.js` — 18/18 OK.

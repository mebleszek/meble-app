# Fronty i zawiasy zestawów w MATERIAŁACH v1

Paczka: `site_set_fronts_material_hinges_fix_v1.zip`
Cache-busting: `20260605_set_fronts_material_hinges_fix_v1`

## Zakres

- Naprawiono ścieżkę zestawów w MATERIAŁACH po zmianach liczenia zawiasów w kg.
- `getRoomSetFronts()` zwraca zapisane fronty zestawu, a jeżeli ich nie ma, odtwarza je z rekordu `sets` dla presetów A/C/D.
- `getCabinetFrontCutListForMaterials()` i `getDoorFrontPanelsForHinges()` korzystają z tego samego źródła frontów zestawu.
- Korpus prowadzący zestawu dostaje fronty i zawiasy; korpusy nieprowadzące nie dublują tych pozycji.

## Testy

- `node tools/cabinet-hinge-quantity-kg-smoke.js`
- `node tools/cabinet-set-material-cutlist-smoke.js`
- `node tools/cabinet-hinge-tipon-spring-smoke.js`
- `node tools/cabinet-hardware-requirements-live-edit-smoke.js`
- `node tools/wycena-hinge-requirement-override-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`

## Poza zakresem

Nie zmieniano UI, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani snapshotów ofert.

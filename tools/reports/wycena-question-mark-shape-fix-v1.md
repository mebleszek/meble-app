## 2026-06-04 — Poprawka kształtu helperów `?` w WYCENIE v1

- Paczka: `site_wycena_question_mark_shape_fix_v1.zip`.
- Poprawiono wyłącznie wygląd ikon `?` w sekcji wyboru zakresu WYCENY. WYCENA używa układu ROZRYS (`panel-box--rozrys` / `rozrys-selection-grid`), przez co przycisk helpera rozciągał się do prostokąta w rzędzie formularza.
- Dodano bardzo wąsko ograniczoną regułę CSS dla `.quote-selection-grid .label-help .info-trigger`, żeby helper zachował okrągły rozmiar 28×28 px jak w działającym modalu okuć.
- Nie zmieniano logiki helperów, treści opisów, WYCENY, duplikatów okuć, zapisu override zawiasów, PRO100, ROZRYS, backupów, PCV/obrzeży ani import/export Excel.
- Cache-busting: `20260604_wycena_qmark_shape_fix_v1`. Raport: `tools/reports/wycena-question-mark-shape-fix-v1.md`.


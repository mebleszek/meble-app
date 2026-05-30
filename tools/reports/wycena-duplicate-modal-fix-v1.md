# WYCENA duplicate modal fix v1 — 2026-05-30

## Baza

Start: `site_wycena_duplicate_offer_guard_v1.zip`.

## Problem

Guard identycznych ofert działał częściowo: nie tworzył kolejnego snapshotu, tylko przełączał/podświetlał istniejącą ofertę, ale użytkownik nie dostawał modala z decyzją `Zamień istniejącą` / `Anuluj`.

## Zmiany

- `wycena-tab-shell.js` dostał dedykowany helper `askDuplicateDecision()`.
- Przy duplikacie helper najpierw używa aplikacyjnego `FC.choiceBox.ask()`, potem `FC.confirmBox.ask()`, a dopiero na końcu `deps.askConfirm()` jako fallback.
- Jeżeli żaden modal nie jest dostępny, decyzja jest bezpieczna: `cancel`, bez automatycznej zamiany istniejącej oferty.
- Diagnostyka zapisuje `duplicateModalShown`, `duplicateModalDecision`, `duplicateModalError` i `duplicateModalUnavailable`.
- Test `tools/wycena-duplicate-offer-guard-smoke.js` sprawdza, że duplikat wywołuje modal z przyciskami `Anuluj` i `Zamień istniejącą`.

## Poza zakresem

Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.

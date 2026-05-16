# Deploy unzip workflow fix v1 — 2026-05-16

## Cel

Naprawa rozpakowywania paczek `site*.zip` w GitHub Actions po sytuacji, w której GitHub Pages budował stary `index.html`, mimo wgrania poprawnej paczki ZIP.

## Problem

Dotychczasowy workflow wybierał ZIP przez `ls -1t site*.zip | head -n 1`. W środowisku `actions/checkout` czasy plików po checkout mogą być jednakowe albo nie odpowiadać kolejności uploadu. Przy kilku plikach `site*.zip` mogło to wybrać niewłaściwą, starszą paczkę.

Dodatkowo workflow nie kopiował dotfile/dotfolderów z paczki przy deployu, więc `.github` z ZIP-a nie aktualizował workflow.

## Zmiany

- `unzip-site-to-root.yml` uruchamia się na każdy push do `main` oraz ręcznie przez `workflow_dispatch`.
- Workflow wybiera najpierw ZIP zmieniony w bieżącym commicie (`git diff-tree`), zamiast zgadywać po czasie pliku.
- Fallback przy ręcznym uruchomieniu wybiera plik `site*.zip` z roota repo po sortowaniu nazw.
- Rozpakowywanie i flatten kopiują również dotfiles/dotfolders.
- Deploy aktualizuje `.github`, jeżeli paczka zawiera `.github`, więc przyszłe poprawki workflow mogą wejść razem z pełną paczką.
- Jeżeli paczka nie ma `.github`, stary katalog `.github` zostaje zachowany.

## Zakres funkcjonalny

Nie zmieniono runtime aplikacji, UI, danych projektu, PRO100, ROZRYS-u, WYCENY ani katalogu okuć. To poprawka mechanizmu wdrożenia.

## Uwagi wdrożeniowe

Jeżeli w repo działa jeszcze stary workflow, sama paczka ZIP może zaktualizować stronę, ale może nie zaktualizować workflow, bo stary workflow nie kopiuje `.github` z ZIP-a. Stała naprawa wymaga, aby poprawiony `.github/workflows/unzip-site-to-root.yml` trafił do repo przynajmniej raz.

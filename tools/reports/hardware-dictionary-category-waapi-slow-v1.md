# Hardware dictionary category WAAPI slow v1

Baza: `site_hardware_dictionary_category_waapi_open_v1.zip`.

Zakres:
- spowolniono tylko animację otwierania panelu `Kategorie / rodzaje okuć`,
- `SECTION_EXPAND_MS` ustawiono na 820 ms, niezależnie od `PARAM_EXPAND_MS`,
- pozostawiono Web Animations API i pomiar realnej wysokości przez `categoriesBody.scrollHeight`,
- zamykanie panelu kategorii nadal jest natychmiastowe,
- mini-akordeony parametrów technicznych nie zostały zmienione.

Nie ruszano:
- danych, storage, backupów, import/export Excel, zamienników, PRO100, usług, ROZRYS, RYSUNKU, WYCENY.

Testy:
- `app-dev-smoke` pilnuje, że panel kategorii ma osobny, wolniejszy czas `SECTION_EXPAND_MS = 820` i nie wraca do czasu `PARAM_EXPAND_MS`.

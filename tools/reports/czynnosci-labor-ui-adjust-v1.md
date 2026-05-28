# czynnosci labor UI adjust v1

Baza: `site_czynnosci_labor_workspace_v1.zip`.

Zakres:

- Przeniesiono sekcję robocizny w modalu szafki pod podstawowe dane, wymiary i materiały.
- Picker `Dodaj czynności` używa standardowego `FC.panelBox` / `panel-box--rozrys`.
- Wybór `Z montażem` / `Bez montażu` jest teraz wzajemnie wykluczającym się chipem z checkboxem/ptaszkiem w stylu ROZRYS.

Zmiana jest UI-only: nie zmienia storage, modelu danych, PDF klienta ani logiki wyceny poza sposobem obsługi/pokazania kontrolek.

Testy: `app-dev-smoke` ma dodatkowe kontrakty dla panelBox pickera, kolejności sekcji w modalu szafki i chipów montażu AGD.

# Raport: site_labor_gabaryt_label_v1

Zakres: kosmetyczna zmiana nazwy pola w formularzu **Cennik robocizny i usług**.

Zmiany:
- etykieta pola `laborVolumePricePerM3` zmieniona z **Gabaryt zł/m³** na **Dopłata zł za gabaryt**,
- opis pod ikoną `?` używa tej samej, prostszej nazwy,
- komunikat blokady pola przy aktywnym gabarytoczasie mówi o dopłacie zł za gabaryt.

Nie zmieniono logiki liczenia: dopłata pieniężna za gabaryt nadal wyklucza się z gabarytoczasem, a `volumePricePerM3` pozostaje technicznym polem danych.

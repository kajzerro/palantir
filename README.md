# SENTINEL-CI · demo wykrywania anomalii CCTV (kopalnia węgla)

Klikalne demo konsoli operacyjnej w stylu Palantira dla infrastruktury
krytycznej: warstwa AI obserwuje CCTV kopalni, wykrywa niebezpieczne wzorce,
alarmuje operatora ochrony i prowadzi go przez obowiązkową procedurę.

Bez kroku budowania, bez zależności – czysty HTML / CSS / JS.

## Uruchomienie

```bash
# dowolny serwer statyczny; z katalogu repozytorium:
python3 -m http.server 8080
# otwórz http://localhost:8080
```

Otwarcie `index.html` bezpośrednio z dysku też działa w Chrome/Edge/Firefox.

## Układ

| Panel | Co robi |
|---|---|
| **Lewy – terminal operacyjny** | Terminal w formie czatu. Każda wiadomość SENTINELA wymagająca decyzji ma numerowane, klikalne opcje. Można też wpisywać polecenia (`pomoc`, `status`, `kamery`, `kamera 8`, `dalej`, `auto`, `procedura`, `dziennik`, `wyczyść`) albo odpowiadać numerem opcji. |
| **Prawy górny – cyfrowy bliźniak** | Model 3D kopalni w rzucie z lotu ptaka: powierzchnia (kratownicowa wieża szybowa, zakład przeróbczy z silosami, osadniki, kotłownia, rozdzielnia, lampownia, parking, tory z wagonami, stacja wentylatorów), poziom −300 m i poziom −500 m ułożone jeden pod drugim (widok rozstrzelony) z przekopami w obudowie łukowej, torami, ścianami z sekcjami obudowy i kombajnem, chodnikami przyścianowymi, przodkiem, pompownią, komorą MW, stacją odmetanowania, komorą ratunkową, tamami wentylacyjnymi, przepływem powietrza, jeżdżącą klatką w szybie, lokomotywą i przemieszczającą się załogą. Kółko myszy przybliża, przeciąganie przesuwa, kliknięcie poziomu w panelu bocznym przybliża ten poziom. Każdy punkt to kamera CCTV. Kliknięcie otwiera ją na podglądzie. Punkty **pulsują na czerwono** przy anomalii, są **pomarańczowe** w trakcie procedury, **szare** gdy offline. Panel boczny pozwala wyróżnić jeden poziom. |
| **Prawy dolny – podgląd na żywo** | Odtwarza wideo wybranej kamery z ramkami detekcji AI, listą detekcji, metadanymi kamery i listą ostatnich zdarzeń. Do czasu dodania pliku wideo pokazuje animowaną planszę BRAK SYGNAŁU. |

## Przebieg demo

1. Naciśnij **NASTĘPNE ZDARZENIE** (lub wpisz `dalej`) – wywołuje kolejną
   zaplanowaną anomalię: punkt kamery miga na czerwono, podgląd przełącza się
   na tę kamerę z ramkami, terminal wypisuje ALARM i pyta *co chcesz zrobić dalej?*
2. Opcje: potwierdź anomalię, poproś o szczegółową analizę AI, obserwuj dalej
   (ponowny alarm po 20 s) lub oznacz jako fałszywy alarm.
3. Po potwierdzeniu SENTINEL otwiera właściwą procedurę (np.
   `PROC-POZ-02 Pożar przenośnika taśmowego`), pokazuje całą listę kontrolną
   i pyta o każdy krok po kolei (**Wykonano** / **Niemożliwe – zgłoś odstępstwo** / **Pokaż całą procedurę**).
   Między krokami pojawiają się zaplanowane aktualizacje (odczyty CO, potwierdzenia załogi, czas dojazdu ratowników).
4. Po potwierdzeniu ostatniego kroku zdarzenie jest zamykane, nadawany jest
   numer raportu, a kamera wraca do stanu nominalnego.
5. **AUTO** odtwarza cały scenariusz samoczynnie (kolejne zdarzenie ok. 10 s
   po zamknięciu poprzedniego).

Zaplanowane zdarzenia, w kolejności:

| # | Kamera | Poziom | Wzorzec |
|---|---|---|---|
| ZD-01 | KAM-02 Lampownia | NISKI | Pracownik bez aparatu ucieczkowego idzie na nadszybie |
| ZD-02 | KAM-10 Komora MW | WYSOKI | Osoba bez uprawnień, drzwi otwarte poza oknem strzałowym |
| ZD-03 | KAM-08 Pochylnia taśmowa | KRYTYCZNY | Dym + punkt gorący na taśmie, taśma nadal pracuje |
| ZD-04 | KAM-12 Ściana W-7 | KRYTYCZNY | Nieruchomy pracownik na trasie kombajnu, rośnie CH₄ |
| ZD-05 | KAM-01 Brama główna | WYSOKI | Naruszenie perymetru, pojazd bez tablic |
| ZD-06 | KAM-05 Wentylator główny | WYSOKI | Porzucony przedmiot przy czerpni |
| ZD-07 | KAM-06 Podszybie −300 | ŚREDNI | Osoba pod zawieszonym ładunkiem |

## Dodawanie własnych nagrań

Wrzuć pliki do `videos/` – nic więcej nie trzeba zmieniać:

| Plik | Użycie |
|---|---|
| `videos/cam-01.mp4` … `videos/cam-13.mp4` | Pętla bezczynności każdej kamery (otwieranej z modelu 3D) |
| `videos/inc-01-ppe.mp4` | ZD-01 na KAM-02 |
| `videos/inc-02-magazine.mp4` | ZD-02 na KAM-10 |
| `videos/inc-03-conveyor-fire.mp4` | ZD-03 na KAM-08 |
| `videos/inc-04-worker-down.mp4` | ZD-04 na KAM-12 |
| `videos/inc-05-perimeter.mp4` | ZD-05 na KAM-01 |
| `videos/inc-06-object.mp4` | ZD-06 na KAM-05 |
| `videos/inc-07-loading-zone.mp4` | ZD-07 na KAM-06 |

MP4 (H.264) lub WebM. Wideo odtwarza się automatycznie, wyciszone, w pętli.
Gdy brakuje klipu zdarzenia, używana jest pętla kamery; gdy brakuje i jej,
plansza BRAK SYGNAŁU podaje oczekiwaną ścieżkę.

Wszystkie ścieżki, kamery, zdarzenia, ramki detekcji (`boxes`, w % kadru),
procedury i gotowe odpowiedzi czatu są w `js/data.js`. Pozycje kamer na modelu
(`level`, `x`, `y`, `dir`) są we współrzędnych planu obiektu (0–520 × 0–200);
projekcja 3D jest liczona w `js/app.js` (funkcja `P`).

/* ==========================================================================
   SENTINEL-CI – dane demonstracyjne
   --------------------------------------------------------------------------
   Wszystko, co zaplanowane, jest tutaj: kamery (z plikami wideo), scenariusze
   anomalii „wykrywanych” przez AI, opcje decyzyjne dla operatora oraz
   procedury, które operator musi wykonać.

   WIDEO
   -----
   Każda kamera ma ścieżkę `video`. Umieść tam swój plik (mp4 / webm, zalecany
   H.264), a odtworzy się po otwarciu kamery. Każde zdarzenie może mieć własne
   `video` – gdy anomalia zostanie wykryta, podgląd przełącza się na ten klip
   zamiast pętli bezczynności kamery. Brakujące pliki pokazują planszę
   BRAK SYGNAŁU, więc wideo można dodawać po kolei.

   POZYCJE NA MODELU 3D
   --------------------
   `level`: 0 = powierzchnia, 1 = poziom −300 m, 2 = poziom −500 m
   (1.5 = pochylnia między poziomami). `x`, `y` – współrzędne planu obiektu
   (0–520 × 0–200), `dir` – kierunek patrzenia kamery w stopniach
   (0 = wschód / w prawo, 90 = południe / w dół planu).
   ========================================================================== */

window.MINE_DATA = (function () {

  const cameras = [
    { id: "KAM-01", name: "Brama główna",                    zone: "Powierzchnia · Perymetr",          level: 0,   x: 40,  y: 166, dir: 300,  type: "PTZ 4K · LPR",          video: "videos/cam-01.mp4" },
    { id: "KAM-02", name: "Lampownia / Łaźnia",              zone: "Powierzchnia · Ruch załogi",       level: 0,   x: 184, y: 150, dir: 200, type: "Kopułkowa 4K",          video: "videos/cam-02.mp4" },
    { id: "KAM-03", name: "Nadszybie szybu I",               zone: "Powierzchnia · Wieża wyciągowa",   level: 0,   x: 284, y: 68,  dir: 200, type: "Tubowa 4K · Ex-d",      video: "videos/cam-03.mp4" },
    { id: "KAM-04", name: "Zakład przeróbczy · hala 1",      zone: "Powierzchnia · Przeróbka",         level: 0,   x: 442, y: 94,  dir: 220, type: "Termowizja + RGB",      video: "videos/cam-04.mp4" },
    { id: "KAM-05", name: "Stacja wentylatorów głównych",    zone: "Powierzchnia · Wentylacja",        level: 0,   x: 486, y: 150, dir: 200, type: "Kopułkowa 4K",          video: "videos/cam-05.mp4" },
    { id: "KAM-06", name: "Podszybie −300",                  zone: "Poziom −300 · Szyb I",             level: 1,   x: 254, y: 92,  dir: 0,  type: "Ex-d IP67 · IR",        video: "videos/cam-06.mp4" },
    { id: "KAM-07", name: "Ściana L-12 · front",             zone: "Poziom −300 · Pokład 405/1",       level: 1,   x: 150, y: 92,  dir: 180, type: "Ex-d IP67 · IR",        video: "videos/cam-07.mp4" },
    { id: "KAM-08", name: "Pochylnia taśmowa P-2",           zone: "Pochylnia −300 → −500",            level: 1.5, x: 311, y: 108, dir: 200, type: "Termowizja + RGB Ex-d", video: "videos/cam-08.mp4" },
    { id: "KAM-09", name: "Podszybie −500",                  zone: "Poziom −500 · Szyb I",             level: 2,   x: 282, y: 92,  dir: 180,  type: "Ex-d IP67 · IR",        video: "videos/cam-09.mp4" },
    { id: "KAM-10", name: "Komora materiałów wybuchowych",   zone: "Poziom −500 · Strefa zastrzeżona", level: 2,   x: 170, y: 118, dir: 180, type: "Ex-d IP67 · IR",        video: "videos/cam-10.mp4" },
    { id: "KAM-11", name: "Stacja odmetanowania",            zone: "Poziom −500 · Instalacja gazowa",  level: 2,   x: 296, y: 118, dir: 0,   type: "Ex-d IP67 · IR",        video: "videos/cam-11.mp4" },
    { id: "KAM-12", name: "Ściana W-7 · front",              zone: "Poziom −500 · Pokład 510",         level: 2,   x: 404, y: 92,  dir: 0,   type: "Ex-d IP67 · IR",        video: "videos/cam-12.mp4" },
    { id: "KAM-13", name: "Komora ratunkowa KR-2",           zone: "Poziom −500 · Bezpieczeństwo",     level: 2,   x: 418, y: 118, dir: 180, type: "Ex-d · IR",             video: "videos/cam-13.mp4", offline: true },
    { id: "KAM-14", name: "Parking · wjazd",                 zone: "Powierzchnia · Perymetr",          level: 0,   x: 48,  y: 164, dir: 20,  type: "Kopułkowa 4K",          video: "videos/cam-14.mp4" },
    { id: "KAM-15", name: "Administracja · wejście",         zone: "Powierzchnia · Biura",             level: 0,   x: 100, y: 47,  dir: 70,  type: "Kopułkowa 4K",          video: "videos/cam-15.mp4" },
    { id: "KAM-16", name: "Rozdzielnia 110/6 kV",            zone: "Powierzchnia · Energetyka",        level: 0,   x: 158, y: 88,  dir: 320, type: "Termowizja + RGB",      video: "videos/cam-16.mp4" },
    { id: "KAM-17", name: "Kotłownia · plac",                zone: "Powierzchnia · Zaplecze",          level: 0,   x: 222, y: 42,  dir: 200, type: "Tubowa 4K",             video: "videos/cam-17.mp4" },
    { id: "KAM-18", name: "Składowisko węgla",               zone: "Powierzchnia · Składowisko",       level: 0,   x: 336, y: 168, dir: 20,  type: "PTZ 4K · termowizja",   video: "videos/cam-18.mp4" },
    { id: "KAM-19", name: "Osadniki",                        zone: "Powierzchnia · Gospodarka wodna",  level: 0,   x: 404, y: 112, dir: 180, type: "Tubowa 4K",             video: "videos/cam-19.mp4" },
    { id: "KAM-20", name: "Załadunek kolejowy",              zone: "Powierzchnia · Bocznica",          level: 0,   x: 500, y: 184, dir: 180, type: "PTZ 4K · LPR",          video: "videos/cam-20.mp4" },
    { id: "KAM-21", name: "Szyb II · wlot wentylacyjny",     zone: "Powierzchnia · Wentylacja",        level: 0,   x: 498, y: 60,  dir: 190, type: "Tubowa 4K · Ex-d",      video: "videos/cam-21.mp4" },
    { id: "KAM-22", name: "Chodnik nadścianowy L-12",        zone: "Poziom −300 · Pokład 405/1",       level: 1,   x: 120, y: 26,  dir: 0,   type: "Ex-d IP67 · IR",        video: "videos/cam-22.mp4" },
    { id: "KAM-23", name: "Stacja załadowcza",               zone: "Poziom −300 · Transport",          level: 1,   x: 322, y: 114, dir: 250, type: "Ex-d IP67 · IR",        video: "videos/cam-23.mp4" },
    { id: "KAM-24", name: "Ładownia akumulatorów",           zone: "Poziom −300 · Transport",          level: 1,   x: 444, y: 114, dir: 250, type: "Ex-d IP67 · IR",        video: "videos/cam-24.mp4" },
    { id: "KAM-25", name: "Chodnik do szybu II",             zone: "Poziom −300 · Wentylacja",         level: 1,   x: 494, y: 72,  dir: 90,  type: "Ex-d IP67 · IR",        video: "videos/cam-25.mp4" },
    { id: "KAM-26", name: "Przodek B-3",                     zone: "Poziom −500 · Roboty przygotowawcze", level: 2, x: 352, y: 52, dir: 270, type: "Ex-d IP67 · IR",       video: "videos/cam-26.mp4" },
    { id: "KAM-27", name: "Pompownia główna · rząpie",       zone: "Poziom −500 · Odwadnianie",        level: 2,   x: 236, y: 116, dir: 270, type: "Ex-d IP67 · IR",        video: "videos/cam-27.mp4" },
    { id: "KAM-28", name: "Przekop G-7 · wschód",            zone: "Poziom −500 · Transport",          level: 2,   x: 502, y: 96,  dir: 180, type: "Ex-d IP67 · IR",        video: "videos/cam-28.mp4" },
    { id: "KAM-29", name: "Chodnik nadścianowy W-7",         zone: "Poziom −500 · Pokład 510",         level: 2,   x: 450, y: 22,  dir: 180, type: "Ex-d IP67 · IR",        video: "videos/cam-29.mp4" },
  ];

  /* Czujniki metanu – pozycja na modelu */
  const sensors = [
    { id: "L12", level: 1, x: 62,  y: 34,  base: 0.38 },
    { id: "W7",  level: 2, x: 412, y: 21,  base: 0.42 },
    { id: "DR",  level: 2, x: 300, y: 124, base: 0.21 },
  ];

  /* ------------------------------------------------------------------
     Procedury – przywoływane przez zdarzenia. Każdy krok jest pokazywany
     w terminalu po kolei; operator oznacza go jako wykonany / niemożliwy.
     ------------------------------------------------------------------ */
  const procedures = {
    "PROC-SOI-01": {
      title: "Brak ŚOI / aparatu ucieczkowego przy dostępie do szybu",
      ref: "Regulamin ruchu §7.3 · Rozp. ME z 23.11.2016 (Dz.U. 2017 poz. 1118) §82",
      steps: [
        "Zatrzymaj osobę na kołowrocie nadszybia – wezwij sygnalistę przez radio (kan. 3).",
        "Sprawdź z wydawcą lampowni, czy wydano aparat ucieczkowy (rejestr znaczków).",
        "Jeśli nie wydano: odeślij pracownika do lampowni. NIE zezwalaj na zjazd.",
        "Poinformuj sztygara zmianowego o naruszeniu (nazwisko, nr znaczka, godzina).",
        "Zamknij zdarzenie i dołącz nagranie do raportu zmiany.",
      ],
    },
    "PROC-OCH-04": {
      title: "Nieuprawniona obecność w komorze materiałów wybuchowych",
      ref: "Instrukcja obrotu MW IE-04 · Rozp. MW §46 · nadzór OUG",
      steps: [
        "Zdalnie zablokuj drzwi zewnętrzne komory (blokada KMW-D1) i potwierdź stan drzwi.",
        "Wezwij przez radio dyżurnego wydawcę komory – potwierdź, czy wejście jest uprawnione.",
        "Wyślij dołowy patrol ochrony do chodnika G-7 zachód (dojazd ok. 6 min).",
        "Zablokuj rejestr kontroli dostępu z ostatnich 60 min – wyeksportuj jako dowód.",
        "Jeśli wejście potwierdzone jako nieuprawnione: powiadom KRZG i Okręgowy Urząd Górniczy (OUG) w ciągu 1 h.",
        "Przeprowadź inwentaryzację komory z dwoma podpisami.",
      ],
    },
    "PROC-POZ-02": {
      title: "Pożar / przegrzanie przenośnika taśmowego",
      ref: "Plan ratownictwa górniczego · rozdz. 4.2 (pożar podziemny)",
      steps: [
        "Natychmiast zatrzymaj przenośnik P-2 (blokada dyspozytorska PT-P2). Potwierdź zatrzymanie taśmy na kamerze.",
        "Sprawdź czujniki CO / dymu wzdłuż P-2 w systemie gazometrii – zanotuj odczyty.",
        "Zaalarmuj dyspozytora ruchu i Stację Ratownictwa Górniczego (CSRG). Podaj: miejsce, źródło, odczyt CO.",
        "Nakaż wycofanie całej załogi z prądu powietrza za pożarem (chodnik G-7, ściana W-7) do podszybia −500.",
        "Wyślij zastęp pierwszej pomocy z gaśnicami i kamerą termowizyjną do zestawu krążników B-14.",
        "Jeśli pożar nie zostanie ugaszony w 10 min lub CO > 200 ppm: rozpocznij ewakuację poziomu −500.",
        "Utrzymuj kamerę objętą zdarzeniem na głównym podglądzie do odwołania przez kierownika akcji.",
      ],
    },
    "PROC-MED-01": {
      title: "Nieruchomy pracownik / podejrzenie urazu na ścianie",
      ref: "Plan ratownictwa górniczego · rozdz. 6.1 (uraz) · 3.4 (metan)",
      steps: [
        "Zdalnie zatrzymaj kombajn i przenośnik ścianowy (blokada SC-W7). Potwierdź na kamerze.",
        "Wywołaj załogę ściany przez łączność głośnomówiącą – poproś kolegę o sprawdzenie pracownika.",
        "Sprawdź CH₄ na czujniku W7 – jeśli ≥ 1,5 %: wyłącz zasilanie w rejonie (wyłączenie metanometryczne).",
        "Wezwij dołowy punkt medyczny i Stację Ratownictwa Górniczego – podaj miejsce: ściana W-7, sekcje 38–42.",
        "Przygotuj klatkę szybu I do transportu medycznego (jazda priorytetowa).",
        "Zgłoś sztygarowi zmianowemu i otwórz kartę wypadku.",
      ],
    },
    "PROC-OCH-01": {
      title: "Naruszenie perymetru",
      ref: "Plan ochrony fizycznej · rozdz. 3 · ustawa o działaniach antyterrorystycznych art. 5",
      steps: [
        "Uruchom syrenę perymetryczną i oświetlenie sektora A (brama główna).",
        "Wyślij patrol ochrony powierzchni; utrzymuj śledzenie intruzów na KAM-01 (auto-śledzenie PTZ).",
        "Wezwij Policję (112) – podaj: kopalnia, 2 osoby, pojazd bez tablic, kierunek przemieszczania.",
        "Zablokuj nadszybie i lampownię – żadnego zjazdu do czasu oczyszczenia terenu.",
        "Wyeksportuj nagranie i zrzuty LPR do folderu zdarzenia.",
      ],
    },
    "PROC-OCH-07": {
      title: "Porzucony przedmiot przy urządzeniu krytycznym",
      ref: "Plan ochrony fizycznej · rozdz. 5 · załącznik CBRN",
      steps: [
        "NIE zbliżaj się. Wyznacz strefę 50 m wokół stacji wentylatorów.",
        "Utrzymuj pracę wentylatora głównego, o ile inżynier wentylacji nie zdecyduje inaczej.",
        "Wezwij pirotechników Policji (112) oraz KRZG.",
        "Przejrzyj nagranie KAM-05 z ostatnich 15 min, aby zidentyfikować osobę i jej trasę.",
        "Skieruj cały personel powierzchni z dala od sektora C.",
      ],
    },
    "PROC-RUCH-03": {
      title: "Osoba w strefie zawieszonego ładunku / załadunku klatki",
      ref: "Regulamin ruchu §11.2 · Instrukcja obsługi wyciągu szybowego",
      steps: [
        "Wstrzymaj maszynę wyciągową (sygnał sygnalisty „STÓJ”) do czasu opuszczenia strefy.",
        "Poleć osobie przez łączność podszybia opuszczenie oznakowanej strefy.",
        "Potwierdź na kamerze, że strefa jest pusta, i zwolnij maszynę wyciągową.",
        "Zarejestruj zdarzenie na koncie posiadacza znaczka do omówienia na instruktażu BHP.",
      ],
    },
  };

  /* ------------------------------------------------------------------
     Zdarzenia – wywoływane w tej kolejności przez NASTĘPNE ZDARZENIE / AUTO.
     `boxes` to współrzędne (w %) ramek rysowanych na wideo.
     `choices` to teksty przycisków decyzji pokazywanych przy tym zdarzeniu
     (confirm = potwierdź i otwórz procedurę, analysis = więcej szczegółów,
     hold = obserwuj 20 s, false = fałszywy alarm).
     ------------------------------------------------------------------ */
  const incidents = [
    {
      id: "ZD-01",
      cam: "KAM-01",
      severity: "WYSOKI",
      title: "Nieuprawnione użycie karty",
      summary: "Nie rozpoznano twarzy Mariana Kowalskiego, a użyto jego karty (nr 2231) na czytniku przy wejściu głównym.",
      detections: [
        ["osoba", 0.97], ["karta: M. Kowalski (2231)", 1.0], ["twarz: NIE ROZPOZNANA", 0.96], ["zgodność z właścicielem karty", 0.08],
      ],
      boxes: [],   /* nagranie ma już wypalone oznaczenie „NIE ROZPOZNANO” */
      video: "videos/inc-card-live.mp4",
      /* zbliżenie na twarz pod koniec klipu: x,y = twarz (% kadru), scale = krotność, tx,ty = gdzie ma trafić twarz (% okna), from = sekunda startu, hold = stopklatka po końcu (ms) */
      zoom: { x: 45, y: 62, scale: 2.6, tx: 33, ty: 42, from: 3.6, hold: 2500 },
      person: { name: "Marian Kowalski", card: "2231", dept: "Dział mechaniczny" },
      /* własne opcje zdarzenia – można klikać w dowolnej kolejności */
      multi: true,
      options: [
        { label: "Wyślij patrol", action: "patrol", cls: "danger" },
        { label: "Odbierz dostępy", action: "block" },
        { label: "Pokaż historię zdarzeń", action: "history" },
      ],
      /* historia: klipy odtwarzane po kolei w panelu podglądu */
      history: [
        { time: "04:52", cam: "KAM-01", video: "videos/inc-card-exit.mp4", caption: "Marian Kowalski przy bramie – twarz rozpoznana, karta odbita na wyjściu", boxes: [],
          zoom: { x: 43.5, y: 62, scale: 2.8, tx: 40, ty: 42, from: 3.6, hold: 2500 } },
        { time: "04:58", cam: "KAM-01", video: "videos/inc-card-entry.mp4", caption: "Inna osoba wchodzi przez bramę na kartę Mariana Kowalskiego – twarz nierozpoznana", boxes: [],
          zoom: { x: 45, y: 62, scale: 2.6, tx: 33, ty: 42, from: 3.6, hold: 2500 } },
      ],
      block: { title: "Dostęp zablokowany", text: "Karta nr 2231 (Marian Kowalski) została zablokowana we wszystkich czytnikach. Powiadomiono ochronę i dział kadr." },
    },
    {
      id: "ZD-02",
      cam: "KAM-03",
      severity: "WYSOKI",
      title: "Fotografowanie w strefie zastrzeżonej",
      summary: "Osoba wyjęła telefon i zrobiła zdjęcie nadszybia i placu przy szybie I – strefa objęta zakazem fotografowania. Rozpoznano: Paweł Wiśniewski, pracownik firmy zewnętrznej Elektro-Serwis, przepustka gościnna G-118 (opiekun: inż. Jan Kowal).",
      detections: [
        ["osoba", 0.98], ["telefon w dłoni", 0.94], ["gest fotografowania", 0.91], ["strefa zakazu fotografowania", 1.0], ["twarz: P. Wiśniewski · gość G-118", 0.93],
      ],
      boxes: [
        { x: 0.5, y: 57, w: 9.5, h: 29, label: "P. WIŚNIEWSKI · GOŚĆ G-118 · TELEFON", cls: "" },
      ],
      video: "videos/inc-phone.mp4",
      person: { name: "Paweł Wiśniewski", pass: "G-118", company: "Elektro-Serwis", host: "inż. Jan Kowal" },
      multi: true,
      autoNote: "Zapisałem klip i stopklatkę ze zdjęciem jako dowód w karcie zdarzenia.",
      options: [
        { label: "Nadaj komunikat głosowy", action: "announce", cls: "danger",
          text: "Uwaga! Strefa objęta zakazem fotografowania. Proszę natychmiast schować telefon i opuścić rejon szybu.",
          after: "Osoba schowała telefon i odchodzi w stronę bramy. Nadal ją śledzę.", afterDelay: 7000 },
        { label: "Wyślij patrol", action: "patrol",
          arrival: "Patrol jest na miejscu. Wylegitymowano Pawła Wiśniewskiego. Zdjęcia usunięte w obecności ochrony, telefon zwrócony, sporządzono notatkę." },
        { label: "Powiadom opiekuna gościa", action: "notify",
          text: "Wysłałem SMS i wiadomość do inż. Jana Kowala (opiekun przepustki G-118) z opisem zdarzenia i stopklatką.",
          reply: "inż. Jan Kowal odpisał: „Idę na miejsce, będę za 5 minut.”", replyDelay: 6000 },
        { label: "Zablokuj przepustkę", action: "block" },
      ],
      block: { title: "Przepustka zablokowana", text: "Przepustka gościnna G-118 (Paweł Wiśniewski, Elektro-Serwis) została zablokowana. Osoba nie opuści terenu bez asysty ochrony. Powiadomiono portiernię." },
    },
    {
      id: "ZD-03",
      cam: "KAM-02",
      severity: "NISKI",
      title: "Pracownik bez aparatu ucieczkowego idzie na nadszybie",
      summary: "Osoba (ślad #4412) opuściła lampownię w kierunku szybu I bez aparatu ucieczkowego na pasie. Hełm OK, lampa OK.",
      detections: [
        ["osoba", 0.98], ["hełm", 0.95], ["lampa nahełmna", 0.91], ["BRAK aparatu ucieczkowego", 0.87], ["kierunek: szyb", 0.9],
      ],
      boxes: [{ x: 41, y: 22, w: 14, h: 58, label: "OSOBA · brak aparatu uciecz.", cls: "attn" }],
      procedure: "PROC-SOI-01",
      choices: { confirm: "Zatrzymaj pracownika przy kołowrocie – pokaż, co robić", analysis: "Pokaż, kogo widzisz", hold: "Poczekaj – może wróci po aparat", false: "To pomyłka, ma aparat" },
      video: "videos/inc-01-ppe.mp4",
      aiNotes: "Czytnik znaczków: pracownik K. Nowak (znaczek 2231) pobrał lampę 0413, ale w wydawalni aparatów nie zeskanowano żadnego aparatu ucieczkowego. Szacowane dojście do kołowrotu za 40 s.",
    },
    {
      id: "ZD-04",
      cam: "KAM-10",
      severity: "WYSOKI",
      title: "Nieuprawniona obecność w komorze materiałów wybuchowych",
      summary: "Drzwi zewnętrzne komory otwarte od 46 s poza oknem strzałowym. Jedna osoba w przedsionku, brak zdarzenia na czytniku KMW-R1.",
      detections: [
        ["osoba", 0.97], ["drzwi OTWARTE", 0.99], ["brak odbicia znaczka", 1.0], ["czas poza oknem strzałowym", 1.0], ["niesiony przedmiot", 0.62],
      ],
      boxes: [
        { x: 30, y: 18, w: 16, h: 64, label: "OSOBA · bez uprawnień", cls: "" },
        { x: 62, y: 8,  w: 20, h: 70, label: "DRZWI OTWARTE 46 s", cls: "attn" },
      ],
      procedure: "PROC-OCH-04",
      choices: { confirm: "Zablokuj komorę i wezwij patrol", analysis: "Kto to jest? Pokaż szczegóły", hold: "Obserwuj jeszcze 20 sekund", false: "To uprawniony pracownik" },
      video: "videos/inc-02-magazine.mp4",
      aiNotes: "Ostatnie uprawnione wejście: strzałowy J. Kowal 05:52, wyjście 06:04. Blokada drzwi KMW-D1 zgłasza „ręczne obejście” od 06:31. Chód osoby zgadza się ze śladem #0912 widzianym na KAM-09 o 06:26.",
    },
    {
      id: "ZD-05",
      cam: "KAM-08",
      severity: "KRYTYCZNY",
      title: "Dym i punkt gorący na przenośniku P-2 – taśma nadal pracuje",
      summary: "Kanał termowizyjny: 214 °C na zestawie krążników B-14. Kanał RGB: widoczna, rosnąca smuga dymu. Prędkość taśmy nominalna 2,5 m/s – taśma NIE została zatrzymana.",
      detections: [
        ["dym", 0.96], ["punkt gorący 214 °C", 0.99], ["taśma w ruchu", 0.98], ["czujnik CO P2-3: 38 ppm ↑", 1.0], ["osoby w pobliżu: brak", 0.9],
      ],
      boxes: [
        { x: 44, y: 34, w: 18, h: 22, label: "PUNKT GORĄCY 214 °C", cls: "" },
        { x: 36, y: 10, w: 34, h: 40, label: "DYM", cls: "attn" },
      ],
      procedure: "PROC-POZ-02",
      choices: { confirm: "Zatrzymaj taśmę i uruchom procedurę pożarową", analysis: "Pokaż odczyty temperatury i CO", hold: "Obserwuj jeszcze 20 sekund", false: "To para lub kurz, nie pożar" },
      video: "videos/inc-03-conveyor-fire.mp4",
      aiNotes: "Trend temperatury: +31 °C/min. Prąd powietrza niesie dym w stronę chodnika G-7 (załoga ściany W-7: 14 osób). Najbliższy punkt ppoż.: PP-P2-3, 40 m powyżej. Automatyczne wyłączenie taśmy NIE zadziałało – czujnik TS-B14 ostatnio raportował o 09:41 (możliwa awaria).",
      sensors: { DR: 0.21 },
    },
    {
      id: "ZD-06",
      cam: "KAM-12",
      severity: "KRYTYCZNY",
      title: "Nieruchomy pracownik na trasie kombajnu · rośnie CH₄",
      summary: "Osoba (ślad #7781) leży nieruchomo od 74 s między sekcjami 39–40, kombajn zbliża się (12 m). CH₄ na czujniku W7: 1,38 % i rośnie.",
      detections: [
        ["osoba LEŻĄCA", 0.94], ["brak ruchu 74 s", 1.0], ["zbliżający się kombajn", 0.97], ["CH₄ 1,38 % ↑", 1.0], ["załoga w pobliżu: 2", 0.88],
      ],
      boxes: [
        { x: 38, y: 58, w: 26, h: 18, label: "OSOBA LEŻĄCA · 74 s", cls: "" },
        { x: 68, y: 20, w: 28, h: 50, label: "KOMBAJN · 12 m", cls: "attn" },
      ],
      procedure: "PROC-MED-01",
      choices: { confirm: "Zatrzymaj kombajn i wezwij pomoc", analysis: "Pokaż, co widzisz", hold: "Poczekaj – może wstanie", false: "To fałszywy alarm" },
      video: "videos/inc-04-worker-down.mp4",
      aiNotes: "Pracownik zidentyfikowany po ID lampy nahełmnej: M. Wiśniewski (znaczek 1877). Brak łączności radiowej od 3 min. Dwóch kolegów przy sekcjach 44–45 odwróconych tyłem. Trend metanu wskazuje na wyrzut gazu po obwale stropu; próg automatycznego wyłączenia 1,5 % zostanie osiągnięty za ok. 2 min.",
      sensors: { W7: 1.38 },
    },
    {
      id: "ZD-07",
      cam: "KAM-01",
      severity: "WYSOKI",
      title: "Naruszenie perymetru – 2 osoby przez ogrodzenie, pojazd bez tablic",
      summary: "Dwie osoby przeszły przez ogrodzenie w sektorze A o 02:14:07. Furgonetka bez tablic rejestracyjnych stoi z włączonym silnikiem 30 m przed bramą. Obie osoby zmierzają w stronę wieży wyciągowej.",
      detections: [
        ["osoba ×2", 0.97], ["wspinaczka na ogrodzenie", 0.93], ["pojazd · brak tablic", 0.95], ["noc · termowizja", 1.0], ["kierunek: wieża wyciągowa", 0.86],
      ],
      boxes: [
        { x: 12, y: 30, w: 10, h: 40, label: "INTRUZ 1", cls: "" },
        { x: 24, y: 34, w: 10, h: 38, label: "INTRUZ 2", cls: "" },
        { x: 66, y: 44, w: 28, h: 30, label: "POJAZD · BRAK TABLIC", cls: "attn" },
      ],
      procedure: "PROC-OCH-01",
      choices: { confirm: "Włącz alarm i wyślij ochronę", analysis: "Pokaż intruzów z bliska", hold: "Obserwuj jeszcze 20 sekund", false: "To nasi pracownicy" },
      video: "videos/inc-05-perimeter.mp4",
      aiNotes: "Obie osoby mają plecaki. O tej porze w sektorze A nie ma zaplanowanych pracowników. Furgonetka wjechała na drogę dojazdową o 02:09 – LPR nie odczytał tablic (zasłonięte).",
    },
    {
      id: "ZD-08",
      cam: "KAM-05",
      severity: "WYSOKI",
      title: "Porzucony przedmiot przy czerpni wentylatora głównego",
      summary: "Osoba postawiła torbę przy kracie czerpni wentylatora i szybko się oddaliła (4,1 m/s). Przedmiot nieruchomy od 3 min, właściciel nieobecny w promieniu 50 m.",
      detections: [
        ["porzucony przedmiot", 0.91], ["osoba szybko się oddala", 0.89], ["bliskość: czerpnia wentylatora", 1.0], ["właściciel nieobecny 3 min", 1.0],
      ],
      boxes: [
        { x: 52, y: 62, w: 12, h: 16, label: "PRZEDMIOT · 3 min", cls: "" },
      ],
      procedure: "PROC-OCH-07",
      choices: { confirm: "Wyznacz strefę i wezwij pirotechników", analysis: "Pokaż osobę, która to zostawiła", hold: "Poczekaj – może właściciel wróci", false: "To zwykła torba pracownika" },
      video: "videos/inc-06-object.mp4",
      aiNotes: "Osoba była śledzona od składowiska (skraj pola widzenia KAM-04) i znajduje się obecnie poza zasięgiem kamer. Czerpnia wentylatora jest pojedynczym punktem awarii wentylacji poziomu −500.",
    },
    {
      id: "ZD-09",
      cam: "KAM-06",
      severity: "ŚREDNI",
      title: "Osoba w strefie załadunku klatki pod zawieszonym ładunkiem",
      summary: "Pracownik stoi w czerwonej strefie kreskowanej na podszybiu −300 podczas ładowania klatki materiałowej (ładunek zawieszony na 1,2 m).",
      detections: [
        ["osoba w strefie zakazanej", 0.96], ["zawieszony ładunek", 0.93], ["sygnalista obecny", 0.9],
      ],
      boxes: [
        { x: 46, y: 36, w: 14, h: 52, label: "OSOBA · STREFA ZAKAZANA", cls: "" },
        { x: 40, y: 6,  w: 30, h: 32, label: "ZAWIESZONY ŁADUNEK", cls: "attn" },
      ],
      procedure: "PROC-RUCH-03",
      choices: { confirm: "Wstrzymaj wyciąg i usuń osobę ze strefy", analysis: "Pokaż, co widzisz", hold: "Obserwuj jeszcze 20 sekund", false: "To fałszywy alarm" },
      video: "videos/inc-07-loading-zone.mp4",
      aiNotes: "To trzecie takie zdarzenie w tej strefie w tym tygodniu. Oznakowanie strefy może być wytarte – zalecam zgłoszenie serwisowe.",
    },
  ];

  /* ------------------------------------------------------------------
     Patrole ochrony – pozycje na modelu (poziom, x, y) i nazwiska.
     ------------------------------------------------------------------ */
  const patrols = [
    { id: "P-1", names: ["Adam Nowak", "Tomasz Kowalczyk"], level: 0, x: 150, y: 150 },
    { id: "P-2", names: ["Piotr Zieliński"],               level: 0, x: 300, y: 120 },
    { id: "P-3", names: ["Marek Wójcik", "Jan Lis"],       level: 0, x: 470, y: 172 },
    { id: "P-4", names: ["Krzysztof Mazur"],               level: 1, x: 420, y: 92 },
    { id: "P-5", names: ["Robert Kaczmarek"],              level: 2, x: 400, y: 100 },
  ];

  return { cameras, sensors, procedures, incidents, patrols };
})();

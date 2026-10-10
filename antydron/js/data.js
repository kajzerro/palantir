/* ==========================================================================
   SPEKTRE AIR · dane demonstracyjne systemu antydronowego (C-UAS)
   --------------------------------------------------------------------------
   Wszystko, co zaplanowane w demo, jest w tym pliku:
     · obiekty chronione (PGE GiEK Elektrownia Bełchatów, PGE Baltica 2),
     · sensory (radar 3D, RF/DF z Remote ID, EO/IR, akustyka, AIS, ADS-B, UTM),
     · efektory (zakłócanie, przejęcie protokołu, dron przechwytujący),
     · scenariusze zdarzeń ze śladami powietrznymi (ruch celów w czasie),
     · procedury, które operator wykonuje krok po kroku,
     · warstwa inteligencji (korelacje, profile operatorów, trendy).

   UKŁAD WSPÓŁRZĘDNYCH
   -------------------
   Wszystkie pozycje są w jednostkach planu: 1 jednostka = 10 m (stała M).
   Pole widzenia mapy to 1000 × 620 jednostek, czyli ok. 10 × 6,2 km.
   Ślady powietrzne (`wps`) to punkty [t_sekundy, x, y, wysokość_m_AGL].

   WIDEO
   -----
   Każdy sensor EO/IR ma `video` (pętla bezczynności), każde zdarzenie ma
   własne `video`. Brakujące pliki pokazują planszę BRAK SYGNAŁU z oczekiwaną
   ścieżką, więc nagrania można podmieniać po kolei (lista w README.md).
   ========================================================================== */

window.AIR_DATA = (function () {

  const M = 10;   /* metrów na jednostkę planu */

  /* ====================================================================
     OBIEKT 1 · PGE GiEK · Elektrownia Bełchatów (ląd)
     ==================================================================== */
  const belchatow = {
    id: "belchatow",
    name: "Elektrownia Bełchatów",
    short: "BEŁCHATÓW",
    sub: "PGE GiEK",
    operator: "PGE Górnictwo i Energetyka Konwencjonalna S.A.",
    kind: "onshore",
    desc: "Blok energetyczny 858 MW, rozdzielnia 400 kV, nawęglanie, IOS",
    center: [500, 300],
    ceiling: 120,
    airspaceNote: "Strefa EP R zgłoszona w PAŻP · NOTAM A1143/25 · pułap lotów BSP 120 m AGL",
    rings: [
      { r: 50,  cls: "inner", label: "STREFA ZAKAZANA · 500 m" },
      { r: 150, cls: "mid",   label: "STREFA OSTRZEGAWCZA · 1,5 km" },
      { r: 320, cls: "",      label: "STREFA DETEKCJI · 3,2 km" },
      { r: 500, cls: "",      label: "ZASIĘG RADARU · 5 km" },
    ],
    nfz: { pts: [[380, 190], [640, 190], [660, 300], [620, 420], [400, 420], [360, 300]], label: "EP R 142 · ZAKAZ LOTÓW BSP" },
    homeW: 840,
    /* podkład rastrowy pod widok SATELITA (ten sam kadr co mapa: 1000 × 620 jednostek).
       Podmieniasz go skryptem tools/fetch_satellite.py – wtedy zmień też `baseCredit`. */
    base: "assets/sat-belchatow.jpg",
    baseCredit: "PODKŁAD ZASTĘPCZY (wygenerowany) · wstaw ortofotomapę GUGiK: tools/fetch_satellite.py",
    geo: [
      /* tło terenu */
      { t: "rect", x: -60, y: -60, w: 1120, h: 740, cls: "land" },
      /* ogrodzenie i drogi */
      { t: "poly", cls: "fence", pts: [[370, 200], [650, 200], [668, 300], [630, 412], [392, 412], [352, 300]] },
      { t: "line", cls: "road", pts: [[352, 300], [240, 318], [120, 330]] },
      { t: "line", cls: "road", pts: [[500, 412], [512, 500], [540, 560]] },
      { t: "line", cls: "rail", pts: [[668, 300], [760, 286], [880, 280]] },
      /* bloki energetyczne – hale kotłów i turbin */
      { t: "rect", x: 430, y: 236, w: 128, h: 26, cls: "bld", label: "HALA TURBIN 1–4" },
      { t: "rect", x: 430, y: 268, w: 128, h: 22, cls: "bld" },
      { t: "rect", x: 430, y: 300, w: 128, h: 24, cls: "bld", label: "HALA KOTŁÓW · HALA TURBIN 5–8" },
      { t: "rect", x: 566, y: 236, w: 42, h: 54, cls: "bld hot", label: "BLOK 858 MW" },
      /* kominy i chłodnie */
      { t: "circle", cx: 408, cy: 222, r: 7, cls: "stack", label: "KOMIN 299 m" },
      { t: "circle", cx: 596, cy: 214, r: 6, cls: "stack", label: "KOMIN II" },
      { t: "circle", cx: 404, cy: 352, r: 11, cls: "tower" },
      { t: "circle", cx: 436, cy: 374, r: 11, cls: "tower" },
      { t: "circle", cx: 470, cy: 388, r: 11, cls: "tower" },
      { t: "circle", cx: 506, cy: 392, r: 11, cls: "tower", label: "CHŁODNIE KOMINOWE" },
      { t: "circle", cx: 542, cy: 386, r: 11, cls: "tower" },
      { t: "circle", cx: 576, cy: 372, r: 11, cls: "tower" },
      /* rozdzielnia 400 kV */
      { t: "rect", x: 584, y: 300, w: 72, h: 60, cls: "sw-yard" },
      { t: "line", cls: "sw-bay", pts: [[590, 310], [650, 310]] },
      { t: "line", cls: "sw-bay", pts: [[590, 322], [650, 322]] },
      { t: "line", cls: "sw-bay", pts: [[590, 334], [650, 334]] },
      { t: "line", cls: "sw-bay", pts: [[590, 346], [650, 346]] },
      /* transformatory blokowe – aktywa krytyczne */
      { t: "rect", x: 560, y: 292, w: 18, h: 10, cls: "bld hot", label: "TR BLOKOWE" },
      /* nawęglanie i zwałowisko */
      { t: "rect", x: 380, y: 240, w: 36, h: 60, cls: "yard", label: "NAWĘGLANIE" },
      { t: "line", cls: "conv", pts: [[352, 262], [280, 250], [200, 238]] },
      { t: "line", cls: "conv", pts: [[380, 270], [352, 268]] },
      { t: "rect", x: 150, y: 210, w: 70, h: 44, cls: "yard", label: "ZWAŁOWISKO WĘGLA" },
      /* IOS, nastawnia, zaplecze */
      { t: "circle", cx: 620, cy: 258, r: 8, cls: "tower", label: "INSTALACJA ODSIARCZANIA" },
      { t: "rect", x: 470, y: 338, w: 34, h: 16, cls: "bld", label: "NASTAWNIA" },
      { t: "rect", x: 392, y: 320, w: 26, h: 14, cls: "bld", label: "POMPOWNIA" },
      { t: "rect", x: 372, y: 296, w: 22, h: 12, cls: "bld", label: "BRAMA GŁ." },
      { t: "rect", x: 330, y: 330, w: 30, h: 18, cls: "yard", label: "PARKING" },
      /* aktywa krytyczne – obrysy */
      { t: "asset", x: 578, y: 294, w: 84, h: 72, label: "AKTYWO KRYTYCZNE · ROZDZIELNIA 400 kV" },
      { t: "asset", x: 462, y: 332, w: 50, h: 28, label: "" },
    ],
    sensors: [
      { id: "RAD-1",  kind: "radar", name: "Radar 3D · maszt północny",     zone: "Perymetr N · maszt 42 m",  x: 452, y: 206, range: 500, type: "Radar AESA Ku · 3D · 5 km / 1 200 m" },
      { id: "RAD-2",  kind: "radar", name: "Radar 3D · maszt południowy",   zone: "Perymetr S · maszt 42 m",  x: 548, y: 400, range: 500, type: "Radar AESA Ku · 3D · 5 km / 1 200 m" },
      { id: "RF-1",   kind: "rf",    name: "Czujnik RF/DF · zachód",        zone: "Perymetr W",               x: 366, y: 258, range: 620, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "RF-2",   kind: "rf",    name: "Czujnik RF/DF · wschód",        zone: "Perymetr E",               x: 652, y: 262, range: 620, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "RF-3",   kind: "rf",    name: "Czujnik RF/DF · południe",      zone: "Perymetr S",               x: 470, y: 420, range: 620, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "EOIR-1", kind: "eoir",  name: "Głowica EO/IR · rozdzielnia",   zone: "Rozdzielnia 400 kV",       x: 596, y: 296, range: 220, dir: 330, fov: 16, type: "EO 4K 60× + IR 640 · autotracking", video: "videos/eoir-01.mp4" },
      { id: "EOIR-2", kind: "eoir",  name: "Głowica EO/IR · hala turbin",   zone: "Blok 858 MW",              x: 486, y: 262, range: 220, dir: 40,  fov: 16, type: "EO 4K 60× + IR 640 · autotracking", video: "videos/eoir-02.mp4" },
      { id: "EOIR-3", kind: "eoir",  name: "Głowica EO/IR · chłodnie",      zone: "Chłodnie kominowe",        x: 470, y: 368, range: 220, dir: 250, fov: 16, type: "EO 4K 60× + IR 640 · autotracking", video: "videos/eoir-03.mp4" },
      { id: "AKU-1",  kind: "aku",   name: "Macierz akustyczna",            zone: "Nastawnia · dach",         x: 492, y: 330, range: 90,  type: "8-mikrofonowa macierz · klasyfikacja wirników" },
      { id: "UTM-1",  kind: "adsb",  name: "Odbiornik ADS-B + kanał PansaUTM", zone: "Nastawnia · dach",      x: 506, y: 318, range: 0,   type: "ADS-B 1090 MHz + plany lotów BSP (PansaUTM)" },
      { id: "JAM-1",  kind: "jam",   name: "Zakłócacz kierunkowy",          zone: "Dach hali turbin",         x: 524, y: 288, range: 220, dir: 0, fov: 60, type: "Zakłócanie RC/GNSS · wymaga zgody (art. 26a)" },
      { id: "SPO-1",  kind: "spoof", name: "Moduł przejęcia protokołu",     zone: "Dach nastawni",            x: 500, y: 326, range: 260, type: "Przejęcie łącza producenta · bezpieczne sprowadzenie" },
      { id: "INT-1",  kind: "inter", name: "Stanowisko drona przechwytującego", zone: "Plac przy nastawni",    x: 480, y: 352, range: 400, type: "Dron przechwytujący z siecią · gotowość 20 s" },
    ],
    patrols: [
      { id: "SUFO-1", names: ["Adam Nowak", "Tomasz Kowalczyk"], kind: "pojazd ochrony", x: 356, y: 322, speed: 8 },
      { id: "SUFO-2", names: ["Piotr Zieliński"],                kind: "pojazd ochrony", x: 614, y: 380, speed: 8 },
      { id: "SUFO-3", names: ["Marek Wójcik", "Jan Lis"],        kind: "patrol pieszy",  x: 492, y: 252, speed: 1.4 },
      { id: "POL-1",  names: ["KPP Bełchatów · radiowóz"],       kind: "Policja",        x: 120, y: 330, speed: 14, external: true },
    ],
    landmarks: { approach: "droga dojazdowa od zachodu", town: "Rogowiec / Bełchatów" },
  };

  /* ====================================================================
     OBIEKT 2 · PGE Baltica · Baltica 2 (morska farma wiatrowa)
     ==================================================================== */
  const wtgs = (() => {
    const out = [];
    let n = 1;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        out.push({ t: "wtg", cx: 270 + c * 92, cy: 120 + r * 58 + (c % 2 ? 14 : 0), r: 4.5, id: "B-" + String(n++).padStart(2, "0") });
      }
    }
    return out;
  })();

  const baltica = {
    id: "baltica",
    name: "Baltica 2 · morska farma wiatrowa",
    short: "BALTICA 2",
    sub: "PGE Baltica",
    operator: "PGE Baltica / Elektrownia Wiatrowa Baltica-2 sp. z o.o.",
    kind: "offshore",
    desc: "30 turbin, morska stacja elektroenergetyczna (OSS), kabel eksportowy",
    center: [500, 430],
    ceiling: 120,
    airspaceNote: "Obszar morski RP · strefa bezpieczeństwa 500 m wokół urządzeń · NOTAM + ostrzeżenie nawigacyjne BHMW",
    /* obrót wirników na mapie: sekundy na obrót (0 = turbiny nieruchome,
       spokojniejszy obraz taktyczny na prezentacji) */
    wtgSpin: 18,
    rings: [
      { r: 50,  cls: "inner", label: "STREFA BEZPIECZEŃSTWA OSS · 500 m" },
      { r: 180, cls: "mid",   label: "STREFA OSTRZEGAWCZA · 1,8 km" },
      { r: 380, cls: "",      label: "STREFA DETEKCJI · 3,8 km" },
      { r: 560, cls: "",      label: "ZASIĘG RADARU MORSKIEGO · 5,6 km" },
    ],
    nfz: { pts: [[240, 90], [800, 90], [830, 300], [760, 500], [280, 500], [210, 300]], label: "STREFA OGRANICZEŃ · AKWEN FARMY" },
    homeW: 900,
    base: "assets/sat-baltica.jpg",
    baseCredit: "PODKŁAD ZASTĘPCZY (wygenerowany) · wstaw zdjęcie akwenu: tools/fetch_satellite.py",
    geo: [
      { t: "rect", x: -40, y: -40, w: 1080, h: 700, cls: "sea" },
      ...wtgs,
      /* kable wewnętrzne – nitki do OSS */
      { t: "line", cls: "cable", pts: [[270, 120], [300, 430], [500, 430]] },
      { t: "line", cls: "cable", pts: [[362, 134], [400, 430], [500, 430]] },
      { t: "line", cls: "cable", pts: [[454, 120], [470, 430], [500, 430]] },
      { t: "line", cls: "cable", pts: [[546, 134], [560, 430], [500, 430]] },
      { t: "line", cls: "cable", pts: [[638, 120], [640, 430], [500, 430]] },
      { t: "line", cls: "cable", pts: [[730, 134], [720, 430], [500, 430]] },
      /* OSS + kabel eksportowy na brzeg */
      { t: "rect", x: 484, y: 418, w: 32, h: 24, cls: "oss" },
      { t: "line", cls: "cable", pts: [[500, 442], [480, 540], [430, 620]] },
      { t: "text", x: 452, y: 580, label: "KABEL EKSPORTOWY → ŁEBA / SŁAJSZEWO" },
      /* jednostki */
      { t: "vessel", cx: 606, cy: 356, dir: 250, cls: "", id: "SOV", label: "SOV „BALTICA SUPPORTER”" },
      { t: "vessel", cx: 330, cy: 250, dir: 70,  cls: "", id: "CTV", label: "CTV „WIND BREEZE”" },
      { t: "vessel", cx: 646, cy: 474, dir: 296, cls: "dark", id: "UNK", label: "JEDNOSTKA BEZ AIS" },
      { t: "circle", cx: 820, cy: 180, r: 3, cls: "tower", label: "MASZT POMIAROWY" },
      { t: "asset", x: 478, y: 412, w: 44, h: 36, label: "AKTYWO KRYTYCZNE · OSS 275 kV" },
    ],
    sensors: [
      { id: "RAD-11",  kind: "radar", name: "Radar morski 3D · OSS",         zone: "OSS · platforma górna",   x: 500, y: 392, range: 560, type: "Radar 3D X-band · cele powietrzne i nawodne" },
      { id: "RAD-12",  kind: "radar", name: "Radar 3D · turbina B-13",       zone: "B-13 · gondola",          x: 270, y: 236, range: 420, type: "Radar 3D kompakt · 4,2 km" },
      { id: "RF-11",   kind: "rf",    name: "Czujnik RF/DF · OSS",           zone: "OSS · maszt",             x: 458, y: 412, range: 640, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "RF-12",   kind: "rf",    name: "Czujnik RF/DF · turbina B-08",  zone: "B-08 · gondola",          x: 362, y: 192, range: 640, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "RF-13",   kind: "rf",    name: "Czujnik RF/DF · turbina B-25",  zone: "B-25 · gondola",          x: 270, y: 352, range: 640, type: "RF 70 MHz–6 GHz · DF · Remote ID" },
      { id: "EOIR-11", kind: "eoir",  name: "Głowica EO/IR · OSS",           zone: "OSS · platforma",         x: 452, y: 438, range: 300, dir: 40, fov: 15, type: "EO 4K 60× + IR 640 · stabilizacja morska", video: "videos/eoir-11.mp4" },
      { id: "EOIR-12", kind: "eoir",  name: "Głowica EO/IR · turbina B-18",  zone: "B-18 · gondola",          x: 730, y: 250, range: 300, dir: 120, fov: 15, type: "EO 4K 30× + IR 640",                      video: "videos/eoir-12.mp4" },
      { id: "AIS-11",  kind: "ais",   name: "Odbiornik AIS + radar nawodny", zone: "OSS · maszt",             x: 540, y: 410, range: 700, type: "AIS klasa A/B + korelacja z radarem nawodnym" },
      { id: "SAT-11",  kind: "sat",   name: "Kanał obrazowania satelitarnego", zone: "Łącze satelitarne",     x: 860, y: 100, range: 0,  type: "Zamówienie zobrazowania SAR / optycznego na żądanie" },
      { id: "JAM-11",  kind: "jam",   name: "Zakłócacz kierunkowy · OSS",    zone: "OSS · platforma",         x: 548, y: 438, range: 240, dir: 60, fov: 60, type: "Zakłócanie RC/GNSS · wymaga zgody (art. 26a)" },
      { id: "INT-11",  kind: "inter", name: "Dron przechwytujący · pokład OSS", zone: "OSS · pokład",         x: 500, y: 480, range: 420, type: "Dron przechwytujący z siecią · start z pokładu" },
      { id: "EOIR-13", kind: "eoir",  name: "Głowica EO/IR · turbina B-29",  zone: "B-29 · gondola",          x: 638, y: 352, range: 300, dir: 200, fov: 15, type: "EO 4K 30× + IR 640", video: "videos/eoir-13.mp4", offline: true },
    ],
    patrols: [
      { id: "SOV-1", names: ["SOV „Baltica Supporter” · zespół serwisowy"], kind: "jednostka serwisowa", x: 606, y: 356, speed: 6 },
      { id: "CTV-1", names: ["CTV „Wind Breeze”"],                          kind: "jednostka transferowa", x: 330, y: 250, speed: 12 },
      { id: "SG-1",  names: ["Morski Oddział Straży Granicznej · SG-312"],  kind: "Straż Graniczna", x: 180, y: 560, speed: 16, external: true },
    ],
    landmarks: { approach: "tor podejściowy od wschodu", town: "Łeba / Ustka" },
  };

  const sites = { belchatow, baltica };

  /* ====================================================================
     PROCEDURY · operator wykonuje je krok po kroku w panelu asystenta
     Odniesienia prawne są poglądowe (demo) – do potwierdzenia z działem
     prawnym i służbami przed wdrożeniem operacyjnym.
     ==================================================================== */
  const procedures = {
    "PROC-UAV-01": {
      title: "Nieuprawniony lot BSP nad obiektem infrastruktury krytycznej",
      ref: "Plan ochrony obiektu IK · ust. o zarządzaniu kryzysowym art. 6 · Prawo lotnicze art. 126a · ust. antyterrorystyczna art. 26a",
      steps: [
        "Potwierdź ślad w co najmniej dwóch niezależnych sensorach (radar + RF lub EO/IR) i uruchom zapis pakietu dowodowego.",
        "Sprawdź w PansaUTM i w rejestrze zgód, czy lot jest zgłoszony i czy operator ma zgodę na loty nad obiektem.",
        "Powiadom dowódcę zmiany SUFO oraz dyżurnego inżyniera ruchu bloku. Podnieś poziom zagrożenia do ŻÓŁTEGO.",
        "Zlokalizuj operatora (triangulacja RF/DF) i skieruj patrol z zadaniem ustalenia tożsamości – bez kontaktu fizycznego.",
        "Zgłoś zdarzenie Policji (112) oraz do PAŻP / ASM-1: czas, pozycja, typ BSP, wysokość, kierunek lotu.",
        "Jeśli BSP wejdzie w strefę zakazaną nad aktywem krytycznym – wystąp o zgodę na użycie środków aktywnych (art. 26a).",
        "Zamknij zdarzenie i dołącz pakiet dowodowy (ślad radarowy, nagranie EO/IR, zrzut Remote ID) do raportu zmiany i rejestru zdarzeń IK.",
      ],
    },
    "PROC-UAV-02": {
      title: "BSP z podejrzeniem ładunku · zrzut przedmiotu nad aktywem krytycznym",
      ref: "Plan ochrony obiektu IK rozdz. 5 · załącznik CBRN · ust. antyterrorystyczna art. 26a · PSP / ABW",
      steps: [
        "Podnieś poziom zagrożenia do CZERWONEGO i wycofaj ludzi z rejonu transformatorów blokowych i rozdzielni 400 kV.",
        "Wstrzymaj prace na otwartym terenie w promieniu 200 m od przewidywanego punktu zrzutu.",
        "Utrzymuj ślad na EO/IR; zapisz tor lotu, moment zrzutu i stopklatkę przedmiotu z czasem UTC.",
        "Wystąp o zgodę na neutralizację BSP (art. 26a) – uzasadnienie: ładunek nad aktywem krytycznym.",
        "Powiadom Policję (112), PSP oraz ABW; przekaż pozycję przedmiotu i tor lotu BSP.",
        "NIE zbliżaj się do przedmiotu. Wyznacz strefę 100 m i oczekuj pirotechników.",
        "Uzgodnij z dyspozytorem (KDM) wariant pracy bloku na wypadek wyłączenia rozdzielni.",
        "Zamknij zdarzenie, przekaż pakiet dowodowy organom i zgłoś do RCB.",
      ],
    },
    "PROC-UAV-03": {
      title: "Skoordynowany lot grupy BSP (rój) nad obiektem",
      ref: "Plan ochrony obiektu IK rozdz. 6 · ust. antyterrorystyczna art. 26a · procedura współdziałania z Policją / ABW",
      steps: [
        "Potwierdź liczbę i tory śladów. Przypisz priorytety celów – najwyższy dla celu najbliższego aktywu krytycznemu.",
        "Podnieś poziom zagrożenia do CZERWONEGO, zamknij bramy, wstrzymaj wjazdy i wyjazdy.",
        "Sprawdź emisję RC: brak emisji oznacza lot autonomiczny – zakłócanie łącza RC nie przyniesie efektu.",
        "Wystąp o zgodę na środki aktywne (art. 26a) i zgłoś atak skoordynowany Policji oraz ABW.",
        "Skieruj dron przechwytujący na cel priorytetowy; pozostałe cele utrzymuj na EO/IR i radarze.",
        "Zabezpiecz nastawnię i rozdzielnię – ludzie pod osłoną, obchody wstrzymane do odwołania.",
        "Po zakończeniu zabezpiecz urządzenia dla organów, wykonaj przegląd aktywów i złóż raport w ciągu 24 h.",
      ],
    },
    "PROC-MOR-01": {
      title: "BSP startujący z jednostki morskiej w akwenie farmy",
      ref: "Plan ochrony morskiej farmy wiatrowej · ust. o obszarach morskich RP · współdziałanie z MOSG, VTS i Marynarką Wojenną",
      steps: [
        "Skoreluj ślad powietrzny z echem nawodnym i danymi AIS; zapisz moment utraty lub braku AIS jednostki.",
        "Powiadom dyżurnego Morskiego Oddziału Straży Granicznej oraz VTS – podaj pozycję i charakterystykę jednostki.",
        "Wywołaj jednostkę na VHF kanał 16 i wezwij do identyfikacji. Zapisz nagranie wywołania.",
        "Skieruj EO/IR na jednostkę, zapisz cechy identyfikacyjne i zamów zobrazowanie satelitarne akwenu.",
        "Wstrzymaj transfery personelu na turbiny w sektorze; poinformuj SOV i CTV o zagrożeniu.",
        "Jeśli BSP wejdzie w strefę bezpieczeństwa OSS – wystąp o zgodę na środki aktywne i przekaż sprawę SG / MW.",
        "Zamknij zdarzenie; przekaż pakiet dowodowy SG oraz zgłoszenie do RCB i operatora systemu przesyłowego.",
      ],
    },
    "PROC-GNSS-01": {
      title: "Zakłócanie lub podszywanie sygnału GNSS w rejonie obiektu",
      ref: "Procedura ciągłości działania · zgłoszenia do UKE i PAŻP · wytyczne BHMW dla żeglugi",
      steps: [
        "Potwierdź zakłócenia na niezależnych odbiornikach: stacja referencyjna, BSP inspekcyjny, jednostki serwisowe.",
        "Wstrzymaj loty BSP inspekcyjnych i operacje wymagające pozycjonowania dynamicznego (DP).",
        "Przełącz jednostki na nawigację zastępczą (radar / INS) i poinformuj załogi o charakterze zakłóceń.",
        "Oszacuj kierunek źródła na podstawie namiarów RF; zapisz widmo i czas trwania zakłóceń.",
        "Zgłoś zakłócenia do UKE i PAŻP, a przy źródle na morzu – do Morskiego Oddziału SG.",
        "Zamknij zdarzenie z załącznikiem: widmo, namiary, lista wpływu operacyjnego i czas niedostępności.",
      ],
    },
    "PROC-INSP-01": {
      title: "Odstępstwo autoryzowanego BSP od korytarza inspekcyjnego",
      ref: "Instrukcja lotów inspekcyjnych BSP · warunki zgody na loty · karta niezgodności wykonawcy",
      steps: [
        "Potwierdź, że ślad to BSP z aktywną zgodą: plan lotu w PansaUTM, Remote ID, wykonawca i pilot.",
        "Ostrzeż operatora przez kanał roboczy i poproś o natychmiastowy powrót do zatwierdzonego korytarza.",
        "Jeśli BSP zbliża się do wirnika lub pola elektrycznego – nakaż zawieszenie lotu i wycofanie na pozycję bezpieczną.",
        "Zapisz odstępstwo w rejestrze wykonawcy (karta niezgodności) i powiadom inżyniera nadzoru.",
        "Zamknij zdarzenie. Przy powtórzeniu wnioskuj o zawieszenie zgody na loty dla tego wykonawcy.",
      ],
    },
  };

  /* ====================================================================
     SCENARIUSZE (ZDARZENIA) · przyciski „Scenariusz 1…7” oraz tryb AUTO
     --------------------------------------------------------------------
     `tracks[].wps` = [t_sekundy, x, y, wysokość_m]; po ostatnim punkcie
     ślad przechodzi w `orbit` (krążenie) albo zatrzymuje się.
     `fusion` = wkład poszczególnych sensorów w zbudowanie jednego śladu.
     `options` = przyciski decyzji operatora (akcje obsługiwane w app.js).
     ==================================================================== */
  const incidents = [
    /* ---------------------------------------------------------------- 1 */
    {
      id: "ZD-01",
      site: "belchatow",
      severity: "WYSOKI",
      threat: "ŻÓŁTY",
      title: "Rozpoznanie BSP nad rozdzielnią 400 kV",
      summary: "Radar wykrył pojedynczy obiekt wirnikowy wchodzący od zachodu wzdłuż drogi dojazdowej. Czujniki RF odczytały Remote ID: DJI Mavic 3T, numer seryjny 1581F5BND24C0098. Lot nie jest zgłoszony w PansaUTM. Obiekt zatrzymał się nad rozdzielnią 400 kV na wysokości ok. 95 m i krąży.",
      sensor: "EOIR-1",
      video: "videos/inc-01-recon.mp4",
      boxes: [{ x: 44, y: 28, w: 13, h: 15, label: "BSP · DJI MAVIC 3T · 95 m", cls: "" }],
      target: {
        trk: "TRK-1141", cls: "hostile", kindLabel: "BSP wielowirnikowy (klasa C2)",
        model: "DJI Mavic 3T", serial: "1581F5BND24C0098", rid: "ODCZYTANY",
        mtow: "920 g", payload: "kamera EO 4/3 + termowizja 640×512", link: "OcuSync 2.4 GHz (aktywne)",
        home: "pobocze drogi dojazdowej, 1,9 km W", pilotNote: "Remote ID podaje pozycję startu i pozycję operatora",
      },
      fusion: [
        { s: "RAD-1",  label: "Radar 3D RAD-1",        v: 0.94, note: "ślad 3D, RCS 0,012 m², prędkość 11 m/s, wysokość 95 m" },
        { s: "RF-1",   label: "RF/DF RF-1",            v: 0.99, note: "Remote ID + łącze OcuSync, namiar 268°" },
        { s: "RF-2",   label: "RF/DF RF-2",            v: 0.97, note: "ten sam identyfikator, namiar 254° – triangulacja operatora" },
        { s: "EOIR-1", label: "Głowica EO/IR EOIR-1",  v: 0.98, note: "autotracking, rozpoznany model płatowca i gimbala" },
        { s: "AKU-1",  label: "Macierz akustyczna AKU-1", v: 0.71, note: "sygnatura 4 wirników, zgodna z klasą masy ≤ 1 kg" },
        { s: "UTM-1",  label: "PansaUTM / ADS-B",      v: 0.00, neg: true, note: "BRAK zgłoszonego planu lotu i brak zgody na lot nad obiektem" },
      ],
      detections: [
        ["BSP wielowirnikowy", 0.98], ["Remote ID odczytany", 1.0], ["brak zgłoszenia lotu", 1.0],
        ["lot nad aktywem krytycznym", 0.96], ["profil lotu: rozpoznanie (krążenie, zawisy)", 0.89],
      ],
      tracks: [
        {
          id: "TRK-1141", cls: "hostile", label: "TRK-1141 · DJI MAVIC 3T",
          wps: [[0, 412, 326, 55], [22, 448, 322, 78], [48, 490, 316, 92], [73, 532, 310, 96], [98, 580, 312, 95]],
          orbit: { cx: 620, cy: 330, r: 44, period: 152, alt: 95 },
        },
      ],
      operator: { x: 352, y: 352, label: "OPERATOR BSP · elipsa 35 m", df: ["RF-1", "RF-2", "RF-3"], note: "Triangulacja RF/DF trzech czujników · zgodna z pozycją operatora z Remote ID" },
      procedure: "PROC-UAV-01",
      aiNotes: "Profil lotu odpowiada rozpoznaniu, nie przelotowi: obiekt zwolnił nad rozdzielnią, wykonał dwa zawisy i krąży po okręgu o promieniu ok. 440 m, utrzymując aktywo w kadrze. Łącze RC jest aktywne, więc operator jest w zasięgu – triangulacja wskazuje pobocze drogi dojazdowej. To trzecie takie wejście z tym samym numerem seryjnym w ciągu 30 dni (patrz: Inteligencja).",
      autoNote: "Pakiet dowodowy nagrywa się od chwili pierwszej detekcji: ślad radarowy, nagranie EO/IR i zrzut Remote ID.",
      multi: true,
      options: [
        { label: "Przejmij cel na EO/IR i zbliż", action: "lock" },
        { label: "Zlokalizuj operatora (RF/DF)", action: "locate" },
        { label: "Pokaż powiązania z wcześniejszymi zdarzeniami", action: "intel" },
        { label: "Wyślij patrol do operatora", action: "patrol", target: "operator",
          arrival: "Patrol jest na miejscu. Zastano mężczyznę z aparaturą sterującą w pojazdzie dostawczym. Dane zabezpieczone, osoba przekazana przybyłej Policji." },
        { label: "Zgłoś Policji i do PAŻP", action: "notify", to: "Policja (112) · PAŻP ASM-1",
          text: "Zgłoszenie wysłane automatycznie z pakietem: pozycja BSP, numer seryjny, Remote ID, pozycja operatora, nagranie EO/IR.",
          reply: "Dyżurny KPP Bełchatów potwierdził przyjęcie zgłoszenia. Radiowóz skierowany na drogę dojazdową, czas dojazdu 9 min.", replyDelay: 7000 },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
        { label: "To fałszywy alarm", action: "false", cls: "good" },
      ],
      interjections: {
        1: `PansaUTM: <span class="r">brak planu lotu</span> dla tego numeru seryjnego. Rejestr zgód PGE: brak zgody na loty nad obiektem dla tego operatora.`,
        2: `Dowódca zmiany SUFO i inżynier ruchu bloku potwierdzili przyjęcie informacji. Poziom zagrożenia: <span class="y">ŻÓŁTY</span>.`,
        4: `Policja potwierdziła przyjęcie zgłoszenia. PAŻP nadał zdarzeniu numer <span class="h">ASM-1/2025/4471</span>.`,
        5: `BSP wszedł na chwilę nad strefę zakazaną (odległość 380 m od transformatorów blokowych), po czym wrócił na okrąg 440 m. Wniosek o środki aktywne pozostaje w gotowości.`,
      },
      intelCard: "op-114",
    },

    /* ---------------------------------------------------------------- 2 */
    {
      id: "ZD-02",
      site: "belchatow",
      severity: "KRYTYCZNY",
      threat: "CZERWONY",
      title: "BSP z ładunkiem nad transformatorami blokowymi · zrzut przedmiotu",
      summary: "Od południowego wschodu wszedł ciężki wielowirnikowiec bez Remote ID, z ładunkiem podwieszonym pod kadłubem. Termowizja pokazuje ciepły element pod spodem. Obiekt leci bezpośrednio na transformatory blokowe i rozdzielnię 400 kV, na wysokości 45–80 m, poniżej linii dachów hal.",
      sensor: "EOIR-1",
      video: "videos/inc-02-payload.mp4",
      boxes: [
        { x: 38, y: 24, w: 20, h: 20, label: "BSP CIĘŻKI · BEZ REMOTE ID", cls: "" },
        { x: 44, y: 44, w: 9, h: 9, label: "ŁADUNEK PODWIESZONY", cls: "attn" },
      ],
      target: {
        trk: "TRK-1207", cls: "hostile", kindLabel: "BSP wielowirnikowy ciężki (8 wirników)",
        model: "konstrukcja własna / rama klasy 1 200 mm", serial: "—", rid: "BRAK",
        mtow: "ok. 14 kg (szacowane z RCS i sygnatury akustycznej)", payload: "pakiet ok. 3–4 kg podwieszony, źródło ciepła 41 °C",
        link: "łącze cyfrowe 1,2 GHz, szyfrowane – brak identyfikatora", home: "nieznany, kierunek SE",
      },
      fusion: [
        { s: "RAD-2",  label: "Radar 3D RAD-2",         v: 0.96, note: "RCS 0,09 m² – klasa ciężka, prędkość 14 m/s, wysokość 45–80 m" },
        { s: "RF-3",   label: "RF/DF RF-3",             v: 0.44, note: "emisja 1,2 GHz, brak Remote ID, brak identyfikatora producenta" },
        { s: "EOIR-1", label: "Głowica EO/IR EOIR-1",   v: 0.98, note: "8 wirników, ładunek podwieszony, kanał IR: element 41 °C" },
        { s: "AKU-1",  label: "Macierz akustyczna AKU-1", v: 0.86, note: "sygnatura 8 wirników pod obciążeniem – zgodna z masą > 10 kg" },
        { s: "UTM-1",  label: "PansaUTM / ADS-B",       v: 0.00, neg: true, note: "brak planu lotu, brak transpondera, brak Remote ID" },
      ],
      detections: [
        ["BSP ciężki (> 10 kg)", 0.96], ["ładunek podwieszony", 0.94], ["brak Remote ID", 1.0],
        ["lot poniżej linii dachów (unikanie detekcji)", 0.9], ["kurs bezpośredni na aktywo krytyczne", 0.97],
        ["ZRZUT PRZEDMIOTU", 0.95],
      ],
      tracks: [
        {
          id: "TRK-1207", cls: "hostile", label: "TRK-1207 · BSP CIĘŻKI",
          wps: [[0, 690, 412, 40], [38, 648, 372, 64], [74, 616, 342, 60], [108, 590, 316, 50], [136, 573, 301, 44], [168, 571, 299, 42], [198, 596, 326, 60], [244, 648, 376, 74], [292, 700, 426, 78]],
        },
      ],
      events: [{ t: 150, kind: "drop", x: 570, y: 298, label: "PRZEDMIOT ZRZUCONY · przy TR blokowym 2" }],
      procedure: "PROC-UAV-02",
      aiNotes: "To nie jest rozpoznanie. Obiekt leci najkrótszą trasą do transformatorów blokowych, poniżej linii dachów – tak, by pozostać w cieniu radarowym hal. Brak Remote ID i szyfrowane łącze 1,2 GHz oznaczają, że przejęcie protokołu producenta nie zadziała. Zakłócanie łącza przy ładunku nad aktywem jest ryzykowne: niekontrolowany upadek nastąpiłby nad transformatorami. Rekomendacja: natychmiastowa ewakuacja rejonu, zgoda na środki aktywne, przechwycenie poza obrysem aktywa.",
      autoNote: "Zapisuję tor lotu, moment zrzutu i stopklatkę przedmiotu z czasem UTC.",
      multi: true,
      options: [
        { label: "Przejmij cel na EO/IR i zbliż", action: "lock" },
        { label: "Wystąp o zgodę na środki aktywne (art. 26a)", action: "roe", cls: "danger" },
        { label: "Zakłócaj łącze RC", action: "jam", effect: "rth", cls: "danger",
          warn: "Zakłócanie nad aktywem krytycznym grozi niekontrolowanym upadkiem ładunku na transformator." },
        { label: "Wyślij dron przechwytujący", action: "intercept", from: "INT-1", cls: "danger" },
        { label: "Powiadom Policję, PSP i ABW", action: "notify", to: "Policja (112) · PSP · ABW",
          text: "Zgłoszenie krytyczne wysłane: BSP z ładunkiem nad obiektem IK, pozycja zrzutu, tor lotu, nagranie.",
          reply: "PSP: zastęp w drodze, czas dojazdu 11 min. Policja: pirotechnicy powiadomieni. ABW przyjęła zgłoszenie.", replyDelay: 8000 },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
      ],
      interjections: {
        1: `<span class="g">Rejon transformatorów i rozdzielni wyludniony</span> – 11 osób potwierdziło wycofanie, obchody wstrzymane.`,
        2: `Prace na placu przy IOS wstrzymane. Brygada remontowa wycofana za halę turbin.`,
        3: `Zgoda na środki aktywne: <span class="y">wniosek przekazany</span>, oczekiwanie na potwierdzenie dowódcy ochrony i służb.`,
        4: `Policja i PSP potwierdziły przyjęcie zgłoszenia. Pirotechnicy w drodze – czas dojazdu 28 min.`,
        5: `Strefa 100 m wokół przedmiotu wyznaczona i oznakowana. Kamera EOIR-1 utrzymuje przedmiot w kadrze.`,
        6: `Dyspozytor (KDM) potwierdza przygotowany wariant pracy bloku bez rozdzielni 400 kV – przełączenie w 4 min od decyzji.`,
      },
    },

    /* ---------------------------------------------------------------- 3 */
    {
      id: "ZD-03",
      site: "belchatow",
      severity: "NISKI",
      threat: "ZIELONY",
      title: "Dwa ślady odrzucone automatycznie: klucz ptaków i autoryzowany dron inspekcyjny",
      summary: "W ciągu 40 s radar zgłosił dwa nowe ślady w strefie detekcji. System rozstrzygnął oba bez alarmu: pierwszy to klucz ptaków (brak emisji RF, sygnatura mikro-Dopplera z trzepotaniem skrzydeł, profil lotu termiczny), drugi to dron inspekcyjny wykonawcy z aktywną zgodą i planem lotu w PansaUTM. Pokazuję, dlaczego – to jest ta część, która decyduje o liczbie fałszywych alarmów na zmianie.",
      sensor: "EOIR-2",
      video: "videos/inc-03-birds.mp4",
      boxes: [
        { x: 24, y: 20, w: 22, h: 14, label: "PTAKI · 11 OBIEKTÓW", cls: "bird" },
        { x: 62, y: 46, w: 12, h: 12, label: "BSP AUTORYZOWANY · ZGODA 2025/114", cls: "friend" },
      ],
      target: {
        trk: "TRK-1312", cls: "bird", kindLabel: "Klucz ptaków (11 obiektów)",
        model: "—", serial: "—", rid: "nie dotyczy", mtow: "—",
        payload: "—", link: "brak emisji RF", home: "—",
      },
      fusion: [
        { s: "RAD-1",  label: "Radar 3D RAD-1",         v: 0.88, note: "11 ech grupowych, mikro-Doppler: trzepotanie 3,8 Hz – nie wirnik" },
        { s: "RF-1",   label: "RF/DF RF-1",             v: 0.00, note: "brak jakiejkolwiek emisji w pasmach BSP" },
        { s: "EOIR-2", label: "Głowica EO/IR EOIR-2",   v: 0.93, note: "klasyfikator: ptaki, sylwetka i ruch skrzydeł" },
        { s: "AKU-1",  label: "Macierz akustyczna AKU-1", v: 0.05, note: "brak sygnatury wirnikowej" },
        { s: "UTM-1",  label: "PansaUTM",               v: 0.99, note: "drugi ślad: plan lotu 2025/114, wykonawca Energo-Serwis, korytarz inspekcyjny kotła" },
      ],
      detections: [
        ["ptaki (klucz)", 0.93], ["brak emisji RF", 1.0], ["mikro-Doppler: trzepotanie skrzydeł", 0.95],
        ["BSP autoryzowany · zgoda 2025/114", 0.99], ["lot w zatwierdzonym korytarzu", 0.97],
      ],
      tracks: [
        { id: "TRK-1312", cls: "bird", label: "TRK-1312 · PTAKI ×11",
          wps: [[0, 700, 196, 160], [60, 624, 238, 152], [120, 548, 278, 142], [180, 476, 312, 150], [240, 404, 344, 164]] },
        { id: "TRK-1313", cls: "friend", label: "TRK-1313 · BSP INSPEKCYJNY · ZGODA 2025/114",
          wps: [[6, 406, 242, 40], [40, 420, 262, 70], [78, 452, 274, 80], [128, 492, 276, 80], [176, 530, 268, 70], [210, 556, 250, 55], [244, 530, 268, 70], [294, 452, 274, 80], [330, 420, 262, 60]] },
      ],
      procedure: "PROC-INSP-01",
      aiNotes: "Rozstrzygnięcie ptaków: radar widzi 11 ech o RCS 0,004–0,008 m², mikro-Doppler pokazuje trzepotanie 3,8 Hz (wirnik dałby 90–130 Hz), prędkość 9 m/s z wiatrem, wysokość rośnie i spada wraz z kominem termicznym, brak jakiejkolwiek emisji RF. Rozstrzygnięcie drona: Remote ID zgodny z planem lotu 2025/114 (Energo-Serwis, pilot M. Zając, zgoda ważna do 18:00), tor lotu w zatwierdzonym korytarzu inspekcji kotła z marginesem 18 m. Oba ślady zamykam automatycznie, do dziennika, bez alarmu dla operatora.",
      autoNote: "Takie przypadki system zamyka sam – w ostatnich 30 dniach 1 284 na 1 309 śladów nie wymagało żadnej reakcji operatora.",
      multi: true,
      options: [
        { label: "Pokaż uzasadnienie klasyfikacji", action: "analysis" },
        { label: "Sprawdź zgodę i plan lotu BSP", action: "permit" },
        { label: "Przejmij cel na EO/IR i zbliż", action: "lock" },
        { label: "Zamknij oba ślady", action: "close", cls: "good" },
      ],
      noAlarm: true,
    },

    /* ---------------------------------------------------------------- 4 */
    {
      id: "ZD-04",
      site: "belchatow",
      severity: "KRYTYCZNY",
      threat: "CZERWONY",
      title: "Rój pięciu BSP · lot autonomiczny, atak skoordynowany",
      summary: "Pięć śladów weszło do strefy detekcji w ciągu 20 s z czterech różnych kierunków, z identycznym profilem prędkości i wysokości. Żaden nie emituje łącza RC ani Remote ID – lot jest zaprogramowany, autonomiczny. Tory zbiegają się na rozdzielni 400 kV i nastawni. Zakłócanie łącza sterowania nie przyniesie efektu.",
      sensor: "EOIR-2",
      video: "videos/inc-04-swarm.mp4",
      boxes: [
        { x: 16, y: 26, w: 11, h: 11, label: "CEL 1", cls: "" },
        { x: 34, y: 20, w: 11, h: 11, label: "CEL 2", cls: "" },
        { x: 52, y: 30, w: 11, h: 11, label: "CEL 3 · PRIORYTET", cls: "" },
        { x: 70, y: 22, w: 11, h: 11, label: "CEL 4", cls: "" },
      ],
      target: {
        trk: "TRK-1401", cls: "hostile", kindLabel: "Rój BSP · 5 obiektów, platformy jednotypowe",
        model: "płatowiec typu FPV, rozpiętość ok. 1,1 m", serial: "—", rid: "BRAK",
        mtow: "ok. 3,5 kg każdy", payload: "nieustalony, masa ok. 1 kg na obiekt",
        link: "BRAK EMISJI – lot autonomiczny po punktach", home: "nieustalony, cztery różne kierunki wejścia",
      },
      fusion: [
        { s: "RAD-1",  label: "Radar 3D RAD-1",         v: 0.95, note: "3 ślady z sektora N i W, prędkość 22 m/s, wysokość 110 m" },
        { s: "RAD-2",  label: "Radar 3D RAD-2",         v: 0.93, note: "2 ślady z sektora S i E, identyczny profil – korelacja czasowa 0,96" },
        { s: "RF-1",   label: "RF/DF RF-1",             v: 0.02, neg: true, note: "BRAK łącza RC i Remote ID – zakłócanie RC bezskuteczne" },
        { s: "EOIR-2", label: "Głowica EO/IR EOIR-2",   v: 0.9,  note: "potwierdzono 4 z 5 obiektów w kadrze, platformy jednotypowe" },
        { s: "AKU-1",  label: "Macierz akustyczna AKU-1", v: 0.78, note: "sygnatura wielu wirników, kierunki rozbieżne" },
        { s: "UTM-1",  label: "PansaUTM / ADS-B",       v: 0.00, neg: true, note: "brak planów lotu, brak transponderów" },
      ],
      detections: [
        ["rój BSP · 5 obiektów", 0.95], ["lot autonomiczny (brak RC)", 0.98], ["korelacja torów: atak skoordynowany", 0.96],
        ["cel priorytetowy: rozdzielnia 400 kV", 0.94], ["platformy jednotypowe", 0.91],
      ],
      tracks: [
        { id: "TRK-1401", cls: "hostile", label: "TRK-1401 · CEL 3 · PRIORYTET",
          wps: [[0, 860, 300, 120], [40, 764, 302, 115], [76, 680, 306, 108], [104, 636, 318, 92], [122, 620, 346, 76]], orbit: { cx: 620, cy: 330, r: 16, period: 42, alt: 72 } },
        { id: "TRK-1402", cls: "hostile", label: "TRK-1402 · CEL 1",
          wps: [[4, 520, 60, 120], [38, 512, 148, 114], [74, 502, 236, 104], [106, 494, 302, 88], [126, 490, 320, 74]], orbit: { cx: 486, cy: 334, r: 14, period: 38, alt: 70 } },
        { id: "TRK-1403", cls: "hostile", label: "TRK-1403 · CEL 2",
          wps: [[8, 260, 182, 120], [42, 326, 220, 114], [78, 396, 258, 104], [112, 452, 300, 88], [132, 466, 320, 76]], orbit: { cx: 486, cy: 334, r: 24, period: 48, alt: 80 } },
        { id: "TRK-1404", cls: "hostile", label: "TRK-1404 · CEL 4",
          wps: [[12, 548, 556, 120], [46, 552, 472, 112], [82, 572, 406, 100], [112, 600, 368, 86], [134, 618, 350, 74]], orbit: { cx: 620, cy: 330, r: 28, period: 54, alt: 74 } },
        { id: "TRK-1405", cls: "hostile", label: "TRK-1405 · CEL 5",
          wps: [[16, 820, 470, 125], [50, 752, 428, 118], [86, 684, 388, 108], [118, 638, 356, 92], [140, 622, 344, 80]], orbit: { cx: 620, cy: 330, r: 36, period: 66, alt: 85 } },
      ],
      procedure: "PROC-UAV-03",
      aiNotes: "Korelacja czasowa wejść wynosi 0,96 – pięć obiektów weszło w strefę w ciągu 20 s z czterech kierunków, co wyklucza przypadek. Brak emisji RC i Remote ID oznacza lot po zaprogramowanych punktach: zakłócanie łącza sterowania nie da efektu, natomiast zakłócanie GNSS może wprowadzić je w tryb awaryjny (zawis lub powrót po ostatnim kursie). Cele 3 i 4 zbiegają się na rozdzielni 400 kV, cele 1 i 2 na nastawni centralnej. Priorytet: cel 3 (najmniejsza odległość do aktywa, najszybsze zniżanie). Dron przechwytujący obsłuży jeden cel w jednym podejściu – potrzebna zgoda na środki aktywne i wsparcie służb.",
      autoNote: "Prowadzę wszystkie pięć śladów jednocześnie i aktualizuję priorytety co 2 s.",
      multi: true,
      options: [
        { label: "Przypisz priorytety celów", action: "priority" },
        { label: "Wystąp o zgodę na środki aktywne (art. 26a)", action: "roe", cls: "danger" },
        { label: "Zakłócaj łącze RC", action: "jam", effect: "none", cls: "danger" },
        { label: "Wyślij dron przechwytujący na cel priorytetowy", action: "intercept", from: "INT-1", cls: "danger" },
        { label: "Powiadom Policję i ABW o ataku skoordynowanym", action: "notify", to: "Policja (112) · ABW · RCB",
          text: "Zgłoszenie krytyczne: skoordynowany lot 5 BSP nad obiektem IK. Przekazano tory lotu, pozycje i obraz EO/IR.",
          reply: "ABW przyjęła zgłoszenie i poprosiła o kanał bezpośredni. Policja kieruje dwa radiowozy na drogi dojazdowe. RCB odnotowało zdarzenie.", replyDelay: 8000 },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
      ],
      interjections: {
        1: `<span class="g">Bramy zamknięte, wjazdy wstrzymane.</span> 34 osoby potwierdziły schronienie w budynkach.`,
        2: `Potwierdzam: <span class="r">brak emisji RC na wszystkich pięciu śladach</span>. Zakłócanie RC pomijam, przechodzę do wariantu GNSS i przechwycenia.`,
        3: `Zgoda na środki aktywne: potwierdzona przez dowódcę ochrony, zgłoszona do Policji. Środki <span class="r">UZBROJONE</span>.`,
        4: `Dron przechwytujący wystartował. Cel 3 przechwycony nad placem przy nastawni, poza obrysem rozdzielni.`,
        5: `Nastawnia i rozdzielnia zabezpieczone. Cele 1, 2, 4 i 5 utrzymywane na EO/IR – dwa zaczęły zniżać się nad terenem niezabudowanym.`,
      },
    },

    /* ---------------------------------------------------------------- 5 */
    {
      id: "ZD-05",
      site: "baltica",
      severity: "WYSOKI",
      threat: "CZERWONY",
      title: "BSP startujący z nieoznaczonej jednostki w akwenie farmy",
      summary: "Radar morski od 14 minut prowadzi echo nawodne bez korelacji z AIS – jednostka ok. 24 m, kurs zmienny, prędkość 3 w. O 02:41 z tej jednostki wystartował BSP i leci wprost na morską stację elektroenergetyczną OSS na wysokości 45–60 m. Łącze RC prowadzi z powrotem do jednostki.",
      sensor: "EOIR-11",
      video: "videos/inc-05-vessel.mp4",
      boxes: [
        { x: 40, y: 30, w: 14, h: 14, label: "BSP · START Z JEDNOSTKI", cls: "" },
        { x: 20, y: 62, w: 30, h: 16, label: "JEDNOSTKA BEZ AIS · ok. 24 m", cls: "attn" },
      ],
      target: {
        trk: "TRK-2104", cls: "hostile", kindLabel: "BSP wielowirnikowy (klasa C3), start z pokładu",
        model: "nieustalony, 6 wirników, kadłub ciemny", serial: "—", rid: "BRAK",
        mtow: "ok. 7 kg", payload: "głowica obserwacyjna EO/IR", link: "2,4 GHz, namiar na jednostkę nawodną",
        home: "jednostka bez AIS, pozycja 54°51'N 017°28'E",
      },
      fusion: [
        { s: "RAD-11",  label: "Radar 3D RAD-11 (OSS)",   v: 0.95, note: "ślad powietrzny i echo nawodne z tej samej pozycji startu" },
        { s: "AIS-11",  label: "AIS + radar nawodny",     v: 0.00, neg: true, note: "BRAK transmisji AIS dla echa – jednostka nieoznaczona („dark ship”)" },
        { s: "RF-11",   label: "RF/DF RF-11 (OSS)",       v: 0.91, note: "łącze 2,4 GHz, namiar 118° – pokrywa się z pozycją jednostki" },
        { s: "RF-12",   label: "RF/DF RF-12 (B-08)",      v: 0.87, note: "namiar 162° – triangulacja potwierdza pokład jednostki" },
        { s: "EOIR-11", label: "Głowica EO/IR EOIR-11",   v: 0.94, note: "kanał IR: ciepłe silniki jednostki, sylwetka BSP nad pokładem" },
        { s: "SAT-11",  label: "Zobrazowanie satelitarne", v: 0.00, note: "nie zamówiono – dostępne na żądanie (SAR, ok. 40 min)" },
      ],
      detections: [
        ["BSP wielowirnikowy", 0.96], ["start z jednostki nawodnej", 0.93], ["jednostka bez AIS", 1.0],
        ["kurs na OSS 275 kV", 0.97], ["brak Remote ID", 1.0], ["pora nocna · tryb IR", 1.0],
      ],
      tracks: [
        { id: "TRK-2104", cls: "hostile", label: "TRK-2104 · BSP Z JEDNOSTKI",
          wps: [[0, 646, 470, 15], [16, 622, 464, 42], [44, 584, 454, 56], [72, 548, 444, 56], [96, 522, 404, 48]],
          orbit: { cx: 500, cy: 430, r: 34, period: 134, alt: 45 } },
      ],
      highlight: ["UNK"],
      operator: { x: 646, y: 474, label: "JEDNOSTKA BEZ AIS · pozycja startu", df: ["RF-11", "RF-12"], note: "Namiary RF z OSS i turbiny B-08 przecinają się na pokładzie jednostki" },
      procedure: "PROC-MOR-01",
      aiNotes: "Najważniejsza w tym zdarzeniu jest korelacja: ten sam punkt na morzu jest jednocześnie echem nawodnym bez AIS, źródłem łącza RC i punktem startu śladu powietrznego. Jednostka weszła w akwen farmy z toru podejściowego od wschodu i wyłączyła AIS 14 minut przed startem BSP – to zachowanie powtarza się trzeci raz w tym kwartale (patrz: Inteligencja). BSP krąży nad OSS na wysokości 45 m i utrzymuje kamerę na rozdzielni i na kablu eksportowym. Zalecenie: wywołanie na VHF, zgłoszenie do MOSG i VTS, zamówienie zobrazowania satelitarnego oraz wstrzymanie transferów personelu w sektorze.",
      autoNote: "Pakiet dowodowy obejmuje ślad radarowy, namiary RF, nagranie IR i wyciąg AIS z luką transmisji.",
      multi: true,
      options: [
        { label: "Przejmij cel na EO/IR i zbliż", action: "lock" },
        { label: "Pokaż korelację AIS / radar / RF", action: "analysis" },
        { label: "Wywołaj jednostkę na VHF kanał 16", action: "hail",
          text: "„Jednostka w pozycji 54°51'N 017°28'E, tu stacja Baltica 2, podaj nazwę, port macierzysty i cel pobytu w strefie bezpieczeństwa farmy. Odbiór.”",
          after: "Brak odpowiedzi na trzy wywołania. Jednostka zmieniła kurs na wschód i zwiększyła prędkość do 9 w. BSP wraca w jej kierunku.", afterDelay: 9000 },
        { label: "Powiadom Straż Graniczną i VTS", action: "notify", to: "Morski Oddział SG · VTS · RCB",
          text: "Zgłoszenie wysłane: pozycja jednostki, luka AIS, tor lotu BSP, nagranie EO/IR.",
          reply: "MOSG: jednostka SG-312 skierowana w rejon, czas dojścia 38 min. VTS potwierdza brak zgłoszenia jednostki w systemie meldunkowym.", replyDelay: 8000 },
        { label: "Zamów zobrazowanie satelitarne akwenu", action: "sat" },
        { label: "Wstrzymaj transfery na turbiny w sektorze", action: "stopops" },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
      ],
      interjections: {
        1: `Wyciąg AIS: transmisja jednostki urwała się o <span class="y">02:27</span>, 14 min przed startem BSP. Zapisałem to jako dowód.`,
        2: `MOSG potwierdził przyjęcie zgłoszenia. VTS: jednostka nie zgłosiła wejścia w akwen.`,
        3: `Trzy wywołania VHF bez odpowiedzi – nagrania zapisane w karcie zdarzenia.`,
        4: `Zobrazowanie satelitarne zamówione, przewidywana dostawa w ciągu 40 min. EO/IR utrzymuje jednostkę w kadrze.`,
        5: `SOV „Baltica Supporter” potwierdza wstrzymanie transferów. 9 techników pozostaje na turbinach B-14…B-18 w procedurze bezpiecznego oczekiwania.`,
      },
      intelCard: "dark-ship",
    },

    /* ---------------------------------------------------------------- 6 */
    {
      id: "ZD-06",
      site: "baltica",
      severity: "ŚREDNI",
      threat: "ŻÓŁTY",
      title: "Zakłócanie GNSS w akwenie farmy · wpływ na operacje",
      summary: "Stacja referencyjna na OSS, dron inspekcyjny i dwie jednostki serwisowe jednocześnie raportują utratę jakości pozycji GNSS. Spadek C/N₀ o 14 dB, rozbieżność pozycji do 160 m. To nie awaria odbiornika – zakłócenia są szerokopasmowe i kierunkowe. Dron inspekcyjny automatycznie przeszedł w zawis nad turbiną B-18.",
      sensor: "EOIR-12",
      video: "videos/inc-06-gnss.mp4",
      boxes: [{ x: 46, y: 36, w: 13, h: 13, label: "BSP INSPEKCYJNY · ZAWIS · BRAK GNSS", cls: "friend" }],
      target: {
        trk: "TRK-2211", cls: "friend", kindLabel: "Zakłócenia GNSS · wpływ na BSP inspekcyjny i jednostki",
        model: "źródło nieustalone, kierunek 104°", serial: "—", rid: "nie dotyczy",
        mtow: "—", payload: "—", link: "zakłócenia szerokopasmowe L1/L2, moc rosnąca",
        home: "namiar wskazuje sektor wschodni akwenu",
      },
      fusion: [
        { s: "RF-11",   label: "RF/DF RF-11 (OSS)",       v: 0.88, note: "szerokopasmowa emisja w pasmie L1 (1575 MHz), namiar 104°" },
        { s: "RF-13",   label: "RF/DF RF-13 (B-25)",      v: 0.81, note: "namiar 86° – przecięcie w sektorze wschodnim, ok. 2,1 km od OSS" },
        { s: "RAD-11",  label: "Radar 3D RAD-11 (OSS)",   v: 0.62, note: "w rejonie przecięcia jedno echo nawodne, prędkość 4 w." },
        { s: "AIS-11",  label: "AIS + radar nawodny",     v: 0.30, neg: true, note: "echo bez korelacji AIS – możliwa ta sama jednostka co w ZD-05" },
        { s: "EOIR-12", label: "Głowica EO/IR EOIR-12",   v: 0.74, note: "BSP inspekcyjny w zawisie, stabilny, bez oznak awarii" },
        { s: "SAT-11",  label: "Zobrazowanie satelitarne", v: 0.00, note: "nie zamówiono" },
      ],
      detections: [
        ["zakłócanie GNSS (jamming)", 0.93], ["emisja szerokopasmowa L1/L2", 0.95],
        ["spadek C/N₀ 14 dB na 3 odbiornikach", 1.0], ["rozbieżność pozycji do 160 m", 0.97],
        ["wpływ: BSP inspekcyjny w zawisie", 1.0], ["wpływ: jednostki z DP", 0.9],
      ],
      tracks: [
        { id: "TRK-2211", cls: "friend", label: "TRK-2211 · BSP INSPEKCYJNY · ZAWIS",
          wps: [[0, 792, 302, 70], [34, 758, 270, 72], [60, 740, 258, 72]], orbit: { cx: 736, cy: 254, r: 6, period: 90, alt: 72 } },
      ],
      operator: { x: 688, y: 420, label: "ŹRÓDŁO ZAKŁÓCEŃ · sektor wschodni", df: ["RF-11", "RF-13"], note: "Przecięcie namiarów RF · zgodne z pozycją echa nawodnego bez AIS" },
      procedure: "PROC-GNSS-01",
      aiNotes: "Trzy niezależne odbiorniki tracą jakość pozycji w tej samej chwili i w tym samym pasmie – to wyklucza awarię sprzętu i wskazuje na zakłócanie zewnętrzne. Namiary z OSS i z turbiny B-25 przecinają się ok. 2,1 km na wschód od OSS, gdzie radar widzi jedną jednostkę bez AIS. Operacyjnie: transfery personelu i prace z pozycjonowaniem dynamicznym trzeba wstrzymać, a BSP inspekcyjny sprowadzić na nawigacji zastępczej. Zdarzenie wymaga zgłoszenia do UKE i PAŻP niezależnie od dalszych decyzji.",
      autoNote: "Zapisuję widmo, namiary i czas trwania zakłóceń – to materiał do zgłoszenia do UKE.",
      multi: true,
      options: [
        { label: "Potwierdź na niezależnych odbiornikach", action: "gnss" },
        { label: "Wstrzymaj loty BSP i operacje DP", action: "stopops" },
        { label: "Pokaż namiary i widmo", action: "analysis" },
        { label: "Zgłoś do UKE i PAŻP", action: "notify", to: "UKE · PAŻP · MOSG",
          text: "Zgłoszenie wysłane: widmo zakłóceń, namiary, czas trwania, lista wpływu operacyjnego.",
          reply: "UKE potwierdziło przyjęcie zgłoszenia (nr ZK/2025/318). MOSG przyjął informację o pozycji źródła.", replyDelay: 7000 },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
      ],
      interjections: {
        1: `Potwierdzone na 3 z 3 odbiorników: stacja referencyjna OSS, BSP inspekcyjny, CTV „Wind Breeze”.`,
        2: `Loty BSP wstrzymane. CTV i SOV potwierdziły przejście na nawigację zastępczą.`,
        3: `Załogi poinformowane o charakterze zakłóceń. SOV zgłasza stabilną pozycję na radarze i wizualnie.`,
        4: `Namiar źródła: 104° / 86°, przecięcie 2,1 km E od OSS. Widmo i czas trwania zapisane.`,
      },
    },

    /* ---------------------------------------------------------------- 7 */
    {
      id: "ZD-07",
      site: "baltica",
      severity: "NISKI",
      threat: "ZIELONY",
      title: "Autoryzowany BSP inspekcyjny wyszedł z korytarza przy obracającej się łopacie",
      summary: "Dron wykonawcy (zgoda 2025/207, inspekcja łopat B-18) opuścił zatwierdzony korytarz i zbliżył się na 22 m do płaszczyzny obrotu wirnika, który nie jest zatrzymany. To nie jest zagrożenie celowe – to zagrożenie bezpieczeństwa pracy i naruszenie warunków zgody.",
      sensor: "EOIR-12",
      video: "videos/inc-07-corridor.mp4",
      boxes: [{ x: 42, y: 34, w: 14, h: 14, label: "BSP 2025/207 · 22 m OD WIRNIKA", cls: "friend" }],
      target: {
        trk: "TRK-2250", cls: "friend", kindLabel: "BSP autoryzowany · inspekcja łopat",
        model: "DJI Matrice 350 RTK", serial: "1ZNBJ8E0022145", rid: "ODCZYTANY",
        mtow: "6,5 kg", payload: "Zenmuse H20T", link: "O3 Enterprise · aktywne",
        home: "pokład SOV „Baltica Supporter”, pilot: K. Zielińska (Energo-Serwis)",
      },
      fusion: [
        { s: "RAD-12",  label: "Radar 3D RAD-12 (B-13)",  v: 0.9,  note: "ślad w odległości 22 m od płaszczyzny obrotu – poza korytarzem" },
        { s: "RF-12",   label: "RF/DF RF-12 (B-08)",      v: 0.99, note: "Remote ID zgodny ze zgodą 2025/207" },
        { s: "EOIR-12", label: "Głowica EO/IR EOIR-12",   v: 0.96, note: "autotracking, widoczny BSP i obracający się wirnik" },
        { s: "AIS-11",  label: "AIS + radar nawodny",     v: 0.99, note: "SOV „Baltica Supporter” w pozycji roboczej, 340 m od B-18" },
        { s: "SAT-11",  label: "Zobrazowanie satelitarne", v: 0.00, note: "nie dotyczy" },
      ],
      detections: [
        ["BSP autoryzowany · zgoda 2025/207", 0.99], ["wyjście z korytarza inspekcyjnego", 0.97],
        ["odległość od wirnika 22 m", 1.0], ["wirnik w ruchu", 1.0], ["brak cech zagrożenia celowego", 0.96],
      ],
      tracks: [
        { id: "TRK-2250", cls: "friend", label: "TRK-2250 · BSP 2025/207",
          wps: [[0, 792, 332, 60], [20, 774, 310, 70], [40, 758, 286, 80], [60, 746, 268, 92], [80, 739, 258, 100], [100, 736, 254, 104]],
          orbit: { cx: 736, cy: 254, r: 4, period: 30, alt: 104 } },
      ],
      highlight: ["B-18"],
      procedure: "PROC-INSP-01",
      aiNotes: "Ślad ma aktywną zgodę i poprawny Remote ID, więc nie traktuję go jako zagrożenia. Problem jest inny: tor lotu wyszedł z zatwierdzonego korytarza o 34 m i zbliżył się na 22 m do płaszczyzny obrotu wirnika B-18, który pracuje. Warunek zgody wymaga zatrzymania wirnika przed inspekcją łopat. Rekomendacja: ostrzeżenie operatora, nakaz wycofania, karta niezgodności dla wykonawcy. To drugie takie odstępstwo tego wykonawcy w tym miesiącu.",
      autoNote: "Odstępstwo trafia do rejestru wykonawcy automatycznie – z torem lotu i nagraniem.",
      multi: true,
      options: [
        { label: "Ostrzeż operatora przez kanał roboczy", action: "hail",
          text: "„Energo-Serwis, lot 2025/207 – wyszliście z korytarza inspekcyjnego, 22 m od płaszczyzny obrotu B-18. Wycofać się natychmiast na pozycję bezpieczną.”",
          after: "Pilot potwierdził i wycofał BSP na 120 m od wirnika. Dron wrócił do korytarza.", afterDelay: 7000 },
        { label: "Nakaż zawieszenie lotu", action: "suspend", cls: "danger" },
        { label: "Sprawdź zgodę i warunki lotu", action: "permit" },
        { label: "Uruchom procedurę", action: "confirm", cls: "danger" },
        { label: "Zamknij zdarzenie", action: "close", cls: "good" },
      ],
      interjections: {
        1: `Zgoda 2025/207: ważna do 16:00, warunek – <span class="y">wirnik zatrzymany na czas inspekcji łopat</span>. Wirnik pracuje, warunek niespełniony.`,
        2: `Pilot potwierdził ostrzeżenie i wycofał BSP. Odległość od wirnika: 120 m.`,
        3: `Inżynier nadzoru powiadomiony. Karta niezgodności NC-2025-0442 utworzona dla Energo-Serwis.`,
      },
    },
  ];

  /* ====================================================================
     WARSTWA INTELIGENCJI · to, czego nie widzi pojedyncza zmiana:
     korelacje między zdarzeniami, powtarzalność, trendy, wnioski.
     ==================================================================== */
  const intel = {
    belchatow: {
      window: "ostatnie 30 dni · Elektrownia Bełchatów",
      kpis: [
        { k: "śladów przetworzonych", v: "1 309", cls: "" },
        { k: "zamkniętych automatycznie", v: "1 284", cls: "g" },
        { k: "alarmów dla operatora", v: "25", cls: "y" },
        { k: "potwierdzonych wejść BSP", v: "9", cls: "r" },
        { k: "fałszywych alarmów", v: "2", cls: "g" },
        { k: "mediana czasu do decyzji", v: "38 s", cls: "" },
      ],
      bars: { title: "Wejścia BSP w strefę ostrzegawczą · 14 dni", x: ["26", "27", "28", "29", "30", "01", "02", "03", "04", "05", "06", "07", "08", "09"], v: [0, 1, 0, 0, 2, 0, 1, 0, 0, 3, 1, 0, 0, 2], hot: [9, 13] },
      heat: {
        title: "Rozkład wejść · doba (co 2 h) × dzień tygodnia",
        rows: ["PN", "WT", "ŚR", "CZW", "PT", "SOB", "NDZ"],
        /* 12 kolumn = przedziały 00–02 … 22–24; wartości 0–4 */
        v: [
          [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1, 0],
          [0, 0, 0, 0, 0, 1, 0, 0, 1, 2, 0, 0],
          [0, 0, 0, 0, 0, 0, 1, 0, 2, 4, 3, 1],
          [0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 1, 0],
          [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        ],
      },
      entities: [
        { n: "OP-114 · operator nieustalony", d: "Numer seryjny 1581F5BND24C0098 (DJI Mavic 3T). Trzy wejścia: 12.09 (18:42), 26.09 (19:05), dziś (19:18). Zawsze czwartek, zawsze o zmierzchu, zawsze z drogi dojazdowej od zachodu. Ten sam numer seryjny odnotowano raz w Elektrowni Turów (03.09).", m: "3 wejścia · 30 dni" },
        { n: "OP-087 · wykonawca Energo-Serwis", d: "Dwa odstępstwa od korytarza inspekcyjnego (loty 2025/114 i 2025/207). Oba zamknięte kartą niezgodności, bez zagrożenia celowego.", m: "2 odstępstwa" },
        { n: "PTAKI · sektor NE", d: "47 śladów ptasich w 30 dni, głównie 05:00–07:00 i 18:00–20:00. Wszystkie odrzucone automatycznie – zero alarmów dla operatora.", m: "47 śladów · 0 alarmów" },
      ],
      verdict: `<span class="b">Wniosek analityczny:</span> wejścia BSP nad Bełchatów <span class="y">nie są losowe</span>. Trzy z dziewięciu dotyczą jednego numeru seryjnego, zawsze w czwartek między 18:40 i 19:20, zawsze z zachodniego pobocza drogi dojazdowej, zawsze z profilem rozpoznania nad rozdzielnią 400 kV. Ten sam numer seryjny wystąpił w Elektrowni Turów – to <span class="r">działanie powtarzalne i ponadobiektowe</span>, nie ciekawość przypadkowego pilota.`,
      recommendations: [
        "Uzgodnić z KPP Bełchatów obecność patrolu na drodze dojazdowej w czwartki 18:30–19:30 (koszt zerowy, prawdopodobieństwo ustalenia operatora wysokie).",
        "Dołożyć czujnik RF/DF po stronie zachodniej (RF-4) – skróci elipsę lokalizacji operatora z 35 m do ok. 12 m.",
        "Przygotować i podpisać z wyprzedzeniem wniosek o zgodę na środki aktywne (art. 26a) dla scenariusza „BSP z ładunkiem” – dziś ścieżka zajmuje 6–8 min.",
        "Włączyć numery seryjne z listy obserwacyjnej do automatycznego alarmu priorytetowego we wszystkich obiektach PGE.",
      ],
      cross: "Korelacja ponadobiektowa: numer seryjny 1581F5BND24C0098 widziany także w Elektrowni Turów (03.09, 18:55). Profil operatora OP-114 obejmuje dwa obiekty PGE.",
    },
    baltica: {
      window: "ostatnie 90 dni · Baltica 2",
      kpis: [
        { k: "śladów przetworzonych", v: "704", cls: "" },
        { k: "zamkniętych automatycznie", v: "688", cls: "g" },
        { k: "alarmów dla operatora", v: "16", cls: "y" },
        { k: "jednostek bez AIS w akwenie", v: "7", cls: "r" },
        { k: "zdarzeń GNSS", v: "4", cls: "y" },
        { k: "mediana czasu do decyzji", v: "51 s", cls: "" },
      ],
      bars: { title: "Zdarzenia w akwenie farmy · 14 tygodni", x: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "10", "11", "12", "13", "14"], v: [0, 1, 0, 2, 1, 0, 1, 3, 0, 1, 2, 0, 1, 3], hot: [7, 13] },
      heat: {
        title: "Rozkład zdarzeń · doba (co 2 h) × dzień tygodnia",
        rows: ["PN", "WT", "ŚR", "CZW", "PT", "SOB", "NDZ"],
        v: [
          [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
          [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
          [2, 4, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2],
          [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      },
      entities: [
        { n: "JEDNOSTKA „DARK” · profil DS-03", d: "Echo nawodne ok. 24 m, trzykrotnie w akwenie farmy (18.07, 29.08, dziś). Każdy raz: wejście od wschodu, wyłączenie AIS 10–20 min przed wejściem w strefę, pobyt 40–70 min, odejście na wschód. Dwa razy odnotowano start BSP z pokładu.", m: "3 wejścia · 90 dni" },
        { n: "ZAKŁÓCENIA GNSS · sektor E", d: "Cztery epizody, wszystkie w sektorze wschodnim, trzy z nich w ciągu 2 h od obecności jednostki bez AIS. Łączny czas niedostępności DP: 3 h 40 min.", m: "4 epizody" },
        { n: "BSP WYKONAWCÓW", d: "612 lotów autoryzowanych, 3 odstępstwa od korytarzy. Wszystkie rozstrzygnięte bez alarmu bezpieczeństwa – odstępstwa trafiły do kart niezgodności.", m: "612 lotów · 3 odstępstwa" },
      ],
      verdict: `<span class="b">Wniosek analityczny:</span> zdarzenia w akwenie farmy układają się w <span class="r">powtarzalny wzorzec rozpoznania</span>: jednostka bez AIS wchodzi nocą od wschodu, startuje z niej BSP nad OSS, a w tym samym sektorze pojawiają się zakłócenia GNSS. Trzy epizody w 90 dni, zawsze w godzinach 00:00–04:00, dwa razy w noc poprzedzającą planowany transfer personelu. Rekomendacja: stały kanał z Morskim Oddziałem SG i wcześniejsze zamawianie zobrazowania satelitarnego przy pierwszym echu bez AIS.`,
      recommendations: [
        "Ustanowić stały kanał wymiany z Morskim Oddziałem SG i VTS – dziś zgłoszenie idzie przez dyżurnego, co kosztuje 6–10 min.",
        "Automatycznie zamawiać zobrazowanie satelitarne przy wykryciu echa bez AIS w strefie detekcji (reguła, nie decyzja operatora).",
        "Dodać czujnik RF/DF na turbinie wschodniej (B-06) – skróci elipsę lokalizacji źródła zakłóceń GNSS o ok. 60 %.",
        "Objąć godziny 00:00–04:00 wzmocnionym dyżurem operatorskim w dni poprzedzające transfery personelu.",
      ],
      cross: "Korelacja ponadobiektowa: profil DS-03 (jednostka bez AIS) odnotowany także w akwenie Baltica 3 w fazie badań geotechnicznych (11.08) – wspólny element: wyłączenie AIS przed wejściem w strefę.",
    },
  };

  /* Karty powiązań pokazywane po kliknięciu „Pokaż powiązania” w zdarzeniu */
  const intelCards = {
    "op-114": {
      title: "Profil operatora OP-114",
      html: `Numer seryjny <span class="b">1581F5BND24C0098</span> (DJI Mavic 3T) wystąpił już <span class="r">trzykrotnie</span>:
<ul class="plain"><li>12.09, 18:42 – wejście od zachodu, krążenie nad rozdzielnią 400 kV, 14 min</li>
<li>26.09, 19:05 – ta sama trasa, krążenie 11 min, operator nieustalony</li>
<li>dziś, 19:18 – trwa</li></ul>
Wspólne cechy: <span class="y">czwartek, zmierzch, zachodnie pobocze drogi dojazdowej, aktywo = rozdzielnia 400 kV</span>.
Ten sam numer seryjny odnotowano raz w <span class="b">Elektrowni Turów</span> (03.09, 18:55) – profil obejmuje dwa obiekty PGE.
Rekomendacja operacyjna: patrol Policji na drodze dojazdowej w czwartek 18:30–19:30 oraz wpis numeru na listę obserwacyjną dla wszystkich obiektów.`,
    },
    "dark-ship": {
      title: "Profil jednostki DS-03 („dark ship”)",
      html: `Echo nawodne o długości ok. 24 m, <span class="r">trzeci raz</span> w akwenie farmy:
<ul class="plain"><li>18.07, 01:12 – pobyt 44 min, start BSP nad OSS</li>
<li>29.08, 02:55 – pobyt 68 min, bez startu BSP, epizod zakłóceń GNSS</li>
<li>dziś, 02:27 – AIS wyłączony 14 min przed startem BSP</li></ul>
Wspólne cechy: <span class="y">wejście od wschodu, wyłączenie AIS przed wejściem w strefę, godziny 00:00–04:00</span>.
Dwa z trzech epizodów poprzedzały planowany transfer personelu na turbiny.
Rekomendacja: zgłoszenie profilu do MOSG jako sprawy ciągłej, automatyczne zobrazowanie satelitarne przy pierwszym echu bez AIS.`,
    },
  };

  /* Środki aktywne – stan zezwoleń (ROE). Demo startuje z blokadą. */
  const roe = {
    locked: [
      { k: "Zgoda na środki aktywne (art. 26a)", v: "BRAK", cls: "no" },
      { k: "Zakłócanie RC / GNSS", v: "ZABLOKOWANE", cls: "no" },
      { k: "Przejęcie protokołu", v: "ZABLOKOWANE", cls: "no" },
      { k: "Dron przechwytujący", v: "GOTOWOŚĆ 20 s", cls: "" },
      { k: "Detekcja i obserwacja", v: "AKTYWNE", cls: "" },
    ],
    armed: [
      { k: "Zgoda na środki aktywne (art. 26a)", v: "UDZIELONA", cls: "armed" },
      { k: "Zakłócanie RC / GNSS", v: "UZBROJONE", cls: "armed" },
      { k: "Przejęcie protokołu", v: "UZBROJONE", cls: "armed" },
      { k: "Dron przechwytujący", v: "UZBROJONY", cls: "armed" },
      { k: "Detekcja i obserwacja", v: "AKTYWNE", cls: "" },
    ],
  };

  return { M, sites, procedures, incidents, intel, intelCards, roe };
})();

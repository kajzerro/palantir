/* ==========================================================================
   SENTINEL-CI · aplikacja demonstracyjna
   Terminal (lewo) · Cyfrowy bliźniak 3D (prawy górny) · Podgląd (prawy dolny)
   Bez kroku budowania, bez zależności.
   ========================================================================== */
(function () {
  "use strict";

  const D = window.MINE_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const pct = (v) => v.toFixed(2).replace(".", ",") + " %";

  /* ------------------------------------------------------------------
     Stan
     ------------------------------------------------------------------ */
  const state = {
    selectedCam: null,
    incidentCursor: 0,
    active: null,
    closed: [],
    auto: false,
    autoTimer: null,
    pendingOptions: null,
    sensors: Object.fromEntries(D.sensors.map((s) => [s.id, s.base])),
    sensorOverride: {},
    audioCtx: null,
    seq: 0,
    focusLevel: "all",
  };

  const els = {
    log: $("#term-log"), quickBar: $("#quick-bar"),
    btnAuto: $("#btn-auto"), btnNext: $("#btn-next"), termMode: $("#term-mode"),
    scene: $("#scene"), svg: $("#mine-svg"), tooltip: $("#twin-tooltip"), twinSide: $("#twin-side"),
    video: $("#feed-video"), noise: $("#feed-noise"), overlay: $("#feed-overlay"),
    feedMain: document.querySelector(".feed-main"), feedStatus: $("#feed-status"),
    feedCamId: $("#feed-cam-id"), osdCam: $("#osd-cam"), osdZone: $("#osd-zone"), osdTime: $("#osd-time"),
    nosigSub: $("#nosig-sub"), detections: $("#feed-detections"), meta: $("#feed-meta"), events: $("#feed-events"),
    kpiCams: $("#kpi-cams"), kpiAlerts: $("#kpi-alerts"), kpiCh4: $("#kpi-ch4"),
    clockDate: $("#clock-date"), clockTime: $("#clock-time"),
  };

  const camById = (id) => D.cameras.find((c) => c.id === id);
  const camIndex = (n) => D.cameras[n - 1];
  const LEVEL_NAMES = ["Powierzchnia", "Poziom −300 m", "Poziom −500 m"];

  /* ==================================================================
     TERMINAL
     ================================================================== */
  const queue = [];
  let draining = false;

  function scrollLog() { els.log.scrollTop = els.log.scrollHeight; }

  function renderMessage({ kind, from, html, options }) {
    const el = document.createElement("div");
    el.className = `msg ${kind}`;
    el.innerHTML = `<div class="hdr"><span class="from">${esc(from)}</span><span class="t">${now()}</span></div><div class="body">${html}</div>`;
    if (options && options.length) {
      const wrap = document.createElement("div");
      wrap.className = "opts";
      options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `opt ${o.cls || ""}`;
        b.innerHTML = `<span class="n">${i + 1}</span>${esc(o.label)}`;
        b.addEventListener("click", () => chooseOption(wrap, i));
        wrap.appendChild(b);
      });
      wrap._options = options;
      el.appendChild(wrap);
      if (state.pendingOptions && state.pendingOptions.el !== wrap) state.pendingOptions.el.classList.add("used");
      state.pendingOptions = { el: wrap, options };
    }
    els.log.appendChild(el);
    scrollLog();
    return el;
  }

  function say(kind, from, html, opts = {}) {
    return new Promise((resolve) => {
      queue.push({ kind, from, html, options: opts.options, delay: opts.delay ?? (kind === "ai" ? 550 : 220), resolve });
      drain();
    });
  }
  const sys = (html, o) => say("sys", "ASYSTENT", html, o);
  const ai = (html, o) => say("ai", "ASYSTENT", html, o);
  const ok = (html, o) => say("ok", "ASYSTENT", html, o);
  const warn = (html, o) => say("warn", "ASYSTENT", html, o);
  function op(text) { renderMessage({ kind: "op", from: "TY", html: esc(text) }); }

  function drain() {
    if (draining) return;
    const item = queue.shift();
    if (!item) return;
    draining = true;
    const typingEl = document.createElement("div");
    typingEl.className = "typing";
    typingEl.textContent = item.from.toLowerCase() + " ";
    els.log.appendChild(typingEl);
    scrollLog();
    setTimeout(() => {
      typingEl.remove();
      const el = renderMessage(item);
      item.resolve(el);
      draining = false;
      drain();
    }, item.delay);
  }

  function chooseOption(wrap, i) {
    if (wrap.classList.contains("used")) return;
    const o = wrap._options[i];
    wrap.classList.add("used");
    wrap.children[i].classList.add("chosen");
    if (state.pendingOptions && state.pendingOptions.el === wrap) state.pendingOptions = null;
    op(o.label);
    o.action && o.action();
  }

  /* ---------- szybkie przyciski (zamiast poleceń) ---------- */
  const QUICK = {
    status: { label: "Co się dzieje?", run: quickStatus },
    cams: { label: "Pokaż kamery", run: quickCams },
    proc: { label: "Co mam teraz robić?", run: quickProc },
    log: { label: "Historia zdarzeń", run: quickLog },
  };
  els.quickBar.addEventListener("click", (e) => {
    const b = e.target.closest(".qbtn"); if (!b) return;
    const q = QUICK[b.dataset.q]; if (!q) return;
    op(q.label); q.run();
  });

  function quickStatus() {
    const online = D.cameras.filter((c) => !c.offline).length;
    const s = currentSensors(), max = Math.max(...Object.values(s));
    const gas = max >= 1.5 ? '<span class="r">za wysoki – trwa procedura</span>' : max >= 1.0 ? '<span class="y">podwyższony, obserwuję</span>' : '<span class="g">w normie</span>';
    const items = [
      `Działa ${online} z ${D.cameras.length} kamer${online < D.cameras.length ? " (KAM-13 jest wyłączona – serwis)" : ""}.`,
      `Metan: ${gas}.`,
      `Pod ziemią jest 312 osób (zmiana B).`,
      `Wentylacja pracuje normalnie.`,
      `Dziś zamknięto ${state.closed.length} ${state.closed.length === 1 ? "zdarzenie" : state.closed.length >= 2 && state.closed.length <= 4 ? "zdarzenia" : "zdarzeń"}.`,
    ];
    ai(`${state.active ? `<span class="r">Trwa zdarzenie ${state.active.inc.id}: ${esc(state.active.inc.title)}.</span>` : `<span class="g">Wszystko w porządku.</span>`}<ul class="plain">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`);
  }

  function quickCams() {
    ai(`Kliknij kamerę, którą chcesz zobaczyć (możesz też klikać punkty na modelu kopalni):`).then((el) => {
      const wrap = document.createElement("div"); wrap.className = "camchips";
      D.cameras.forEach((c) => {
        const b = document.createElement("button"); b.type = "button";
        b.className = `camchip${c.offline ? " off" : ""}`;
        b.textContent = `${c.id.replace("KAM-", "")} · ${c.name}${c.offline ? " (wyłączona)" : ""}`;
        b.addEventListener("click", () => selectCamera(c.id));
        wrap.appendChild(b);
      });
      el.appendChild(wrap); scrollLog();
    });
  }

  function quickProc() {
    if (!state.active) { ai("Teraz nie ma żadnego zdarzenia. Obserwuj podgląd i czekaj – jeśli coś zauważę, od razu Ci powiem."); return; }
    if (state.active.status === "new") { ai(`Mamy nowe zdarzenie na ${state.active.cam.id}. Najpierw zdecyduj, czy to prawdziwe zagrożenie – użyj przycisków powyżej.`); return; }
    sys(procedureHtml(state.active));
    ai(`Jesteś przy kroku ${state.active.step + 1}. Wykonaj go i kliknij „Zrobione”.`);
  }

  function quickLog() {
    if (!state.closed.length && !state.active) { ai("Dziś nie było jeszcze żadnych zdarzeń."); return; }
    const rows = [...state.closed, ...(state.active ? [state.active] : [])].map((r) =>
      `<tr><td>${r.openedAt}</td><td>${severityTag(r.inc.severity)}</td><td>${esc(r.inc.title)}</td><td>${r.inc.cam}</td><td>${r.status === "closed" ? '<span class="g">zakończone</span>' : r.status === "false" ? '<span class="k">fałszywy alarm</span>' : `<span class="y">w toku</span>`}</td></tr>`).join("");
    sys(`<table class="kv log">${rows}</table>`);
  }

  els.btnNext.addEventListener("click", () => fireNextIncident());
  els.btnAuto.addEventListener("click", () => toggleAuto());

  /* ==================================================================
     CYFROWY BLIŹNIAK – ortofotomapa z drona + warstwy wyrobisk (widok GIS)
     ------------------------------------------------------------------
     Współrzędne świata w jednostkach planu (≈ m): obiekt 0..520 × 0..200,
     mapa obejmuje −60..580 × −50..250. Poziomy −300 / −500 są rysowane
     jako podświetlone plany wyrobisk nałożone na zdjęcie.
     ================================================================== */
  const SVGNS = "http://www.w3.org/2000/svg";
  const MAP = { x: -60, y: -50, w: 640, h: 300 };
  const SITE = { x: 0, y: 0, w: 520, h: 200 };
  const PHOTO = "assets/orthophoto.jpg";

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls = "lbl", anchor = "middle") {
    const t = svgEl("text", { x: (+x).toFixed(1), y: (+y).toFixed(1), class: cls, "text-anchor": anchor }, parent);
    t.textContent = str;
    return t;
  }
  const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  function fovPoints(x, y, dirDeg, r = 26, half = 24) {
    const out = [[x, y]];
    for (let a = dirDeg - half; a <= dirDeg + half; a += 6) {
      const rad = a * Math.PI / 180;
      out.push([x + r * Math.cos(rad), y + r * Math.sin(rad)]);
    }
    return out;
  }

  /** Chodnik / przekop: podświetlona linia z poświatą. */
  function gallery(g, x1, y1, x2, y2, w = 5, cls = "") {
    svgEl("line", { class: `gal-glow ${cls}`, x1, y1, x2, y2, "stroke-width": w + 5 }, g);
    svgEl("line", { class: `gal ${cls}`, x1, y1, x2, y2, "stroke-width": w }, g);
  }
  /** Komora / obiekt na poziomie. */
  function room(g, x, y, w, h, cls = "", label, pos = "below") {
    svgEl("rect", { class: `room ${cls}`, x, y, width: w, height: h, rx: 1 }, g);
    if (label) {
      if (pos === "below") text(g, x + w / 2, y + h + 5.5, label, "lbl u");
      else if (pos === "above") text(g, x + w / 2, y - 2, label, "lbl u");
      else if (pos === "right") text(g, x + w + 2, y + h / 2 + 2, label, "lbl u", "start");
      else if (pos === "left") text(g, x - 2, y + h / 2 + 2, label, "lbl u", "end");
      else text(g, x + w / 2, y + h / 2 + 2, label, "lbl u");
    }
  }
  /** Ściana wydobywcza: pole z kreskowaniem zrobów, front, sekcje. */
  function longwall(g, x, y, w, h, faceX, label) {
    svgEl("rect", { class: "lw-goaf", x, y, width: w, height: h }, g);
    svgEl("rect", { class: "lw", x, y, width: w, height: h }, g);
    svgEl("line", { class: "lw-face", x1: faceX, y1: y, x2: faceX, y2: y + h }, g);
    for (let yy = y + 2; yy < y + h; yy += 4) svgEl("rect", { class: "lw-sup", x: faceX - 1.5, y: yy, width: 3, height: 2.6 }, g);
    text(g, x + w / 2, y + h / 2 + 2.5, label, "lbl u big");
  }
  function ventDoor(g, x, y) { svgEl("line", { class: "vdoor", x1: x, y1: y - 5, x2: x, y2: y + 5 }, g); }
  function mover(parent, cls, path, dur, draw, begin = "0s") {
    const g = svgEl("g", { class: `mover ${cls}` }, parent);
    draw(g);
    svgEl("animateMotion", { dur, repeatCount: "indefinite", path, begin }, g);
    return g;
  }
  const people = (parent, x1, x2, y, n, dur) => {
    for (let i = 0; i < n; i++) mover(parent, "person", `M ${x1} ${y} L ${x2} ${y} L ${x1} ${y}`, dur, (g) => svgEl("circle", { r: 1.3 }, g), `-${(parseFloat(dur) * i / n).toFixed(1)}s`);
  };

  function renderScene() {
    els.scene.innerHTML = "";
    const S = els.scene;
    const camGroups = {};

    // ortofotomapa
    svgEl("image", { href: PHOTO, x: MAP.x, y: MAP.y, width: MAP.w, height: MAP.h, preserveAspectRatio: "none" }, S);
    svgEl("rect", { class: "dim", x: MAP.x, y: MAP.y, width: MAP.w, height: MAP.h }, S);

    /* ---------------- POWIERZCHNIA: etykiety obiektów ---------------- */
    {
      const g = svgEl("g", { class: "lvl-group lvl-0" }, S);
      const surf = svgEl("g", { class: "surf" }, g);
      svgEl("rect", { class: "site", x: SITE.x, y: SITE.y, width: SITE.w, height: SITE.h }, surf);
      [
        [65, 30, "ADMINISTRACJA"], [145, 30, "WARSZTAT"], [204, 27, "KOTŁOWNIA"], [180, 72, "ROZDZIELNIA 110/6 kV"],
        [385, 60, "ZAKŁAD PRZERÓBCZY"], [262, 77, "SZYB I „PIAST”"], [302, 34, "MASZYNA WYCIĄGOWA"], [487, 80, "SZYB II"],
        [367, 132, "OSADNIKI"], [214, 108, "ZBIORNIKI WODY"], [445, 130, "STACJA TRAFO"], [125, 130, "LAMPOWNIA · ŁAŹNIA · CECHOWNIA"],
        [465, 186, "STACJA WENTYLATORÓW"], [410, 200, "SKŁADOWISKO · ZAŁADUNEK KOLEJOWY"], [23, 194, "BRAMA GŁÓWNA"], [90, 196, "PARKING"],
      ].forEach(([x, y, t]) => text(surf, x, y, t, "lbl s"));
      text(surf, SITE.x, SITE.y - 8, "POWIERZCHNIA · +262 m n.p.m.", "lbl lvl l0", "start");
      camGroups[0] = svgEl("g", { class: "cam-layer surf" }, g);
    }

    /* ---------------- POZIOM −300 ---------------- */
    {
      const g = svgEl("g", { class: "lvl-group lvl-1" }, S);
      text(g, SITE.x, SITE.y - 8, "POZIOM −300 m · POKŁAD 405/1 · WYROBISKA", "lbl lvl l1", "start");
      gallery(g, 60, 92, 480, 92, 6);                       // przekop główny G-3
      gallery(g, 268, 53, 268, 92, 4);                      // podszybie → przekop
      gallery(g, 60, 26, 181, 26, 4);                       // chodnik nadścianowy
      gallery(g, 181, 26, 181, 92, 4);                      // przecinka
      gallery(g, 367, 74, 367, 92, 3); gallery(g, 488, 67, 488, 92, 4);
      longwall(g, 60, 30, 100, 56, 160, "ŚCIANA L-12 · 180 m");
      room(g, 350, 58, 34, 16, "", "ROZDZIELNIA 6 kV", "above");
      room(g, 300, 98, 40, 14, "", "STACJA ZAŁADOWCZA");
      room(g, 424, 98, 36, 14, "", "ŁADOWNIA AKUMULATORÓW");
      room(g, 238, 100, 20, 12, "", "POMPOWNIA");
      svgEl("circle", { class: "shaft", cx: 268, cy: 53, r: 13 }, g); text(g, 268, 55.5, "SZYB I", "lbl u");
      svgEl("circle", { class: "shaft", cx: 487, cy: 67, r: 7 }, g); text(g, 487, 60, "SZYB II", "lbl u");
      svgEl("line", { class: "belt", x1: 183, y1: 92, x2: 300, y2: 92 }, g);
      svgEl("line", { class: "incline", x1: 330, y1: 92, x2: 292, y2: 92 }, g); text(g, 311, 101, "POCHYLNIA P-2 ↓ −500", "lbl u");
      text(g, 200, 88, "PRZEKOP GŁÓWNY G-3", "lbl u", "start");
      ventDoor(g, 120, 92); ventDoor(g, 470, 92);
      people(g, 70, 470, 92, 3, "40s");
      D.sensors.filter((s) => s.level === 1).forEach((s) => { text(g, s.x, s.y, "CH₄ —", "sensor", "start").dataset.sensor = s.id; });
      camGroups[1] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* ---------------- POZIOM −500 ---------------- */
    {
      const g = svgEl("g", { class: "lvl-group lvl-2" }, S);
      text(g, SITE.x, SITE.y - 8, "POZIOM −500 m · POKŁAD 510 · WYROBISKA", "lbl lvl l2", "start");
      gallery(g, 90, 92, 520, 92, 6);                       // przekop główny G-7
      gallery(g, 268, 53, 268, 92, 4);
      gallery(g, 146, 92, 146, 128, 3); gallery(g, 256, 92, 256, 128, 3); gallery(g, 414, 92, 414, 128, 3);
      gallery(g, 346, 40, 346, 92, 4);                      // przodek B-3
      gallery(g, 395, 26, 505, 26, 4); gallery(g, 388, 26, 388, 92, 4);
      longwall(g, 405, 30, 100, 56, 405, "ŚCIANA W-7 · 210 m");
      room(g, 118, 128, 56, 22, "mag", "KOMORA MW"); room(g, 174, 130, 14, 14, "mag");
      room(g, 236, 128, 60, 22, "", "STACJA ODMETANOWANIA");
      room(g, 396, 128, 44, 22, "ref", "KOMORA RATUNKOWA KR-2");
      room(g, 214, 100, 20, 12, "water", "RZĄPIE", "left"); room(g, 238, 100, 20, 12, "", "POMPOWNIA GŁ.");
      room(g, 300, 100, 28, 14, "", "LOKOMOTYWOWNIA", "right");
      svgEl("rect", { class: "machine", x: 342, y: 40, width: 8, height: 10 }, g); text(g, 340, 45, "PRZODEK B-3", "lbl u", "end");
      svgEl("circle", { class: "shaft", cx: 268, cy: 53, r: 13 }, g); text(g, 268, 55.5, "SZYB I", "lbl u");
      svgEl("polyline", { class: "pipe", points: "296,139 316,139 316,96 516,96" }, g); text(g, 470, 104, "RUROCIĄG CH₄", "lbl u", "start");
      svgEl("line", { class: "belt", x1: 388, y1: 92, x2: 330, y2: 92 }, g);
      svgEl("line", { class: "incline", x1: 292, y1: 92, x2: 330, y2: 92 }, g); text(g, 311, 84, "POCHYLNIA P-2 ↑ −300", "lbl u");
      text(g, 100, 88, "PRZEKOP GŁÓWNY G-7", "lbl u", "start");
      ventDoor(g, 200, 92); ventDoor(g, 470, 92);
      people(g, 100, 500, 92, 3, "44s");
      D.sensors.filter((s) => s.level === 2).forEach((s) => { text(g, s.x, s.y, "CH₄ —", "sensor", "start").dataset.sensor = s.id; });
      camGroups[2] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* ---------------- róża wiatrów, skala, stopka ---------------- */
    {
      const g = svgEl("g", { class: "mapdeco" }, S);
      const nx = MAP.x + MAP.w - 22, ny = MAP.y + 22;
      svgEl("circle", { class: "rose", cx: nx, cy: ny, r: 9 }, g);
      svgEl("polygon", { class: "rose-n", points: `${nx - 3},${ny + 2} ${nx},${ny - 8} ${nx + 3},${ny + 2}` }, g);
      text(g, nx, ny + 7.5, "N", "lbl s");
      const sx = MAP.x + 12, sy = MAP.y + MAP.h - 12;
      svgEl("rect", { class: "scale", x: sx, y: sy, width: 50, height: 1.6 }, g);
      svgEl("rect", { class: "scale alt", x: sx, y: sy, width: 25, height: 1.6 }, g);
      text(g, sx + 25, sy - 2.5, "50 m", "lbl s");
      text(g, MAP.x + MAP.w - 6, MAP.y + MAP.h - 6, "ORTOFOTOMAPA Z DRONA · 10 cm/px · nalot 2026-09-12", "lbl s", "end");
    }

    /* ---------------- kamery ---------------- */
    D.cameras.forEach((c) => {
      const layer = camGroups[Math.floor(c.level)] || camGroups[1];
      const g = svgEl("g", { class: `cam${c.offline ? " off" : ""}`, "data-id": c.id, tabindex: 0, role: "button" }, layer);
      svgEl("polygon", { class: "fov", points: pts(fovPoints(c.x, c.y, c.dir)) }, g);
      svgEl("circle", { class: "hit", cx: c.x, cy: c.y, r: 8 }, g);
      svgEl("circle", { class: "pulse", cx: c.x, cy: c.y, r: 4 }, g);
      svgEl("circle", { class: "ring", cx: c.x, cy: c.y, r: 4.2 }, g);
      svgEl("circle", { class: "core", cx: c.x, cy: c.y, r: 2.3 }, g);
      text(g, c.x + 6, c.y + 2.2, c.id.replace("KAM-", "K"), "id", "start");
      g.addEventListener("click", () => selectCamera(c.id));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCamera(c.id); } });
      g.addEventListener("mouseenter", (e) => showTooltip(c, e));
      g.addEventListener("mousemove", (e) => moveTooltip(e));
      g.addEventListener("mouseleave", hideTooltip);
    });

    [0, 1, 2].forEach((l) => {
      const cams = D.cameras.filter((c) => Math.floor(c.level) === l);
      const off = cams.filter((c) => c.offline).length;
      const el = $(`#lvl-sub-${l}`);
      if (el) el.textContent = `${cams.length} kamer${off ? ` · ${off} offline` : ""}`;
    });
    setView(state.focusLevel);
  }

  /** Widok: "all" | "0" | "1" | "2" – które warstwy są widoczne. */
  function setView(key) {
    state.focusLevel = key;
    els.svg.classList.remove("view-all", "view-0", "view-1", "view-2");
    els.svg.classList.add(`view-${key}`);
    els.twinSide.querySelectorAll(".lvl-btn").forEach((x) => x.classList.toggle("active", x.dataset.level === key));
  }

  const camNode = (id) => els.svg.querySelector(`.cam[data-id="${id}"]`);
  function setCamState(id, cls) {
    const n = camNode(id); if (!n) return;
    n.classList.remove("alert", "attn");
    if (cls) n.classList.add(cls);
    refreshLevelButtons();
  }
  function refreshLevelButtons() {
    els.twinSide.querySelectorAll(".lvl-btn[data-level]").forEach((b) => {
      const l = b.dataset.level;
      if (l === "all") return;
      const hot = state.active && state.active.status !== "closed" && Math.floor(state.active.cam.level) === Number(l);
      b.classList.toggle("hot", !!hot);
    });
  }
  /* ---------- zoom / pan ---------- */
  const SCENE = { ...MAP };
  const VIEW0 = { ...SCENE };
  const view = { ...VIEW0 };
  /** Dopasuj proporcje widoku do rzeczywistych proporcji panelu (bez pasów po bokach). */
  function syncAspect() {
    const r = els.svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aspect = r.width / r.height;
    const wasDefault = Math.abs(view.w - VIEW0.w) < 0.5 && Math.abs(view.x - VIEW0.x) < 0.5;
    if (SCENE.w / SCENE.h < aspect) { VIEW0.h = SCENE.h; VIEW0.w = SCENE.h * aspect; VIEW0.x = SCENE.x - (VIEW0.w - SCENE.w) / 2; VIEW0.y = SCENE.y; }
    else { VIEW0.w = SCENE.w; VIEW0.h = SCENE.w / aspect; VIEW0.x = SCENE.x; VIEW0.y = SCENE.y - (VIEW0.h - SCENE.h) / 2; }
    if (wasDefault || state.focusLevel === "all") Object.assign(view, VIEW0);
    else view.h = view.w / aspect;
    applyView();
  }
  window.addEventListener("resize", syncAspect);
  function applyView() { els.svg.setAttribute("viewBox", `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`); }
  function svgPoint(e) { const pt = els.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(els.svg.getScreenCTM().inverse()); }
  function zoomAt(px, py, f) {
    const w = Math.max(80, Math.min(VIEW0.w * 1.3, view.w * f)), h = w * VIEW0.h / VIEW0.w;
    view.x = px - (px - view.x) * (w / view.w); view.y = py - (py - view.y) * (h / view.h);
    view.w = w; view.h = h; applyView();
  }
  function fitBox(bb, pad = 14) {
    const w = bb.width + pad * 2, h = bb.height + pad * 2;
    const ratio = VIEW0.w / VIEW0.h;
    if (w / h > ratio) { view.w = w; view.h = w / ratio; } else { view.h = h; view.w = h * ratio; }
    view.x = bb.x + bb.width / 2 - view.w / 2; view.y = bb.y + bb.height / 2 - view.h / 2; applyView();
  }
  els.svg.addEventListener("wheel", (e) => { e.preventDefault(); const p = svgPoint(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 0.85 : 1 / 0.85); }, { passive: false });
  let drag = null;
  els.svg.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target.closest(".cam")) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; els.svg.setPointerCapture(e.pointerId); els.svg.classList.add("dragging"); });
  els.svg.addEventListener("pointermove", (e) => { if (!drag) return; const k = els.svg.getScreenCTM().a; view.x = drag.vx - (e.clientX - drag.x) / k; view.y = drag.vy - (e.clientY - drag.y) / k; applyView(); });
  ["pointerup", "pointercancel"].forEach((ev) => els.svg.addEventListener(ev, () => { drag = null; els.svg.classList.remove("dragging"); }));
  $("#btn-zin").addEventListener("click", () => zoomAt(view.x + view.w / 2, view.y + view.h / 2, 0.8));
  $("#btn-zout").addEventListener("click", () => zoomAt(view.x + view.w / 2, view.y + view.h / 2, 1.25));
  $("#btn-zreset").addEventListener("click", () => { Object.assign(view, VIEW0); applyView(); });

  els.twinSide.addEventListener("click", (e) => {
    const b = e.target.closest(".lvl-btn"); if (!b) return;
    focusLevel(b.dataset.level);
  });
  function focusLevel(key) {
    setView(key);
    if (key === "all") { Object.assign(view, VIEW0); applyView(); return; }
    if (key === "0") { fitBox({ x: SITE.x, y: SITE.y - 14, width: SITE.w, height: SITE.h + 20 }, 6); return; }
    const grp = els.svg.querySelector(`.lvl-group.lvl-${key}`);
    if (grp) fitBox(grp.getBBox(), 8);
  }

  function camStatusText(c) {
    if (c.offline) return '<span style="color:#7f93a4">OFFLINE</span>';
    if (state.active && state.active.inc.cam === c.id) return state.active.status === "new" ? '<span style="color:#ff4d5e">⚠ ANOMALIA</span>' : '<span style="color:#ffb347">● W PROCEDURZE</span>';
    return '<span style="color:#43d9a0">● NOMINALNA</span>';
  }
  function showTooltip(c, e) {
    els.tooltip.innerHTML = `<div class="t">${c.id} · ${esc(c.name)}</div><div class="s">${esc(c.zone)} · ${esc(c.type)}</div><div class="st">${camStatusText(c)}</div>`;
    els.tooltip.hidden = false; moveTooltip(e);
  }
  function moveTooltip(e) {
    const r = els.svg.parentElement.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    if (x + 200 > r.width) x = e.clientX - r.left - 210;
    if (y + 70 > r.height) y = e.clientY - r.top - 76;
    els.tooltip.style.left = x + "px"; els.tooltip.style.top = y + "px";
  }
  function hideTooltip() { els.tooltip.hidden = true; }

  /* ---------- czujniki ---------- */
  function currentSensors() {
    const out = {};
    for (const k in state.sensors) out[k] = state.sensorOverride[k] ?? state.sensors[k];
    return out;
  }
  function tickSensors() {
    for (const k in state.sensors) {
      state.sensors[k] = Math.max(0.1, Math.min(0.6, state.sensors[k] + (Math.random() - 0.5) * 0.03));
      if (state.sensorOverride[k] != null && state.sensorOverride[k] < 1.6 && state.sensorOverride._rising) state.sensorOverride[k] += 0.02;
      if (state.sensorOverride[k] != null && state.sensorOverride._falling) { state.sensorOverride[k] -= 0.04; if (state.sensorOverride[k] <= state.sensors[k]) delete state.sensorOverride[k]; }
    }
    const s = currentSensors();
    const cls = (v) => (v >= 1.5 ? "alert" : v >= 1.0 ? "warn" : "");
    els.svg.querySelectorAll("#ch4-sensors .sensor").forEach((t) => {
      const v = s[t.dataset.sensor];
      t.textContent = `CH₄ ${pct(v)}`;
      t.setAttribute("class", `sensor ${cls(v)}`);
    });
    document.querySelectorAll("#twin-ch4 dd[data-sensor]").forEach((d) => { const v = s[d.dataset.sensor]; d.textContent = pct(v); d.className = cls(v); });
    const max = Math.max(...Object.values(s));
    els.kpiCh4.textContent = pct(max);
    els.kpiCh4.style.color = max >= 1.5 ? "var(--alert)" : max >= 1.0 ? "var(--attn)" : "";
  }

  /* ==================================================================
     PODGLĄD NA ŻYWO
     ================================================================== */
  let noiseRAF = null;
  function drawNoise() {
    const c = els.noise, ctx = c.getContext("2d");
    const w = 160, h = 90;
    if (c.width !== w) { c.width = w; c.height = h; }
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    noiseRAF = setTimeout(() => requestAnimationFrame(drawNoise), 70);
  }
  function setNoSignal(on, hint) {
    els.feedMain.classList.toggle("nosignal", on);
    if (on) { els.nosigSub.innerHTML = hint || ""; if (!noiseRAF) drawNoise(); }
    else if (noiseRAF) { clearTimeout(noiseRAF); noiseRAF = null; }
  }

  /** Ładuje wideo: najpierw podana ścieżka (np. .mp4), potem ten sam plik jako .webm. */
  function loadVideo(src) {
    const v = els.video;
    v.onerror = null; v.onloadeddata = null;
    v.pause(); v.removeAttribute("src"); v.innerHTML = "";
    if (!src) { v.load(); setNoSignal(true, "brak skonfigurowanego wideo dla tej kamery"); return; }
    const base = src.replace(/\.(mp4|webm|mov|m4v|ogv)$/i, "");
    const candidates = [src]; if (!/\.webm$/i.test(src)) candidates.push(base + ".webm");
    setNoSignal(true, `oczekiwanie na strumień… <code>${esc(src)}</code>`);
    v.onloadeddata = () => { setNoSignal(false); v.play().catch(() => {}); };
    candidates.forEach((c, i) => {
      const s = document.createElement("source"); s.src = c;
      if (i === candidates.length - 1) s.addEventListener("error", () => setNoSignal(true, `strumień niedostępny — umieść swój klip w <code>${esc(src)}</code> i odśwież stronę`));
      v.appendChild(s);
    });
    v.load();
  }

  function renderBoxes(boxes) {
    els.overlay.innerHTML = "";
    if (!boxes || !boxes.length) return;
    boxes.forEach((b) => {
      const d = document.createElement("div");
      d.className = `bbox ${b.cls || ""}`;
      d.dataset.label = b.label;
      d.style.cssText = `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;
      d.innerHTML = '<i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>';
      els.overlay.appendChild(d);
    });
    const s = document.createElement("div"); s.className = "scanline"; els.overlay.appendChild(s);
  }

  function renderDetections(list, hot) {
    if (!list || !list.length) { els.detections.innerHTML = '<li class="muted">brak detekcji · scena nominalna</li>'; return; }
    els.detections.innerHTML = list.map(([l, c]) => `<li class="${hot ? (c >= 0.95 ? "hot" : "warn") : ""}"><span>${esc(l)}</span><span class="c">${(c * 100).toFixed(0)} %</span></li>`).join("");
  }

  function renderMeta(c) {
    els.meta.innerHTML = `<dt>strefa</dt><dd>${esc(c.zone)}</dd><dt>typ</dt><dd>${esc(c.type)}</dd><dt>model AI</dt><dd>sentinel-vision v4.2</dd><dt>czas pracy</dt><dd>${c.offline ? "—" : (140 + (parseInt(c.id.slice(4), 10) * 37) % 200) + " dni"}</dd><dt>strumień</dt><dd>${esc(c.video || "—")}</dd>`;
  }

  function setFeedStatus(text, cls) { els.feedStatus.textContent = text; els.feedStatus.className = `pill ${cls || ""}`; }

  function selectCamera(id) {
    const c = camById(id); if (!c) return;
    state.selectedCam = id;
    els.svg.querySelectorAll(".cam.selected").forEach((n) => n.classList.remove("selected"));
    camNode(id)?.classList.add("selected");
    els.feedCamId.textContent = `${c.id} · ${c.name.toUpperCase()}`;
    els.osdCam.textContent = `${c.id} ${c.name}`;
    els.osdZone.textContent = c.zone;
    renderMeta(c);

    const inc = state.active && state.active.inc.cam === id && state.active.status !== "closed" ? state.active : null;
    if (c.offline) {
      loadVideo(null); setNoSignal(true, "kamera offline · zgłoszenie serwisowe MT-4471"); renderBoxes([]); renderDetections([]); setFeedStatus("OFFLINE", "");
      els.feedMain.classList.remove("alert");
    } else if (inc) {
      loadVideo(inc.inc.video || c.video);
      renderBoxes(inc.inc.boxes); renderDetections(inc.inc.detections, true);
      setFeedStatus(inc.status === "new" ? "ANOMALIA" : "W PROCEDURZE", inc.status === "new" ? "alert" : "attn");
      els.feedMain.classList.toggle("alert", inc.status === "new");
    } else {
      loadVideo(c.video); renderBoxes([]); renderDetections([]); setFeedStatus("NA ŻYWO", "live");
      els.feedMain.classList.remove("alert");
    }
  }

  function pushEvent(text, cls, camId) {
    const li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = `<span class="t">${now()}</span><span class="s">${text}</span>`;
    if (camId) li.addEventListener("click", () => selectCamera(camId));
    els.events.prepend(li);
    while (els.events.children.length > 14) els.events.lastChild.remove();
  }

  $("#btn-fullscreen").addEventListener("click", () => { (els.feedMain.requestFullscreen || (() => {})).call(els.feedMain); });

  /* ==================================================================
     SILNIK ZDARZEŃ
     ================================================================== */
  function beep(kind) {
    try {
      if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = state.audioCtx, t = ctx.currentTime;
      const tones = kind === "KRYTYCZNY" ? [[880, 0], [660, 0.18], [880, 0.36], [660, 0.54]] : kind === "ok" ? [[520, 0], [780, 0.12]] : [[740, 0], [740, 0.22]];
      tones.forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = f; g.gain.value = 0.03;
        o.connect(g).connect(ctx.destination); o.start(t + dt); o.stop(t + dt + 0.12);
      });
    } catch (_) { /* dźwięk jeszcze niedozwolony */ }
  }

  function updateKpis() {
    els.kpiCams.textContent = `${D.cameras.filter((c) => !c.offline).length}/${D.cameras.length}`;
    const n = state.active && state.active.status !== "closed" ? 1 : 0;
    els.kpiAlerts.textContent = n;
    els.kpiAlerts.parentElement.classList.toggle("hot", n > 0);
    els.termMode.textContent = state.auto ? "AUTO" : "RĘCZNIE";
    els.termMode.className = `pill ${state.auto ? "ok" : ""}`;
    els.btnAuto.classList.toggle("active", state.auto);
    refreshLevelButtons();
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateKpis();
    if (state.auto) { sys(`Tryb demo: zdarzenia będą pojawiać się <span class="g">automatycznie</span>.`); scheduleAuto(8000); }
    else { sys(`Tryb demo: zdarzenia wywołujesz <span class="y">ręcznie</span> przyciskiem NASTĘPNE ZDARZENIE.`); clearTimeout(state.autoTimer); }
  }
  function scheduleAuto(ms) {
    clearTimeout(state.autoTimer);
    if (!state.auto) return;
    state.autoTimer = setTimeout(() => { if (state.auto && !state.active) fireNextIncident(); else if (state.auto) scheduleAuto(5000); }, ms);
  }

  const SEV_CLS = { NISKI: "LOW", ŚREDNI: "MEDIUM", WYSOKI: "HIGH", KRYTYCZNY: "CRITICAL" };
  const SEV_TXT = { NISKI: "MAŁE ZAGROŻENIE", ŚREDNI: "ŚREDNIE ZAGROŻENIE", WYSOKI: "DUŻE ZAGROŻENIE", KRYTYCZNY: "KRYTYCZNE ZAGROŻENIE" };
  function severityTag(s) { return `<span class="tag ${SEV_CLS[s] || ""}">${SEV_TXT[s] || s}</span>`; }

  function fireNextIncident() {
    if (state.active && state.active.status !== "closed") {
      warn(`Najpierw zakończ obecne zdarzenie – dokończ kroki albo oznacz je jako fałszywy alarm.`);
      return;
    }
    if (state.incidentCursor >= D.incidents.length) {
      ok(`To były wszystkie zaplanowane zdarzenia w tym demo. Odśwież stronę, aby zacząć od nowa, albo kliknij „Historia zdarzeń”.`);
      state.auto = false; updateKpis();
      return;
    }
    const inc = D.incidents[state.incidentCursor++];
    const cam = camById(inc.cam);
    const rec = { inc, cam, status: "new", step: 0, steps: [], openedAt: now(), n: ++state.seq };
    state.active = rec;
    if (inc.sensors) { Object.assign(state.sensorOverride, inc.sensors); state.sensorOverride._rising = true; state.sensorOverride._falling = false; }

    setCamState(inc.cam, "alert");
    focusLevel(String(Math.floor(cam.level)));
    document.body.classList.remove("flash"); void document.body.offsetWidth; document.body.classList.add("flash");
    beep(inc.severity);
    selectCamera(inc.cam);
    pushEvent(`${inc.id} ${esc(inc.title)}`, "alert", inc.cam);
    updateKpis();

    const kind = inc.severity === "KRYTYCZNY" ? "alert crit" : "alert";
    say(kind, `⚠ UWAGA · ${inc.id}`, `${severityTag(inc.severity)}
<span class="b">${esc(inc.title)}</span>
<table class="kv">
<tr><td>gdzie</td><td>${esc(cam.name)} <span class="k">(${esc(cam.zone)})</span></td></tr>
<tr><td>kamera</td><td>${cam.id}</td></tr>
<tr><td>kiedy</td><td>${rec.openedAt}</td></tr>
</table>${esc(inc.summary)}`, { delay: 120 });

    ai(`Przełączyłem podgląd na kamerę ${cam.id} – zobacz obraz po prawej. Ta kamera miga też na czerwono na modelu kopalni. <span class="b">Co robimy?</span>`, {
      options: assessmentOptions(rec, true),
    });
  }

  function assessmentOptions(rec, withAnalysis) {
    const o = [
      { label: "Tak, to prawdziwe zagrożenie – pokaż, co robić", cls: "danger", action: confirmIncident },
    ];
    if (withAnalysis) o.push({ label: "Powiedz mi więcej", action: () => analysis(rec) });
    o.push({ label: "Poczekaj chwilę i sprawdź jeszcze raz", action: () => holdIncident(rec) });
    o.push({ label: "To fałszywy alarm", cls: "good", action: () => falseAlarm(rec) });
    return o;
  }

  function analysis(rec) {
    const inc = rec.inc, proc = D.procedures[inc.procedure];
    const seen = inc.detections.map((d) => `<li>${esc(d[0])}</li>`).join("");
    ai(`<span class="b">Co widzę na kamerze:</span><ul class="plain">${seen}</ul>${esc(inc.aiNotes)}

Jeśli to potwierdzisz, poprowadzę Cię przez procedurę <span class="b">„${esc(proc.title)}”</span> <span class="k">(${esc(proc.ref)})</span>.
<span class="b">Co robimy?</span>`, { options: assessmentOptions(rec, false) });
  }

  function holdIncident(rec) {
    ai(`Dobrze, obserwuję dalej. Jeśli za 20 sekund nadal będzie to widoczne, odezwę się ponownie.`);
    setTimeout(() => {
      if (state.active !== rec || rec.status !== "new") return;
      beep(rec.inc.severity);
      say("alert", `⚠ NADAL WIDOCZNE · ${rec.inc.id}`, `${severityTag(rec.inc.severity)} Minęło 20 sekund i na kamerze ${rec.inc.cam} nadal widzę: <span class="b">${esc(rec.inc.detections[0][0])}</span>. Musisz teraz zdecydować.`, { options: assessmentOptions(rec, false), delay: 100 });
    }, 20000);
  }

  function falseAlarm(rec) {
    rec.status = "false"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    ok(`W porządku, zapisałem to jako <span class="b">fałszywy alarm</span> (${rec.closedAt}). Kamera ${rec.inc.cam} wraca do normalnej pracy. Dziękuję!`);
    pushEvent(`${rec.inc.id} fałszywy alarm`, "ok", rec.inc.cam);
    scheduleAuto(10000);
  }

  function confirmIncident() {
    const rec = state.active; if (!rec || rec.status !== "new") return;
    rec.status = "confirmed";
    const inc = rec.inc, proc = D.procedures[inc.procedure];
    rec.steps = proc.steps.map(() => "todo");
    setCamState(inc.cam, "attn");
    if (state.selectedCam === inc.cam) { setFeedStatus("W PROCEDURZE", "attn"); els.feedMain.classList.remove("alert"); }
    updateKpis();
    pushEvent(`${inc.id} potwierdzone → ${inc.procedure}`, "attn", inc.cam);

    ai(`Dobrze. <span class="b">Powiadomiłem dyspozytora.</span> Teraz wykonaj po kolei ${proc.steps.length} kroków procedury <span class="b">„${esc(proc.title)}”</span>. Po każdym kliknij „Zrobione”. Wszystko zapisuję automatycznie.`);
    rec.checklistEl = null;
    sys(procedureHtml(rec)).then((el) => { rec.checklistEl = el; });
    askStep(rec);
  }

  function procedureHtml(rec) {
    const proc = D.procedures[rec.inc.procedure];
    const items = proc.steps.map((s, i) => {
      const st = rec.steps[i] === "done" ? "done" : rec.steps[i] === "skip" ? "skip" : i === rec.step && rec.status === "confirmed" ? "cur" : "";
      return `<li class="${st}">${i + 1}. ${esc(s)}</li>`;
    }).join("");
    return `<span class="b">${esc(proc.title)}</span> <span class="k">(${esc(proc.ref)})</span><ul class="steps">${items}</ul>`;
  }
  function refreshChecklist(rec) {
    if (rec.checklistEl) rec.checklistEl.querySelector(".body").innerHTML = procedureHtml(rec);
  }

  function askStep(rec) {
    const proc = D.procedures[rec.inc.procedure];
    const i = rec.step;
    if (i >= proc.steps.length) { completeIncident(rec); return; }
    refreshChecklist(rec);
    ai(`<span class="y">Krok ${i + 1} z ${proc.steps.length}:</span> ${esc(proc.steps[i])}`, {
      options: [
        { label: "Zrobione ✓", cls: "good", action: () => stepDone(rec) },
        { label: "Nie mogę tego zrobić", cls: "danger", action: () => stepSkip(rec) },
        { label: "Pokaż wszystkie kroki", action: () => { sys(procedureHtml(rec)); askStep(rec); } },
      ],
    });
  }
  function stepDone(rec) {
    rec.steps[rec.step] = "done"; rec.step++;
    if (rec.inc.id === "ZD-04" && rec.step === 3) { state.sensorOverride._rising = false; state.sensorOverride._falling = true; }
    interjection(rec);
    askStep(rec);
  }
  function stepSkip(rec) {
    rec.steps[rec.step] = "skip"; rec.step++;
    warn(`Rozumiem. Zapisałem, że krok ${rec.step} nie został wykonany, i powiadomiłem sztygara zmianowego. Przejdźmy dalej.`);
    askStep(rec);
  }

  /** Zaplanowane aktualizacje „na żywo” w trakcie procedur, wg zdarzenia i liczby wykonanych kroków. */
  const interjections = {
    "ZD-03": { 1: `<span class="g">Przenośnik P-2 zatrzymany</span> – potwierdzono na kamerze (prędkość 0,0 m/s).`, 2: `Aktualizacja: CO na czujniku P2-3 wynosi teraz <span class="r">84 ppm ↑</span>, P2-4 <span class="y">41 ppm</span>. Dym przemieszcza się w stronę chodnika G-7 z prędkością 1,1 m/s.`, 4: `Załoga ściany W-7 (14 osób) potwierdza wycofanie w stronę podszybia −500. KAM-12 pokazuje pusty front ściany.`, 5: `Zastęp ratowniczy ZR-1 przy zestawie krążników B-14. Gaszenie w toku – temperatura punktu gorącego spada (214 → 96 °C).` },
    "ZD-04": { 1: `<span class="g">Kombajn i przenośnik ścianowy zatrzymane.</span> Blokada SC-W7 załączona.`, 2: `Kolega z sekcji 44 dotarł do pracownika – jest <span class="y">nieprzytomny, ale oddycha</span>.`, 3: `CH₄ na W7 stabilizuje się i spada. Zasilanie w rejonie pozostaje włączone dla oświetlenia; nadzór metanometryczny trwa.`, 4: `Zespół medyczny w drodze z punktu medycznego −500, dojazd 7 min. Stacja Ratownictwa potwierdziła przyjęcie zgłoszenia.` },
    "ZD-02": { 1: `<span class="g">KMW-D1 zablokowane.</span> Czujnik drzwi zgłasza ZAMKNIĘTE. Osoba pozostaje odcięta w przedsionku.`, 2: `Wydawca komory: <span class="r">brak uprawnionego wejścia</span> zaplanowanego do 10:00.`, 3: `Patrol P-2 potwierdza wyjście z podszybia −500. Dojście 5 min.` },
    "ZD-05": { 1: `Syrena i oświetlenie aktywne. Obie osoby zatrzymały się i patrzą w stronę bramy.`, 2: `Auto-śledzenie PTZ zablokowane na obu celach. Patrol powierzchni wyrusza z budynku administracji.`, 3: `Policja potwierdziła – radiowóz dojedzie za 9 min. Intruzi wycofują się w stronę ogrodzenia.` },
    "ZD-06": { 2: `Inżynier wentylacji: utrzymać pracę wentylatora; czerpnia nie jest zasłonięta.`, 3: `Pirotechnicy wysłani, dojazd 25 min. KRZG poinformowany.` },
    "ZD-01": { 2: `Wydawca lampowni potwierdza: znaczkowi 2231 nie wydano dziś aparatu ucieczkowego.` },
    "ZD-07": { 1: `Maszyna wyciągowa wstrzymana – sygnalista potwierdza.`, 2: `Pracownik opuścił strefę. Strefa pusta na KAM-06.` },
  };
  function interjection(rec) {
    const t = interjections[rec.inc.id]?.[rec.step];
    if (t) sys(t);
  }

  function completeIncident(rec) {
    rec.status = "closed"; rec.closedAt = now();
    refreshChecklist(rec);
    closeIncidentVisuals(rec);
    const skipped = rec.steps.filter((s) => s === "skip").length;
    const d = new Date();
    const reportId = `R-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(rec.n).padStart(3, "0")}`;
    beep("ok");
    ok(`<span class="b">Świetnie, wszystkie kroki wykonane.</span> Zdarzenie zakończone o ${rec.closedAt}. Raport <span class="h">${reportId}</span> zapisał się automatycznie${skipped ? ` (z informacją o ${skipped} ${skipped === 1 ? "niewykonanym kroku" : "niewykonanych krokach"})` : ""}. Kamera ${rec.inc.cam} wraca do normalnej pracy.`);
    pushEvent(`${rec.inc.id} zamknięte · ${reportId}`, "ok", rec.inc.cam);
    scheduleAuto(12000);
  }

  function closeIncidentVisuals(rec) {
    state.closed.push(rec);
    if (state.active === rec) state.active = null;
    setCamState(rec.inc.cam, null);
    state.sensorOverride._rising = false; state.sensorOverride._falling = true;
    if (state.selectedCam === rec.inc.cam) selectCamera(rec.inc.cam);
    updateKpis();
  }

  /* ==================================================================
     START
     ================================================================== */
  function tickClock() {
    const d = new Date();
    els.clockTime.textContent = now();
    els.clockDate.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${["NDZ", "PON", "WT", "ŚR", "CZW", "PT", "SOB"][d.getDay()]}`;
    els.osdTime.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${now()}`;
  }

  async function boot() {
    renderScene();
    syncAspect();
    updateKpis();
    tickClock(); setInterval(tickClock, 1000);
    tickSensors(); setInterval(tickSensors, 2000);
    setNoSignal(true, "wybierz kamerę na modelu 3D");
    ["click", "keydown"].forEach((ev) => window.addEventListener(ev, () => { if (!state.audioCtx) { try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } }, { once: true }));

    await ai(`Dzień dobry! Jestem Twoim asystentem ochrony. Pilnuję <span class="b">12 kamer</span> w kopalni – na powierzchni i pod ziemią.`);
    await ai(`Jeśli zobaczę coś niebezpiecznego, <span class="b">od razu Ci powiem</span>, pokażę obraz z tej kamery i poprowadzę Cię krok po kroku. Nie musisz nic wpisywać – wystarczy klikać przyciski.`);
    await sys(`<span class="k">Demo: kliknij <span class="h">NASTĘPNE ZDARZENIE</span> u góry, aby zobaczyć przykładowy alarm, albo <span class="h">AUTO</span>, żeby zdarzenia pojawiały się same.</span>`);
  }

  boot();
})();

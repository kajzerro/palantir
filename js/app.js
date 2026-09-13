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
    log: $("#term-log"), form: $("#term-form"), input: $("#term-in"),
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
  const sys = (html, o) => say("sys", "SYSTEM", html, o);
  const ai = (html, o) => say("ai", "SENTINEL", html, o);
  const ok = (html, o) => say("ok", "SENTINEL", html, o);
  const warn = (html, o) => say("warn", "SENTINEL", html, o);
  function op(text) { renderMessage({ kind: "op", from: "OPERATOR", html: esc(text) }); }

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

  /* ---------- polecenia ---------- */
  const HELP = `
<span class="b">Polecenia</span>
  <span class="h">pomoc</span>              ta lista
  <span class="h">status</span>             podsumowanie obiektu (kamery, gaz, załoga, alarmy)
  <span class="h">kamery</span>             lista kamer
  <span class="h">kamera &lt;n|id&gt;</span>      otwórz kamerę na podglądzie, np. <span class="h">kamera 8</span>
  <span class="h">dalej</span>              wywołaj następne zaplanowane zdarzenie (sterowanie demo)
  <span class="h">auto</span>               włącz/wyłącz automatyczne odtwarzanie scenariusza
  <span class="h">procedura</span>          pokaż procedurę aktywnego zdarzenia
  <span class="h">dziennik</span>           dziennik zdarzeń
  <span class="h">wyczyść</span>            wyczyść terminal
  <span class="k">Podczas alarmu możesz też wpisać numer opcji (1, 2, 3…).</span>`.trim();

  function handleInput(raw) {
    const text = raw.trim();
    if (!text) return;
    op(text);
    const low = text.toLowerCase();
    const [cmd, ...rest] = low.split(/\s+/);
    const arg = rest.join(" ");

    if (/^\d+$/.test(low) && state.pendingOptions) {
      const i = parseInt(low, 10) - 1;
      const po = state.pendingOptions;
      if (po.options[i]) { po.el.classList.add("used"); po.el.children[i].classList.add("chosen"); state.pendingOptions = null; po.options[i].action && po.options[i].action(); }
      else warn(`Nie ma opcji ${i + 1}. Wybierz 1–${po.options.length}.`);
      return;
    }
    if (state.pendingOptions) {
      const po = state.pendingOptions;
      const i = po.options.findIndex((o) => o.label.toLowerCase().startsWith(low) || (o.keys || []).some((k) => low.includes(k)));
      if (i >= 0) { po.el.classList.add("used"); po.el.children[i].classList.add("chosen"); state.pendingOptions = null; po.options[i].action && po.options[i].action(); return; }
    }

    switch (cmd) {
      case "pomoc": case "help": case "?": sys(HELP); return;
      case "status": cmdStatus(); return;
      case "kamery": case "cams": case "cameras": cmdCams(); return;
      case "kamera": case "kam": case "cam": case "otwórz": case "otworz": case "open": {
        const id = /^\d+$/.test(arg) ? camIndex(parseInt(arg, 10))?.id : arg.toUpperCase().replace(/^(KAM|CAM)-?/, "KAM-").replace(/^KAM-(\d)$/, "KAM-0$1");
        const c = id && camById(id);
        if (!c) { warn(`Nieznana kamera „${esc(arg)}”. Wpisz <span class="h">kamery</span>.`); return; }
        selectCamera(c.id, { announce: true });
        return;
      }
      case "dalej": case "next": case "zdarzenie": fireNextIncident(); return;
      case "auto": toggleAuto(); return;
      case "procedura": case "proc": cmdProc(); return;
      case "dziennik": case "log": case "zdarzenia": cmdLog(); return;
      case "wyczyść": case "wyczysc": case "clear": els.log.innerHTML = ""; return;
      case "potwierdź": case "potwierdz": case "ack": if (state.active && state.active.status === "new") { confirmIncident(); return; } break;
    }
    const hit = D.chatter.find((c) => c.keys.some((k) => low.includes(k)));
    if (hit) { ai(esc(typeof hit.reply === "function" ? hit.reply() : hit.reply)); return; }
    ai(`Nie rozumiem <span class="k">„${esc(text)}”</span>. Wpisz <span class="h">pomoc</span>, aby zobaczyć polecenia${state.pendingOptions ? ", albo odpowiedz numerem opcji" : ""}.`);
  }

  function cmdStatus() {
    const online = D.cameras.filter((c) => !c.offline).length;
    const ch4 = Object.entries(currentSensors()).map(([k, v]) => `${k} ${pct(v)}`).join(" · ");
    sys(`<table class="kv">
<tr><td>kamery</td><td>${online}/${D.cameras.length} online ${D.cameras.filter((c) => c.offline).map((c) => `<span class="k">(${c.id} offline)</span>`).join("")}</td></tr>
<tr><td>metan</td><td>${ch4}</td></tr>
<tr><td>załoga na dole</td><td>312 (zmiana B)</td></tr>
<tr><td>wentylacja</td><td><span class="g">wentylator główny nominalnie · 312 m³/s</span></td></tr>
<tr><td>aktywne alarmy</td><td>${state.active ? `<span class="r">1 · ${state.active.inc.id} · ${statusLabel(state.active.status)}</span>` : `<span class="g">brak</span>`}</td></tr>
<tr><td>zamknięte dziś</td><td>${state.closed.length}</td></tr>
<tr><td>model AI</td><td>sentinel-vision v4.2 · 25 kl/s · 13 strumieni</td></tr></table>`);
  }
  function statusLabel(s) { return { new: "NOWE", confirmed: "W PROCEDURZE", closed: "ZAMKNIĘTE", false: "FAŁSZYWY ALARM" }[s] || s.toUpperCase(); }

  function cmdCams() {
    const rows = D.cameras.map((c, i) => `<tr><td>${i + 1}</td><td><span class="h">${c.id}</span></td><td>${esc(c.name)}</td><td class="k">${esc(c.zone)}</td><td>${c.offline ? '<span class="k">OFFLINE</span>' : '<span class="g">ONLINE</span>'}</td></tr>`).join("");
    sys(`<table class="kv">${rows}</table><span class="k">Otwórz przez </span><span class="h">kamera &lt;n&gt;</span><span class="k"> lub kliknij punkt na modelu 3D.</span>`);
  }

  function cmdProc() {
    if (!state.active || state.active.status === "new") { warn("Brak potwierdzonego zdarzenia. Procedury są pokazywane po potwierdzeniu anomalii."); return; }
    sys(procedureHtml(state.active));
  }

  function cmdLog() {
    if (!state.closed.length && !state.active) { sys("Dziennik zdarzeń jest pusty."); return; }
    const rows = [...state.closed, ...(state.active ? [state.active] : [])].map((r) =>
      `<tr><td><span class="h">${r.inc.id}</span></td><td>${severityTag(r.inc.severity)}</td><td>${esc(r.inc.title)}</td><td>${r.inc.cam}</td><td>${r.status === "closed" ? '<span class="g">ZAMKNIĘTE</span>' : r.status === "false" ? '<span class="k">FAŁSZYWY ALARM</span>' : `<span class="y">${statusLabel(r.status)}</span>`}</td></tr>`).join("");
    sys(`<table class="kv log">${rows}</table>`);
  }

  els.form.addEventListener("submit", (e) => { e.preventDefault(); const v = els.input.value; els.input.value = ""; handleInput(v); });
  els.btnNext.addEventListener("click", () => { op("dalej"); fireNextIncident(); });
  els.btnAuto.addEventListener("click", () => { op("auto"); toggleAuto(); });

  /* ==================================================================
     CYFROWY BLIŹNIAK – model 3D w rzucie ukośnym z lotu ptaka
     ------------------------------------------------------------------
     Współrzędne świata: x 0–520 (zachód→wschód), y 0–200 (północ→południe),
     z = wysokość w px. Poziomy są ułożone jeden pod drugim (widok rozstrzelony).
     ================================================================== */
  const SVGNS = "http://www.w3.org/2000/svg";
  const SH = 0.45, FY = 0.5, LEVEL_DY = 135, OX = 22, OY = 92;
  const W = 520, DEPTH = 200;
  const P = (x, y, z = 0, level = 0) => [OX + x + SH * y, OY + FY * y - z + level * LEVEL_DY];
  const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls = "lbl", anchor = "middle") {
    const t = svgEl("text", { x: x.toFixed(1), y: y.toFixed(1), class: cls, "text-anchor": anchor }, parent);
    t.textContent = str;
    return t;
  }

  /** Bryła prostopadłościenna: górna, przednia (y+d) i prawa (x+w) ściana. */
  function box(parent, level, x, y, w, d, h, cls = "", label, labelOpts = {}) {
    const g = svgEl("g", { class: `bx ${cls}` }, parent);
    if (h > 0) {
      svgEl("polygon", { class: "f-front", points: pts([P(x, y + d, h, level), P(x + w, y + d, h, level), P(x + w, y + d, 0, level), P(x, y + d, 0, level)]) }, g);
      svgEl("polygon", { class: "f-right", points: pts([P(x + w, y, h, level), P(x + w, y + d, h, level), P(x + w, y + d, 0, level), P(x + w, y, 0, level)]) }, g);
    }
    svgEl("polygon", { class: "f-top" + (labelOpts.hatch ? " hatch" : ""), points: pts([P(x, y, h, level), P(x + w, y, h, level), P(x + w, y + d, h, level), P(x, y + d, h, level)]) }, g);
    if (label) {
      const pos = labelOpts.pos || "top";
      if (pos === "top") { const [cx, cy] = P(x + w / 2, y + d / 2, h, level); text(g, cx, cy + 3, label, labelOpts.cls || "lbl"); }
      else if (pos === "above") { const [cx, cy] = P(x + w / 2, y, h, level); text(g, cx, cy - 4, label, labelOpts.cls || "lbl"); }
      else if (pos === "below") { const [cx, cy] = P(x + w / 2, y + d, 0, level); text(g, cx, cy + 9, label, labelOpts.cls || "lbl sm"); }
      else if (pos === "aboveRight") { const [cx, cy] = P(x + w - 2, y, h, level); text(g, cx, cy - 4, label, labelOpts.cls || "lbl sm", "end"); }
      else if (pos === "aboveLeft") { const [cx, cy] = P(x + 2, y, h, level); text(g, cx, cy - 4, label, labelOpts.cls || "lbl sm", "start"); }
      else if (pos === "right") { const [cx, cy] = P(x + w, y + d / 2, h, level); text(g, cx + 6, cy + 3, label, labelOpts.cls || "lbl sm", "start"); }
      else if (pos === "belowLeft") { const [cx, cy] = P(x + 2, y + d, 0, level); text(g, cx, cy + 9, label, labelOpts.cls || "lbl sm", "start"); }
    }
    return g;
  }

  /** Płyta poziomu: górna powierzchnia z siatką + cienka krawędź. */
  function slab(parent, level, name, sub) {
    const g = svgEl("g", { class: `lvl-slab` }, parent);
    const th = 5;
    svgEl("polygon", { class: `slab-side${level === 0 ? " surface" : ""}`, points: pts([P(0, DEPTH, 0, level), P(W, DEPTH, 0, level), P(W, DEPTH, -th, level), P(0, DEPTH, -th, level)]) }, g);
    svgEl("polygon", { class: `slab-side${level === 0 ? " surface" : ""}`, points: pts([P(W, 0, 0, level), P(W, DEPTH, 0, level), P(W, DEPTH, -th, level), P(W, 0, -th, level)]) }, g);
    svgEl("polygon", { class: `slab${level === 0 ? " surface" : ""}`, points: pts([P(0, 0, 0, level), P(W, 0, 0, level), P(W, DEPTH, 0, level), P(0, DEPTH, 0, level)]) }, g);
    for (let gx = 40; gx < W; gx += 40) svgEl("line", { class: "gridl", x1: P(gx, 0, 0, level)[0], y1: P(gx, 0, 0, level)[1], x2: P(gx, DEPTH, 0, level)[0], y2: P(gx, DEPTH, 0, level)[1] }, g);
    for (let gy = 40; gy < DEPTH; gy += 40) svgEl("line", { class: "gridl", x1: P(0, gy, 0, level)[0], y1: P(0, gy, 0, level)[1], x2: P(W, gy, 0, level)[0], y2: P(W, gy, 0, level)[1] }, g);
    const [lx, ly] = P(0, 0, 0, level);
    text(g, lx, ly - 12, name, "lbl lvl", "start");
    if (sub) text(g, lx, ly - 3, sub, "lbl lvl-sub", "start");
    return g;
  }

  /** Klin pola widzenia kamery, liczony w płaszczyźnie świata i rzutowany. */
  function fovPoints(x, y, level, dirDeg, r = 30, half = 24) {
    const out = [P(x, y, 0, level)];
    for (let a = dirDeg - half; a <= dirDeg + half; a += 8) {
      const rad = a * Math.PI / 180;
      out.push(P(x + r * Math.cos(rad), y + r * Math.sin(rad), 0, level));
    }
    return out;
  }

  function renderScene() {
    els.scene.innerHTML = "";
    const S = els.scene;
    const levelGroups = {};
    const camGroups = {};

    /* --------- POZIOM −500 (rysowany pierwszy, jest najniżej) --------- */
    {
      const L = 2, g = svgEl("g", { class: "lvl-group lvl-2" }, S); levelGroups[2] = g;
      slab(g, L, "POZIOM −500 m", "POKŁAD 510");
      box(g, L, 90, 86, 430, 12, 5, "corr", "PRZEKOP GŁÓWNY G-7", { pos: "aboveLeft" });
      box(g, L, 262, 66, 12, 20, 5, "corr");   // podszybie → przekop
      box(g, L, 405, 20, 100, 66, 6, "lw", "ŚCIANA W-7 (CZYNNA)", { pos: "above" });
      box(g, L, 405, 20, 100, 66, 6, "lw", null, { hatch: true });
      box(g, L, 250, 98, 12, 30, 5, "corr");   // dojście do odmetanowania
      box(g, L, 140, 98, 12, 30, 5, "corr");   // dojście do komory MW
      box(g, L, 130, 128, 60, 22, 12, "mag", "KOMORA MW", { pos: "below" });
      box(g, L, 236, 128, 60, 22, 12, "", "STACJA ODMETANOWANIA", { pos: "below" });
      box(g, L, 396, 128, 44, 22, 12, "ref", "KOMORA RATUNKOWA KR-2", { pos: "below" });
      box(g, L, 388, 98, 12, 30, 5, "corr");
      camGroups[2] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* --------- POCHYLNIA TAŚMOWA (między poziomami) --------- */
    {
      const g = svgEl("g", { class: "lvl-group lvl-1 lvl-2 drift-group" }, S);
      svgEl("polygon", { class: "drift", points: pts([P(330, 86, 0, 1), P(330, 98, 0, 1), P(292, 98, 0, 2), P(292, 86, 0, 2)]) }, g);
      const a = P(330, 92, 2, 1), b = P(292, 92, 2, 2);
      svgEl("line", { class: "belt", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
      const m = P(311, 92, 10, 1.5);
      text(g, m[0] + 30, m[1] + 3, "POCHYLNIA TAŚMOWA P-2", "lbl sm", "start");
    }

    /* --------- POZIOM −300 --------- */
    {
      const L = 1, g = svgEl("g", { class: "lvl-group lvl-1" }, S); levelGroups[1] = g;
      slab(g, L, "POZIOM −300 m", "POKŁAD 405/1");
      box(g, L, 60, 86, 420, 12, 5, "corr");
      text(g, P(150, 98, 0, L)[0], P(150, 98, 0, L)[1] + 9, "PRZEKOP GŁÓWNY G-3", "lbl sm", "start");
      box(g, L, 262, 66, 12, 20, 5, "corr");   // podszybie → przekop
      box(g, L, 60, 26, 100, 60, 6, "lw", "ŚCIANA L-12 (CZYNNA)", { pos: "above" });
      box(g, L, 60, 26, 100, 60, 6, "lw", null, { hatch: true });
      box(g, L, 300, 98, 40, 14, 8, "", "STACJA ZAŁADOWCZA", { pos: "below" });
      box(g, L, 424, 98, 36, 14, 8, "", "ŁADOWNIA AKUMULATORÓW", { pos: "below" });
      box(g, L, 482, 60, 12, 26, 5, "corr");   // chodnik do szybu II
      camGroups[1] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* --------- POWIERZCHNIA --------- */
    {
      const L = 0, g = svgEl("g", { class: "lvl-group lvl-0" }, S); levelGroups[0] = g;
      slab(g, L, "POWIERZCHNIA", "KWK „WSCHÓD-1” · +262 m n.p.m.");
      svgEl("polygon", { class: "fence", points: pts([P(6, 6, 2), P(W - 6, 6, 2), P(W - 6, DEPTH - 6, 2), P(6, DEPTH - 6, 2)]) }, g);
      // drogi
      svgEl("polygon", { class: "road", points: pts([P(0, 150), P(300, 150), P(300, 162), P(0, 162)]) }, g);
      svgEl("polygon", { class: "road", points: pts([P(290, 40), P(302, 40), P(302, 162), P(290, 162)]) }, g);
      // tory kolejowe
      const r1 = P(330, 190), r2 = P(516, 190);
      svgEl("line", { class: "rail", x1: r1[0], y1: r1[1], x2: r2[0], y2: r2[1] }, g);
      // budynki – kolejność rysowania od tyłu (małe x+y) do przodu
      box(g, L, 330, 30, 110, 60, 36, "plant", "ZAKŁAD PRZERÓBCZY", { pos: "top" });
      box(g, L, 255, 40, 26, 26, 64, "tower");                                   // wieża szybu I
      const [wx, wy] = P(268, 53, 64);
      svgEl("circle", { class: "wheel", cx: wx, cy: wy - 8, r: 7 }, g);
      text(g, wx, wy - 22, "SZYB I „PIAST”", "lbl");
      box(g, L, 285, 40, 34, 18, 14, "", "MASZYNA WYCIĄGOWA", { pos: "below" });
      const c1 = P(281, 53, 40), c2 = P(330, 60, 26);
      svgEl("line", { class: "conv", x1: c1[0], y1: c1[1], x2: c2[0], y2: c2[1] }, g);
      box(g, L, 480, 60, 14, 14, 8, "", "SZYB II (WENT.)", { pos: "below" });
      box(g, L, 70, 112, 110, 36, 16, "", "LAMPOWNIA · ŁAŹNIA", { pos: "top" });
      box(g, L, 8, 168, 30, 20, 10, "", "BRAMA GŁÓWNA", { pos: "below" });
      // hałdy / składowisko
      [[350, 176, 34, 16], [392, 178, 40, 18], [444, 176, 30, 15]].forEach(([px, py, pw, ph]) => {
        svgEl("polygon", { class: "pile", points: pts([P(px, py + 12), P(px + pw, py + 12), P(px + pw / 2, py + 4, ph)]) }, g);
      });
      text(g, P(392, 200)[0], P(392, 200)[1] + 8, "SKŁADOWISKO · ZAŁADUNEK KOLEJOWY", "lbl sm");
      box(g, L, 448, 148, 34, 30, 14, "", "STACJA WENTYLATORÓW", { pos: "right" });
      const [fx, fy] = P(465, 163, 14);
      const fan = svgEl("g", { class: "fan" }, g);
      svgEl("circle", { cx: fx, cy: fy, r: 7 }, fan);
      svgEl("line", { x1: fx - 7, y1: fy, x2: fx + 7, y2: fy }, fan);
      svgEl("line", { x1: fx, y1: fy - 7, x2: fx, y2: fy + 7 }, fan);
      camGroups[0] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* --------- SZYBY (kolumny przez wszystkie poziomy) --------- */
    {
      const g = svgEl("g", { class: "shafts" }, S);
      const shaft = (x, y, w, d, toLevel) => {
        svgEl("polygon", { class: "shaft", points: pts([P(x, y + d, 0, 0), P(x + w, y + d, 0, 0), P(x + w, y + d, 0, toLevel), P(x, y + d, 0, toLevel)]) }, g);
        svgEl("polygon", { class: "shaft", points: pts([P(x + w, y, 0, 0), P(x + w, y + d, 0, 0), P(x + w, y + d, 0, toLevel), P(x + w, y, 0, toLevel)]) }, g);
        const a = P(x + w / 2, y + d / 2, 0, 0), b = P(x + w / 2, y + d / 2, 0, toLevel);
        svgEl("line", { class: "shaft-line", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
      };
      shaft(255, 40, 26, 26, 2);
      shaft(480, 60, 14, 14, 1);
    }

    /* --------- czujniki metanu --------- */
    const sg = svgEl("g", { id: "ch4-sensors" }, S);
    D.sensors.forEach((s) => {
      const [x, y] = P(s.x, s.y, 0, s.level);
      text(sg, x, y, "CH₄ —", "sensor", "start").dataset.sensor = s.id;
    });

    /* --------- kamery --------- */
    D.cameras.forEach((c) => {
      const layer = camGroups[Math.floor(c.level)] || camGroups[1];
      const g = svgEl("g", { class: `cam${c.offline ? " off" : ""}`, "data-id": c.id, tabindex: 0, role: "button" }, layer);
      const [bx, by] = P(c.x, c.y, 0, c.level);
      const [tx, ty] = P(c.x, c.y, 10, c.level);
      svgEl("polygon", { class: "fov", points: pts(fovPoints(c.x, c.y, c.level, c.dir)) }, g);
      svgEl("line", { class: "mast", x1: bx, y1: by, x2: tx, y2: ty }, g);
      svgEl("circle", { class: "hit", cx: tx, cy: ty, r: 13 }, g);
      svgEl("circle", { class: "pulse", cx: tx, cy: ty, r: 6 }, g);
      svgEl("circle", { class: "ring", cx: tx, cy: ty, r: 6.5 }, g);
      svgEl("circle", { class: "core", cx: tx, cy: ty, r: 3.5 }, g);
      text(g, tx + 9, ty + 3, c.id.replace("KAM-", "K"), "id", "start");
      g.addEventListener("click", () => selectCamera(c.id, { announce: true }));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCamera(c.id, { announce: true }); } });
      g.addEventListener("mouseenter", (e) => showTooltip(c, e));
      g.addEventListener("mousemove", (e) => moveTooltip(e));
      g.addEventListener("mouseleave", hideTooltip);
    });

    // liczniki kamer w panelu poziomów
    [0, 1, 2].forEach((l) => {
      const cams = D.cameras.filter((c) => Math.floor(c.level) === l);
      const off = cams.filter((c) => c.offline).length;
      const el = $(`#lvl-sub-${l}`);
      if (el) el.textContent = `${cams.length} kamer${off ? ` · ${off} offline` : ""}`;
    });
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
  els.twinSide.addEventListener("click", (e) => {
    const b = e.target.closest(".lvl-btn"); if (!b) return;
    state.focusLevel = b.dataset.level;
    els.twinSide.querySelectorAll(".lvl-btn").forEach((x) => x.classList.toggle("active", x === b));
    els.svg.classList.remove("focus-0", "focus-1", "focus-2");
    if (state.focusLevel !== "all") els.svg.classList.add(`focus-${state.focusLevel}`);
  });

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

  function loadVideo(src) {
    const v = els.video;
    v.onerror = null; v.onloadeddata = null;
    if (!src) { v.removeAttribute("src"); v.load(); setNoSignal(true, "brak skonfigurowanego wideo dla tej kamery"); return; }
    setNoSignal(true, `oczekiwanie na strumień… <code>${esc(src)}</code>`);
    v.onloadeddata = () => { setNoSignal(false); v.play().catch(() => {}); };
    v.onerror = () => setNoSignal(true, `strumień niedostępny — umieść swój klip w <code>${esc(src)}</code> i odśwież stronę`);
    v.src = src; v.load();
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

  function selectCamera(id, { announce = false } = {}) {
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
    if (announce) sys(`Podgląd → <span class="h">${c.id}</span> ${esc(c.name)} <span class="k">(${esc(c.zone)})</span>${c.offline ? ' · <span class="r">kamera offline</span>' : ""}`, { delay: 80 });
  }

  function pushEvent(text, cls, camId) {
    const li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = `<span class="t">${now()}</span><span class="s">${text}</span>`;
    if (camId) li.addEventListener("click", () => selectCamera(camId, { announce: true }));
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
    els.termMode.textContent = state.auto ? "AUTO" : "RĘCZNY";
    els.termMode.className = `pill ${state.auto ? "ok" : ""}`;
    els.btnAuto.classList.toggle("active", state.auto);
    refreshLevelButtons();
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateKpis();
    if (state.auto) { sys(`Automatyczne odtwarzanie scenariusza <span class="g">WŁĄCZONE</span>. Następne zdarzenie za 8 s, o ile nie ma otwartego zdarzenia.`); scheduleAuto(8000); }
    else { sys(`Automatyczne odtwarzanie scenariusza <span class="y">WYŁĄCZONE</span>. Użyj <span class="h">dalej</span> lub NASTĘPNE ZDARZENIE.`); clearTimeout(state.autoTimer); }
  }
  function scheduleAuto(ms) {
    clearTimeout(state.autoTimer);
    if (!state.auto) return;
    state.autoTimer = setTimeout(() => { if (state.auto && !state.active) fireNextIncident(); else if (state.auto) scheduleAuto(5000); }, ms);
  }

  const SEV_CLS = { NISKI: "LOW", ŚREDNI: "MEDIUM", WYSOKI: "HIGH", KRYTYCZNY: "CRITICAL" };
  function severityTag(s) { return `<span class="tag ${SEV_CLS[s] || ""}">${s}</span>`; }

  function fireNextIncident() {
    if (state.active && state.active.status !== "closed") {
      warn(`Zdarzenie <span class="h">${state.active.inc.id}</span> jest nadal otwarte. Zamknij je (dokończ procedurę lub oznacz jako fałszywy alarm) przed kolejnym zdarzeniem.`);
      return;
    }
    if (state.incidentCursor >= D.incidents.length) {
      ok(`Odtworzono wszystkie ${D.incidents.length} zaplanowane zdarzenia. Odśwież stronę, aby rozpocząć scenariusz od nowa, albo wpisz <span class="h">dziennik</span>, aby zobaczyć podsumowanie.`);
      state.auto = false; updateKpis();
      return;
    }
    const inc = D.incidents[state.incidentCursor++];
    const cam = camById(inc.cam);
    const rec = { inc, cam, status: "new", step: 0, steps: [], openedAt: now(), n: ++state.seq };
    state.active = rec;
    if (inc.sensors) { Object.assign(state.sensorOverride, inc.sensors); state.sensorOverride._rising = true; state.sensorOverride._falling = false; }

    setCamState(inc.cam, "alert");
    document.body.classList.remove("flash"); void document.body.offsetWidth; document.body.classList.add("flash");
    beep(inc.severity);
    selectCamera(inc.cam);
    pushEvent(`${inc.id} ${esc(inc.title)}`, "alert", inc.cam);
    updateKpis();

    const conf = Math.round(inc.detections.reduce((a, d) => a + d[1], 0) / inc.detections.length * 100);
    const kind = inc.severity === "KRYTYCZNY" ? "alert crit" : "alert";
    say(kind, `⚠ ALARM · ${inc.id}`, `${severityTag(inc.severity)} <span class="b">${esc(inc.title)}</span>
<table class="kv">
<tr><td>kamera</td><td><span class="h">${cam.id}</span> ${esc(cam.name)} · ${esc(cam.zone)}</td></tr>
<tr><td>wzorzec</td><td>${inc.detections.map((d) => esc(d[0])).join(" · ")}</td></tr>
<tr><td>pewność</td><td>${conf} %</td></tr>
<tr><td>czas</td><td>${rec.openedAt}</td></tr>
</table>${esc(inc.summary)}`, { delay: 120 });

    ai(`Podgląd na żywo przełączony na <span class="h">${cam.id}</span> (${esc(LEVEL_NAMES[Math.floor(cam.level)])}). Punkt kamery na modelu 3D miga na czerwono. <span class="b">Co chcesz zrobić dalej?</span>`, {
      options: assessmentOptions(rec, true),
    });
  }

  function assessmentOptions(rec, withAnalysis) {
    const o = [
      { label: "Potwierdź anomalię i otwórz procedurę", cls: "danger", keys: ["potwierd", "tak", "confirm"], action: confirmIncident },
    ];
    if (withAnalysis) o.push({ label: "Poproś o szczegółową analizę AI", keys: ["analiz", "szczegó", "więcej", "wiecej"], action: () => analysis(rec) });
    o.push({ label: "Obserwuj dalej – ponowny alarm za 20 s, jeśli wzorzec się utrzyma", keys: ["obserw", "czekaj", "poczekaj"], action: () => holdIncident(rec) });
    o.push({ label: "Oznacz jako fałszywy alarm", cls: "good", keys: ["fałszyw", "falszyw"], action: () => falseAlarm(rec) });
    return o;
  }

  function analysis(rec) {
    const inc = rec.inc;
    const rows = inc.detections.map((d) => `<tr><td>${esc(d[0])}</td><td>${(d[1] * 100).toFixed(0)} %</td></tr>`).join("");
    ai(`<span class="b">Analiza rozszerzona · ${inc.id}</span>
<table class="kv">${rows}</table>${esc(inc.aiNotes)}

<span class="b">Zalecana procedura:</span> <span class="h">${inc.procedure}</span> „${esc(D.procedures[inc.procedure].title)}” <span class="k">(${esc(D.procedures[inc.procedure].ref)})</span>
Twoja decyzja?`, { options: assessmentOptions(rec, false) });
  }

  function holdIncident(rec) {
    ai(`Obserwuję. Śledzę dalej na <span class="h">${rec.inc.cam}</span> i ponowię alarm za 20 s, jeśli wzorzec się utrzyma.`);
    setTimeout(() => {
      if (state.active !== rec || rec.status !== "new") return;
      beep(rec.inc.severity);
      say("alert", `⚠ PONOWNY ALARM · ${rec.inc.id}`, `${severityTag(rec.inc.severity)} Wzorzec <span class="b">utrzymuje się</span> na ${rec.inc.cam} po 20 s. Nadal wykryto: ${esc(rec.inc.detections[0][0])}. Procedura wymaga teraz decyzji.`, { options: assessmentOptions(rec, false), delay: 100 });
    }, 20000);
  }

  function falseAlarm(rec) {
    rec.status = "false"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    ok(`<span class="b">${rec.inc.id} oznaczone jako FAŁSZYWY ALARM</span> o ${rec.closedAt}. Nagranie zachowano do douczenia modelu, a czułość dla tego wzorca na ${rec.inc.cam} obniżono na 24 h. Kamera wraca do stanu nominalnego.`);
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

    ai(`Zdarzenie <span class="h">${inc.id}</span> <span class="b">potwierdzone</span>. Powiadamiam dyspozytora ruchu i otwieram obowiązkową procedurę:
<span class="b">${inc.procedure} · ${esc(proc.title)}</span> <span class="k">(${esc(proc.ref)})</span>
Kroków: ${proc.steps.length}. Wykonaj każdy krok i potwierdź go tutaj – każde potwierdzenie jest zapisywane w karcie zdarzenia z sygnaturą czasu.`);
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
    return `<span class="b">${rec.inc.procedure} · ${esc(proc.title)}</span><ul class="steps">${items}</ul>`;
  }
  function refreshChecklist(rec) {
    if (rec.checklistEl) rec.checklistEl.querySelector(".body").innerHTML = procedureHtml(rec);
  }

  function askStep(rec) {
    const proc = D.procedures[rec.inc.procedure];
    const i = rec.step;
    if (i >= proc.steps.length) { completeIncident(rec); return; }
    refreshChecklist(rec);
    ai(`<span class="y">Krok ${i + 1}/${proc.steps.length}</span> · ${esc(proc.steps[i])}`, {
      options: [
        { label: "Wykonano – potwierdź krok", cls: "good", keys: ["wykon", "zrobione", "ok", "gotowe", "done"], action: () => stepDone(rec) },
        { label: "Niemożliwe – zgłoś odstępstwo i kontynuuj", cls: "danger", keys: ["niemoż", "niemoz", "pomiń", "pomin", "nie da"], action: () => stepSkip(rec) },
        { label: "Pokaż całą procedurę", keys: ["pokaż", "pokaz", "procedur"], action: () => { sys(procedureHtml(rec)); askStep(rec); } },
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
    warn(`Zarejestrowano odstępstwo w kroku ${rec.step}. Dyspozytor ruchu i sztygar zmianowy zostali powiadomieni o odstępstwie.`);
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
    ok(`<span class="b">Procedura ${rec.inc.procedure} zakończona. Zdarzenie ${rec.inc.id} zamknięte</span> o ${rec.closedAt}.
Raport <span class="h">${reportId}</span> zapisany w książce raportów zmiany${skipped ? ` z <span class="y">${skipped} zgłoszon${skipped === 1 ? "ym odstępstwem" : "ymi odstępstwami"}</span>` : ""}; nagranie, detekcje i Twoje decyzje z sygnaturą czasu zostały dołączone. ${rec.inc.cam} wraca do normalnego monitoringu.`);
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
    updateKpis();
    tickClock(); setInterval(tickClock, 1000);
    tickSensors(); setInterval(tickSensors, 2000);
    setNoSignal(true, "wybierz kamerę na modelu 3D");
    ["click", "keydown"].forEach((ev) => window.addEventListener(ev, () => { if (!state.audioCtx) { try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } }, { once: true }));

    await sys(`SENTINEL-CI v4.2.1 · analiza wizyjna infrastruktury krytycznej`, { delay: 60 });
    await sys(`łączenie z systemem VMS … <span class="g">ok</span> · 13 strumieni · 12 online · 1 offline (KAM-13)`, { delay: 300 });
    await sys(`łączenie z metanometrią (gazometria) … <span class="g">ok</span>`, { delay: 220 });
    await sys(`łączenie z kontrolą dostępu i rejestrem znaczków … <span class="g">ok</span>`, { delay: 220 });
    await sys(`ładowanie modeli anomalii: osoba-leżąca · ŚOI · ogień/dym · strefa-zakazana · perymetr · porzucony-przedmiot … <span class="g">ok</span>`, { delay: 320 });
    await ai(`Dzień dobry. Obserwuję <span class="b">12 kamer</span> w KWK „Wschód-1” – powierzchnię, poziom −300 i poziom −500. Kliknij dowolny punkt kamery na modelu 3D, aby otworzyć podgląd na żywo. Gdy wykryję niebezpieczny wzorzec, zgłoszę alarm tutaj, przełączę podgląd na tę kamerę i przeprowadzę Cię przez wymaganą procedurę.`);
    await sys(`Sterowanie demo: naciśnij <span class="h">NASTĘPNE ZDARZENIE</span> (lub wpisz <span class="h">dalej</span>), aby wywołać kolejną zaplanowaną anomalię, albo <span class="h">AUTO</span>, aby scenariusz odtwarzał się sam. Wpisz <span class="h">pomoc</span>, aby zobaczyć wszystkie polecenia.`);
    els.input.focus();
  }

  boot();
})();

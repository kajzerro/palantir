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

  /* ---------- prymitywy ---------- */
  const Pl = (x, y, z = 0) => [x + SH * y, FY * y - z];      // projekcja lokalna (dla obiektów ruchomych)

  function drawBox(g, Pf, x, y, w, d, h, cls = "") {
    const b = svgEl("g", { class: `bx ${cls}` }, g);
    if (h > 0) {
      svgEl("polygon", { class: "f-front", points: pts([Pf(x, y + d, h), Pf(x + w, y + d, h), Pf(x + w, y + d, 0), Pf(x, y + d, 0)]) }, b);
      svgEl("polygon", { class: "f-right", points: pts([Pf(x + w, y, h), Pf(x + w, y + d, h), Pf(x + w, y + d, 0), Pf(x + w, y, 0)]) }, b);
    }
    svgEl("polygon", { class: "f-top", points: pts([Pf(x, y, h), Pf(x + w, y, h), Pf(x + w, y + d, h), Pf(x, y + d, h)]) }, b);
    return b;
  }

  /** Bryła prostopadłościenna na danym poziomie z opcjonalną etykietą. */
  function box(parent, level, x, y, w, d, h, cls = "", label, labelOpts = {}) {
    const g = drawBox(parent, (a, b, c) => P(a, b, c, level), x, y, w, d, h, cls);
    if (labelOpts.hatch) g.querySelector(".f-top").classList.add("hatch");
    if (label) {
      const pos = labelOpts.pos || "top", lc = labelOpts.cls;
      let cx, cy, anchor = "middle";
      if (pos === "top") { [cx, cy] = P(x + w / 2, y + d / 2, h, level); cy += 3; }
      else if (pos === "above") { [cx, cy] = P(x + w / 2, y, h, level); cy -= 4; }
      else if (pos === "below") { [cx, cy] = P(x + w / 2, y + d, 0, level); cy += 9; }
      else if (pos === "aboveRight") { [cx, cy] = P(x + w - 2, y, h, level); cy -= 4; anchor = "end"; }
      else if (pos === "aboveLeft") { [cx, cy] = P(x + 2, y, h, level); cy -= 4; anchor = "start"; }
      else if (pos === "right") { [cx, cy] = P(x + w, y + d / 2, h, level); cx += 6; cy += 3; anchor = "start"; }
      else if (pos === "left") { [cx, cy] = P(x, y + d / 2, h, level); cx -= 5; cy += 3; anchor = "end"; }
      else if (pos === "belowLeft") { [cx, cy] = P(x + 2, y + d, 0, level); cy += 9; anchor = "start"; }
      text(g, cx, cy, label, lc || (pos === "top" ? "lbl" : "lbl sm"), anchor);
    }
    return g;
  }

  /** Walec (komin, zbiornik, osadnik). */
  function cyl(parent, level, cx, cy, r, h, cls = "", label, labelPos = "below") {
    const g = svgEl("g", { class: `cy ${cls}` }, parent);
    const N = 28, top = [], tf = [], bf = [];
    for (let i = 0; i <= N; i++) {
      const th = (2 * Math.PI * i) / N;
      top.push(P(cx + r * Math.cos(th), cy + r * Math.sin(th), h, level));
    }
    for (let i = 0; i <= N / 2; i++) {
      const th = (Math.PI * i) / (N / 2);
      tf.push(P(cx + r * Math.cos(th), cy + r * Math.sin(th), h, level));
      bf.push(P(cx + r * Math.cos(th), cy + r * Math.sin(th), 0, level));
    }
    svgEl("polygon", { class: "f-front", points: pts(tf.concat(bf.reverse())) }, g);
    svgEl("polygon", { class: "f-top", points: pts(top) }, g);
    if (label) {
      if (labelPos === "below") { const [x, y] = P(cx, cy + r, 0, level); text(g, x, y + 9, label, "lbl sm"); }
      else { const [x, y] = P(cx, cy, h, level); text(g, x, y - r * FY - 4, label, "lbl sm"); }
    }
    return g;
  }

  /** Kratownicowa wieża szybowa z kołami linowymi. */
  function headframe(parent, level, x, y, w, d, h) {
    const g = svgEl("g", { class: "lattice" }, parent);
    const ins = 5;
    const base = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
    const topc = [[x + ins, y + ins], [x + w - ins, y + ins], [x + w - ins, y + d - ins], [x + ins, y + d - ins]];
    // podstawa (zrąb szybu)
    drawBox(g, (a, b, c) => P(a, b, c, level), x - 3, y - 3, w + 6, d + 6, 4, "");
    // nogi
    base.forEach(([bx, by], i) => {
      const a = P(bx, by, 4, level), b = P(topc[i][0], topc[i][1], h, level);
      svgEl("line", { class: "leg", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
    });
    // stężenia poziome i ukośne (ściana przednia i prawa)
    for (let k = 1; k <= 3; k++) {
      const f = k / 4, z = 4 + (h - 4) * f;
      const lerp = (i) => [base[i][0] + (topc[i][0] - base[i][0]) * f, base[i][1] + (topc[i][1] - base[i][1]) * f];
      const c = [0, 1, 2, 3].map(lerp);
      [[3, 2], [1, 2]].forEach(([i, j]) => {
        const a = P(c[i][0], c[i][1], z, level), b = P(c[j][0], c[j][1], z, level);
        svgEl("line", { class: "brace", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
        const z2 = 4 + (h - 4) * ((k - 1) / 4);
        const lerp2 = (m) => [base[m][0] + (topc[m][0] - base[m][0]) * ((k - 1) / 4), base[m][1] + (topc[m][1] - base[m][1]) * ((k - 1) / 4)];
        const p1 = lerp2(i), p2 = lerp2(j);
        const d1 = P(p1[0], p1[1], z2, level), d2 = P(c[j][0], c[j][1], z, level);
        svgEl("line", { class: "brace", x1: d1[0], y1: d1[1], x2: d2[0], y2: d2[1] }, g);
        const d3 = P(p2[0], p2[1], z2, level), d4 = P(c[i][0], c[i][1], z, level);
        svgEl("line", { class: "brace", x1: d3[0], y1: d3[1], x2: d4[0], y2: d4[1] }, g);
      });
    }
    // platforma + koła linowe
    drawBox(g, (a, b, c) => P(a, b, c + h, level), x + ins - 1, y + ins - 1, w - 2 * ins + 2, d - 2 * ins + 2, 3, "tower");
    const [wx, wy] = P(x + w / 2, y + d / 2, h + 3, level);
    svgEl("circle", { class: "wheel", cx: wx - 4, cy: wy - 8, r: 6 }, g);
    svgEl("circle", { class: "wheel", cx: wx + 4, cy: wy - 8, r: 6 }, g);
    svgEl("line", { class: "wheel-axle", x1: wx - 4, y1: wy - 8, x2: wx + 4, y2: wy - 8 }, g);
    return g;
  }

  /** Obudowa łukowa: poprzeczne „żebra” wzdłuż chodnika. */
  function arches(parent, level, x1, y1, x2, y2, width, step = 10) {
    const g = svgEl("g", { class: "arches" }, parent);
    const horiz = y1 === y2;
    if (horiz) for (let x = x1 + step / 2; x < x2; x += step) { const a = P(x, y1, 5, level), b = P(x, y1 + width, 5, level); svgEl("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g); }
    else for (let y = y1 + step / 2; y < y2; y += step) { const a = P(x1, y, 5, level), b = P(x1 + width, y, 5, level); svgEl("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g); }
    return g;
  }
  /** Tory w chodniku. */
  function rails(parent, level, x1, y1, x2, y2, off = 2.2, z = 5) {
    const g = svgEl("g", { class: "rails" }, parent);
    const horiz = y1 === y2;
    [-off, off].forEach((o) => {
      const a = horiz ? P(x1, y1 + o, z, level) : P(x1 + o, y1, z, level);
      const b = horiz ? P(x2, y2 + o, z, level) : P(x2 + o, y2, z, level);
      svgEl("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
    });
    return g;
  }
  /** Linia (taśmociąg / rurociąg / przepływ powietrza) między punktami świata. */
  function wline(parent, level, cls, points, z = 6) {
    const p = points.map(([x, y]) => P(x, y, z, level));
    return svgEl("polyline", { class: cls, points: pts(p) }, parent);
  }
  /** Rząd sekcji obudowy zmechanizowanej wzdłuż frontu ściany (front równoległy do osi y). */
  function supports(parent, level, x, y1, y2, step = 5) {
    const g = svgEl("g", { class: "supports" }, parent);
    for (let y = y1; y < y2; y += step) drawBox(g, (a, b, c) => P(a, b, c, level), x, y, 4, step - 1, 3, "support");
    return g;
  }
  /** Obiekt ruchomy wzdłuż ścieżki (punkty świata + poziomy). */
  function mover(parent, cls, pathPts, dur, draw, begin = "0s") {
    const g = svgEl("g", { class: `mover ${cls}` }, parent);
    draw(g);
    const p = pathPts.map(([x, y, l, z]) => P(x, y, z || 0, l));
    const d = "M " + p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ");
    svgEl("animateMotion", { dur, repeatCount: "indefinite", path: d, begin }, g);
    return g;
  }
  const people = (parent, level, x1, x2, y, n, dur) => {
    for (let i = 0; i < n; i++) mover(parent, "person", [[x1, y, level, 6], [x2, y, level, 6], [x1, y, level, 6]], dur, (g) => svgEl("circle", { r: 1.7 }, g), `-${(dur.replace("s", "") * i / n).toFixed(1)}s`);
  };

  /** Płyta poziomu: górna powierzchnia z siatką + cienka krawędź. */
  function slab(parent, level, name, sub) {
    const g = svgEl("g", { class: `lvl-slab` }, parent);
    const th = 5;
    svgEl("polygon", { class: `slab-side${level === 0 ? " surface" : ""}`, points: pts([P(0, DEPTH, 0, level), P(W, DEPTH, 0, level), P(W, DEPTH, -th, level), P(0, DEPTH, -th, level)]) }, g);
    svgEl("polygon", { class: `slab-side${level === 0 ? " surface" : ""}`, points: pts([P(W, 0, 0, level), P(W, DEPTH, 0, level), P(W, DEPTH, -th, level), P(W, 0, -th, level)]) }, g);
    svgEl("polygon", { class: `slab${level === 0 ? " surface" : ""}`, points: pts([P(0, 0, 0, level), P(W, 0, 0, level), P(W, DEPTH, 0, level), P(0, DEPTH, 0, level)]) }, g);
    for (let gx = 40; gx < W; gx += 40) svgEl("line", { class: "gridl", x1: P(gx, 0, 0, level)[0], y1: P(gx, 0, 0, level)[1], x2: P(gx, DEPTH, 0, level)[0], y2: P(gx, DEPTH, 0, level)[1] }, g);
    for (let gy = 40; gy < DEPTH; gy += 40) svgEl("line", { class: "gridl", x1: P(0, gy, 0, level)[0], y1: P(0, gy, 0, level)[1], x2: P(W, gy, 0, level)[0], y2: P(W, gy, 0, level)[1] }, g);
    const [lx, ly] = P(0, DEPTH, 0, level);
    text(g, lx - 7, ly - 7, name, "lbl lvl", "end");
    if (sub) text(g, lx - 7, ly + 3, sub, "lbl lvl-sub", "end");
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
    const camGroups = {};

    /* linie „stosu” łączące narożniki płyt */
    {
      const g = svgEl("g", { class: "stack" }, S);
      [[0, 0], [W, 0], [W, DEPTH], [0, DEPTH]].forEach(([x, y]) => {
        const a = P(x, y, 0, 0), b = P(x, y, 0, 2);
        svgEl("line", { class: "stack-line", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
      });
    }

    /* ==================== POZIOM −500 ==================== */
    {
      const L = 2, g = svgEl("g", { class: "lvl-group lvl-2" }, S);
      slab(g, L, "POZIOM −500 m", "POKŁAD 510");
      // przekop główny + obudowa + tory + powietrze
      box(g, L, 90, 86, 430, 12, 5, "corr", "PRZEKOP GŁÓWNY G-7", { pos: "aboveLeft" });
      arches(g, L, 90, 86, 520, 86, 12);
      rails(g, L, 90, 92, 520, 92);
      wline(g, L, "air", [[95, 89], [515, 89]], 7);
      box(g, L, 262, 66, 12, 20, 5, "corr"); arches(g, L, 262, 66, 262, 86, 12, 8);
      // rząpie + pompownia przy szybie
      box(g, L, 214, 100, 20, 12, 1, "water", "RZĄPIE", { pos: "left" });
      box(g, L, 238, 100, 20, 12, 8, "", "POMPOWNIA GŁ.", { pos: "below" });
      // dojścia
      box(g, L, 140, 98, 12, 30, 5, "corr"); arches(g, L, 140, 98, 140, 128, 12, 8);
      box(g, L, 250, 98, 12, 30, 5, "corr"); arches(g, L, 250, 98, 250, 128, 12, 8);
      box(g, L, 408, 98, 12, 30, 5, "corr"); arches(g, L, 408, 98, 408, 128, 12, 8);
      // komory
      box(g, L, 118, 128, 56, 22, 12, "mag", "KOMORA MW", { pos: "below" });
      box(g, L, 174, 130, 14, 14, 8, "mag");
      box(g, L, 236, 128, 60, 22, 12, "", "STACJA ODMETANOWANIA", { pos: "below" });
      cyl(g, L, 252, 139, 5, 12, "tank"); cyl(g, L, 266, 139, 5, 12, "tank"); cyl(g, L, 280, 139, 5, 12, "tank");
      wline(g, L, "pipe", [[296, 139], [316, 139], [316, 102], [516, 102]], 9);
      text(g, P(462, 104, 0, L)[0], P(462, 104, 0, L)[1] + 10, "RUROCIĄG CH₄", "lbl sm", "start");
      box(g, L, 300, 100, 28, 14, 8, "", "LOKOMOTYWOWNIA", { pos: "below" });
      box(g, L, 396, 128, 44, 22, 12, "ref", "KOMORA RATUNKOWA KR-2", { pos: "below" });
      // przodek chodnika z kombajnem chodnikowym
      box(g, L, 340, 40, 12, 46, 5, "corr"); arches(g, L, 340, 40, 340, 86, 12, 8);
      drawBox(g, (a, b, c) => P(a, b, c, L), 342, 42, 8, 12, 5, "machine");
      text(g, P(338, 44, 5, L)[0] - 4, P(338, 44, 5, L)[1] + 3, "PRZODEK B-3", "lbl sm", "end");
      // ściana W-7: zroby, front z sekcjami, kombajn, chodniki przyścianowe
      box(g, L, 405, 30, 100, 56, 6, "lw");
      box(g, L, 405, 30, 100, 56, 6, "lw goaf", null, { hatch: true });
      text(g, P(455, 58, 6, L)[0], P(455, 58, 6, L)[1] + 3, "ŚCIANA W-7 · 210 m", "lbl");
      supports(g, L, 401, 31, 86);
      const sh2 = drawBox(g, (a, b, c) => P(a, b, c, L), 392, 36, 8, 12, 5, "machine shearer");
      sh2.setAttribute("class", "bx machine shearer");
      box(g, L, 395, 22, 110, 8, 5, "corr", "CHODNIK NADŚCIANOWY W-7", { pos: "aboveRight" });
      box(g, L, 383, 22, 10, 64, 5, "corr"); arches(g, L, 383, 22, 383, 86, 10, 8);
      wline(g, L, "belt", [[388, 84], [388, 92], [332, 92]], 7);
      // tamy wentylacyjne
      [[470, 86], [200, 86]].forEach(([x, y]) => { const a = P(x, y, 0, L), b = P(x, y + 12, 8, L); svgEl("line", { class: "vdoor", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g); });
      people(g, L, 100, 500, 90, 4, "38s");
      camGroups[2] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* ==================== POCHYLNIA TAŚMOWA ==================== */
    {
      const g = svgEl("g", { class: "lvl-group lvl-1 lvl-2 drift-group" }, S);
      svgEl("polygon", { class: "drift", points: pts([P(330, 86, 0, 1), P(330, 98, 0, 1), P(292, 98, 0, 2), P(292, 86, 0, 2)]) }, g);
      for (let t = 0.1; t < 1; t += 0.12) {
        const x = 330 - 38 * t, l = 1 + t;
        const a = P(x, 86, 5, l), b = P(x, 98, 5, l);
        svgEl("line", { class: "arch", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
      }
      const a = P(330, 92, 6, 1), b = P(292, 92, 6, 2);
      svgEl("line", { class: "belt", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
      const m = P(311, 92, 10, 1.5);
      text(g, m[0] + 30, m[1] + 3, "POCHYLNIA TAŚMOWA P-2 · 18°", "lbl sm", "start");
    }

    /* ==================== POZIOM −300 ==================== */
    {
      const L = 1, g = svgEl("g", { class: "lvl-group lvl-1" }, S);
      slab(g, L, "POZIOM −300 m", "POKŁAD 405/1");
      box(g, L, 60, 86, 420, 12, 5, "corr");
      text(g, P(200, 98, 0, L)[0], P(200, 98, 0, L)[1] + 9, "PRZEKOP GŁÓWNY G-3", "lbl sm", "start");
      arches(g, L, 60, 86, 480, 86, 12);
      rails(g, L, 60, 92, 480, 92);
      wline(g, L, "air", [[65, 89], [475, 89]], 7);
      box(g, L, 262, 66, 12, 20, 5, "corr"); arches(g, L, 262, 66, 262, 86, 12, 8);
      box(g, L, 238, 100, 20, 12, 8, "", "POMPOWNIA", { pos: "left" });
      // ściana L-12: zroby na zachód, front przy x=160
      box(g, L, 60, 30, 100, 56, 6, "lw");
      box(g, L, 60, 30, 100, 56, 6, "lw goaf", null, { hatch: true });
      text(g, P(110, 58, 6, L)[0], P(110, 58, 6, L)[1] + 3, "ŚCIANA L-12 · 180 m", "lbl");
      supports(g, L, 160, 31, 86);
      const sh1 = drawBox(g, (a, b, c) => P(a, b, c, L), 165, 36, 8, 12, 5, "machine shearer");
      sh1.setAttribute("class", "bx machine shearer");
      box(g, L, 60, 22, 118, 8, 5, "corr", "CHODNIK NADŚCIANOWY L-12", { pos: "aboveLeft" });
      box(g, L, 176, 22, 10, 64, 5, "corr"); arches(g, L, 176, 22, 176, 86, 10, 8);
      wline(g, L, "belt", [[181, 84], [181, 92], [300, 92]], 7);
      // rozdzielnia 6 kV + dojście
      box(g, L, 350, 58, 34, 16, 9, "", "ROZDZIELNIA 6 kV", { pos: "above" });
      box(g, L, 362, 74, 10, 12, 5, "corr");
      // stacje
      box(g, L, 300, 98, 40, 14, 8, "", "STACJA ZAŁADOWCZA", { pos: "below" });
      box(g, L, 424, 98, 36, 14, 8, "", "ŁADOWNIA AKUMULATORÓW", { pos: "below" });
      box(g, L, 482, 60, 12, 26, 5, "corr"); arches(g, L, 482, 60, 482, 86, 12, 8);
      [[470, 86], [120, 86]].forEach(([x, y]) => { const a = P(x, y, 0, L), b = P(x, y + 12, 8, L); svgEl("line", { class: "vdoor", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g); });
      // lokomotywa akumulatorowa z wozami
      mover(g, "train", [[440, 92, L, 5], [200, 92, L, 5], [440, 92, L, 5]], "26s", (m) => {
        drawBox(m, Pl, -6, -3, 12, 6, 5, "loco");
        drawBox(m, Pl, -22, -3, 12, 6, 4, "wagon");
        drawBox(m, Pl, -38, -3, 12, 6, 4, "wagon");
      });
      people(g, L, 70, 470, 90, 4, "34s");
      camGroups[1] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* ==================== POWIERZCHNIA ==================== */
    {
      const L = 0, g = svgEl("g", { class: "lvl-group lvl-0" }, S);
      slab(g, L, "POWIERZCHNIA", "+262 m n.p.m.");
      svgEl("polygon", { class: "fence", points: pts([P(6, 6, 2), P(W - 6, 6, 2), P(W - 6, DEPTH - 6, 2), P(6, DEPTH - 6, 2)]) }, g);
      // maszty oświetleniowe
      [[6, 6], [W - 6, 6], [W - 6, DEPTH - 6], [6, DEPTH - 6], [150, 150], [300, 150], [420, 6]].forEach(([x, y]) => {
        const a = P(x, y, 0), b = P(x, y, 22);
        svgEl("line", { class: "mast-l", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
        svgEl("circle", { class: "lamp", cx: b[0], cy: b[1], r: 1.6 }, g);
      });
      // drogi
      svgEl("polygon", { class: "road", points: pts([P(0, 150), P(300, 150), P(300, 162), P(0, 162)]) }, g);
      svgEl("polygon", { class: "road", points: pts([P(290, 40), P(302, 40), P(302, 162), P(290, 162)]) }, g);
      svgEl("polygon", { class: "road", points: pts([P(302, 96), P(330, 96), P(330, 104), P(302, 104)]) }, g);
      svgEl("polygon", { class: "road", points: pts([P(40, 96), P(290, 96), P(290, 104), P(40, 104)]) }, g);
      wline(g, L, "lane", [[4, 156], [296, 156], [296, 44]], 0.5);
      // parking
      svgEl("polygon", { class: "lot", points: pts([P(50, 166), P(130, 166), P(130, 190), P(50, 190)]) }, g);
      [56, 68, 80, 92, 110, 122].forEach((x, i) => drawBox(g, (a, b, c) => P(a, b, c), x, 172, 8, 5, 3, `car c${i % 3}`));
      text(g, P(90, 192)[0], P(90, 192)[1] + 8, "PARKING", "lbl sm");
      // tory + wagony
      const r1 = P(330, 190), r2 = P(516, 190);
      svgEl("line", { class: "rail", x1: r1[0], y1: r1[1], x2: r2[0], y2: r2[1] }, g);
      [338, 354, 370, 386].forEach((x) => drawBox(g, (a, b, c) => P(a, b, c), x, 187, 13, 6, 5, "wagon"));
      // budynki – tył → przód
      box(g, L, 30, 16, 70, 28, 18, "", "ADMINISTRACJA", { pos: "top" });
      box(g, L, 115, 16, 60, 28, 12, "", "WARSZTAT MECH.", { pos: "top" });
      box(g, L, 190, 16, 28, 22, 12, "", "KOTŁOWNIA", { pos: "below" });
      cyl(g, L, 224, 22, 4, 46, "chimney");
      box(g, L, 160, 60, 40, 24, 8, "", "ROZDZ. 110/6 kV", { pos: "top", cls: "lbl sm" });
      [166, 178, 190].forEach((x) => drawBox(g, (a, b, c) => P(a, b, c), x, 66, 8, 8, 6, "trafo"));
      box(g, L, 330, 30, 110, 60, 36, "plant", "ZAKŁAD PRZERÓBCZY", { pos: "top" });
      cyl(g, L, 345, 44, 8, 50, "silo", "SILOSY", "above"); cyl(g, L, 365, 44, 8, 50, "silo");
      headframe(g, L, 255, 40, 26, 26, 64);
      text(g, P(268, 53, 64)[0], P(268, 53, 64)[1] - 26, "SZYB I „PIAST” · 612 m", "lbl");
      box(g, L, 285, 40, 34, 18, 14, "", "MASZYNA WYCIĄGOWA", { pos: "below" });
      // most przenośnikowy nadszybie → zakład przeróbczy
      svgEl("polygon", { class: "bridge", points: pts([P(281, 50, 30), P(330, 58, 24), P(330, 58, 18), P(281, 50, 24)]) }, g);
      // szyb II
      box(g, L, 480, 60, 14, 14, 8, "", "SZYB II (WENT.)", { pos: "below" });
      const [w2x, w2y] = P(487, 67, 8); svgEl("circle", { class: "wheel", cx: w2x, cy: w2y - 4, r: 3.5 }, g);
      // osadniki i zbiorniki
      cyl(g, L, 350, 112, 13, 5, "thick", "OSADNIKI"); cyl(g, L, 385, 112, 13, 5, "thick");
      cyl(g, L, 206, 118, 6, 14, "tank"); cyl(g, L, 222, 118, 6, 14, "tank");
      text(g, P(200, 118, 14)[0] - 4, P(200, 118, 14)[1] + 3, "ZBIORNIKI WODY", "lbl sm", "end");
      box(g, L, 430, 106, 30, 18, 8, "", "STACJA TRAFO", { pos: "right" });
      box(g, L, 70, 112, 110, 36, 16, "", "LAMPOWNIA · ŁAŹNIA · CECHOWNIA", { pos: "top" });
      box(g, L, 8, 168, 30, 20, 10, "", "BRAMA GŁÓWNA", { pos: "below" });
      // szlaban
      const s1 = P(38, 150, 6), s2 = P(38, 162, 6); svgEl("line", { class: "barrier", x1: s1[0], y1: s1[1], x2: s2[0], y2: s2[1] }, g);
      // hałdy
      [[350, 172, 34, 16], [392, 174, 40, 18], [444, 172, 30, 15]].forEach(([px, py, pw, ph]) => {
        svgEl("polygon", { class: "pile", points: pts([P(px, py + 12), P(px + pw, py + 12), P(px + pw / 2, py + 4, ph)]) }, g);
      });
      text(g, P(392, 200)[0], P(392, 200)[1] + 8, "SKŁADOWISKO · ZAŁADUNEK KOLEJOWY", "lbl sm");
      box(g, L, 448, 148, 34, 30, 14, "", "STACJA WENTYLATORÓW", { pos: "right" });
      cyl(g, L, 468, 142, 7, 20, "diffuser");
      const [fx, fy] = P(465, 163, 14);
      const fan = svgEl("g", { class: "fan" }, g);
      svgEl("circle", { cx: fx, cy: fy, r: 7 }, fan);
      svgEl("line", { x1: fx - 7, y1: fy, x2: fx + 7, y2: fy }, fan);
      svgEl("line", { x1: fx, y1: fy - 7, x2: fx, y2: fy + 7 }, fan);
      // róża wiatrów + skala
      const [nx, ny] = P(W - 30, 30, 0);
      const rose = svgEl("g", { class: "compass" }, g);
      svgEl("line", { x1: nx, y1: ny + 8, x2: nx, y2: ny - 8 }, rose);
      svgEl("polygon", { points: `${nx - 3},${ny - 4} ${nx},${ny - 10} ${nx + 3},${ny - 4}` }, rose);
      text(rose, nx, ny - 13, "N", "lbl sm");
      const sa = P(430, 8, 0), sb = P(480, 8, 0);
      svgEl("line", { class: "scale", x1: sa[0], y1: sa[1], x2: sb[0], y2: sb[1] }, g);
      text(g, (sa[0] + sb[0]) / 2, sa[1] - 3, "50 m", "lbl sm");
      camGroups[0] = svgEl("g", { class: "cam-layer" }, g);
    }

    /* ==================== SZYBY ==================== */
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
      // klatka jadąca w szybie I
      mover(g, "cage", [[262, 47, 0, 0], [262, 47, 2, 0], [262, 47, 0, 0]], "18s", (m) => drawBox(m, Pl, 0, 0, 12, 12, 8, "cage"));
    }

    /* ==================== czujniki metanu ==================== */
    const sg = svgEl("g", { id: "ch4-sensors" }, S);
    D.sensors.forEach((s) => {
      const [x, y] = P(s.x, s.y, 0, s.level);
      text(sg, x, y, "CH₄ —", "sensor", "start").dataset.sensor = s.id;
    });

    /* ==================== kamery ==================== */
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
  const SCENE = { x: 0, y: 0, w: 680, h: 480 };
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
    state.focusLevel = b.dataset.level;
    els.twinSide.querySelectorAll(".lvl-btn").forEach((x) => x.classList.toggle("active", x === b));
    els.svg.classList.remove("focus-0", "focus-1", "focus-2");
    if (state.focusLevel !== "all") {
      els.svg.classList.add(`focus-${state.focusLevel}`);
      const grp = els.svg.querySelector(`.lvl-group.lvl-${state.focusLevel}:not(.drift-group)`);
      if (grp) fitBox(grp.getBBox(), state.focusLevel === "0" ? 6 : 10);
    } else { Object.assign(view, VIEW0); applyView(); }
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

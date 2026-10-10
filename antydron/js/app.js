/* ==========================================================================
   SPEKTRE AIR · aplikacja demonstracyjna systemu antydronowego
   Asystent operatora (lewo) · Obraz sytuacyjny / profil / inteligencja
   (prawy górny) · Tor EO/IR z fuzją sensorów (prawy dolny).
   Bez kroku budowania, bez zależności – czysty HTML / CSS / JS.
   ========================================================================== */
(function () {
  "use strict";

  const D = window.AIR_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const fmtM = (u) => (u * D.M >= 1000 ? (u * D.M / 1000).toFixed(2).replace(".", ",") + " km" : Math.round(u * D.M) + " m");
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------------------------
     Stan
     ------------------------------------------------------------------ */
  const state = {
    site: "belchatow",
    selectedSensor: null,
    incidentCursor: 0,
    active: null,
    closed: [],
    auto: false,
    autoTimer: null,
    pendingOptions: null,
    audioCtx: null,
    seq: 0,
    view: "map",
    tracks: [],
    scnT0: 0,
    roeArmed: false,
    threat: "ZIELONY",
    history: null,
    zoom: null,
    primary: null,
    firedEvents: new Set(),
  };

  const els = {
    log: $("#term-log"), roeBox: $("#roe-box"),
    btnAuto: $("#btn-auto"), eventCtl: $("#event-ctl"), siteSel: $("#site-sel"), siteName: $("#site-name"),
    scene: $("#scene"), svg: $("#air-svg"), tooltip: $("#twin-tooltip"), viewCtl: $("#view-ctl"),
    prof: $("#prof-svg"), intel: $("#view-intel"),
    video: $("#feed-video"), noise: $("#feed-noise"), overlay: $("#feed-overlay"),
    feedMain: document.querySelector(".feed-main"), feedStatus: $("#feed-status"),
    feedCamId: $("#feed-cam-id"), osdCam: $("#osd-cam"), osdZone: $("#osd-zone"), osdTime: $("#osd-time"), osdTrk: $("#osd-trk"),
    nosigSub: $("#nosig-sub"), detections: $("#feed-detections"), events: $("#feed-events"),
    fuse: $("#fuse-list"), trkMeta: $("#trk-meta"), spec: $("#rf-spec"),
    kpiSensors: $("#kpi-sensors"), kpiTracks: $("#kpi-tracks"), kpiAlerts: $("#kpi-alerts"),
    kpiThreat: $("#kpi-threat"), kpiThreatBox: $("#kpi-threat-box"), roeState: $("#roe-state"),
    clockDate: $("#clock-date"), clockTime: $("#clock-time"),
  };

  const site = () => D.sites[state.site];
  const sensorById = (id) => site().sensors.find((s) => s.id === id) ||
    Object.values(D.sites).reduce((a, s) => a || s.sensors.find((x) => x.id === id), null);

  /* ==================================================================
     ASYSTENT · kolejka wiadomości i przyciski decyzji
     ================================================================== */
  const queue = [];
  let draining = false;
  function scrollLog() { els.log.scrollTop = els.log.scrollHeight; }

  function renderMessage({ kind, from, html, options, multi }) {
    const el = document.createElement("div");
    el.className = `msg ${kind}`;
    el.innerHTML = `<div class="hdr"><span class="from">${esc(from)}</span><span class="t">${now()}</span></div><div class="body">${html}</div>`;
    if (options && options.length) {
      const wrap = document.createElement("div");
      wrap.className = "opts" + (multi ? " multi" : "");
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
      if (state.pendingOptions && state.pendingOptions.el !== wrap && !state.pendingOptions.el.classList.contains("multi")) state.pendingOptions.el.classList.add("used");
      state.pendingOptions = { el: wrap, options };
    }
    els.log.appendChild(el);
    scrollLog();
    return el;
  }

  function say(kind, from, html, opts = {}) {
    return new Promise((resolve) => {
      queue.push({ kind, from, html, options: opts.options, multi: opts.multi, delay: opts.delay ?? (kind === "ai" ? 520 : 220), resolve });
      drain();
    });
  }
  const sys = (html, o) => say("sys", "SYSTEM", html, o);
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
    if (wrap.classList.contains("multi")) {
      if (wrap.children[i].classList.contains("chosen")) return;
      wrap.children[i].classList.add("chosen");
    } else {
      wrap.classList.add("used");
      wrap.children[i].classList.add("chosen");
      if (state.pendingOptions && state.pendingOptions.el === wrap) state.pendingOptions = null;
    }
    op(o.label);
    o.action && o.action();
  }

  els.btnAuto.addEventListener("click", () => toggleAuto());

  /* ---------- przyciski scenariuszy ---------- */
  function renderEventButtons() {
    els.eventCtl.innerHTML = "";
    D.incidents.forEach((inc, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ev-btn"; b.dataset.i = i;
      b.textContent = String(i + 1);
      b.title = `${inc.id} · ${inc.title} (${D.sites[inc.site].short})`;
      b.addEventListener("click", () => fireIncident(i));
      els.eventCtl.appendChild(b);
    });
    refreshEventButtons();
  }
  function refreshEventButtons() {
    els.eventCtl.querySelectorAll(".ev-btn").forEach((b) => {
      const inc = D.incidents[+b.dataset.i];
      const active = state.active && state.active.inc === inc && state.active.status !== "closed";
      b.classList.toggle("active", !!active);
      b.classList.toggle("alarm", !!active && state.active.status === "new");
      b.classList.toggle("done", !active && state.closed.some((r) => r.inc === inc));
    });
  }

  /* ---------- przełącznik obiektów ---------- */
  function renderSiteButtons() {
    els.siteSel.innerHTML = "";
    Object.values(D.sites).forEach((s) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "site-btn" + (s.id === state.site ? " active" : "");
      b.dataset.site = s.id;
      b.innerHTML = `${esc(s.short)}<span class="sub">${esc(s.sub)}</span>`;
      b.addEventListener("click", () => switchSite(s.id, true));
      els.siteSel.appendChild(b);
    });
    els.siteName.textContent = `${site().name} · ${site().desc}`;
  }

  function switchSite(id, byUser) {
    if (state.site === id) return;
    if (byUser && state.active && state.active.status !== "closed") abortActive();
    state.site = id;
    state.selectedSensor = null;
    state.intelCard = null;
    clearTracks();
    clearFx();
    renderSiteButtons();
    renderScene();
    resetView();
    renderIntel();
    renderProfile();
    setFeedIdle();
    updateKpis();
    if (byUser) sys(`Obiekt: <span class="b">${esc(site().name)}</span> · ${esc(site().operator)}. ${esc(site().airspaceNote)}`);
  }

  /* ==================================================================
     OBRAZ SYTUACYJNY (SVG)
     ================================================================== */
  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls = "obj-lbl", anchor = "middle") {
    const t = svgEl("text", { x: (+x).toFixed(1), y: (+y).toFixed(1), class: cls, "text-anchor": anchor }, parent);
    t.textContent = str;
    return t;
  }
  const ptsStr = (arr) => arr.map((p) => `${(+p[0]).toFixed(1)},${(+p[1]).toFixed(1)}`).join(" ");

  function wedgePath(x, y, r, dirDeg, halfDeg) {
    const a0 = (dirDeg - halfDeg) * Math.PI / 180, a1 = (dirDeg + halfDeg) * Math.PI / 180;
    const x0 = x + r * Math.cos(a0), y0 = y + r * Math.sin(a0);
    const x1 = x + r * Math.cos(a1), y1 = y + r * Math.sin(a1);
    return `M${x.toFixed(1)} ${y.toFixed(1)} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  }

  const layers = {};

  function renderScene() {
    const S = site();
    els.scene.innerHTML = "";
    const root = els.scene;

    /* siatka */
    const g0 = svgEl("g", { class: "grid" }, root);
    for (let x = 0; x <= 1000; x += 50) svgEl("line", { class: "grid-l", x1: x, y1: 0, x2: x, y2: 620 }, g0);
    for (let y = 0; y <= 620; y += 50) svgEl("line", { class: "grid-l", x1: 0, y1: y, x2: 1000, y2: y }, g0);

    /* obiekty terenu */
    const gGeo = svgEl("g", { class: "geo" }, root);
    (S.geo || []).forEach((o) => drawGeo(gGeo, o));

    /* strefy: pierścienie + namiary */
    const gz = svgEl("g", { class: "zones" }, root);
    const [cx, cy] = S.center;
    (S.rings || []).forEach((r, i) => {
      svgEl("circle", { class: `ring ${r.cls}`, cx, cy, r: r.r }, gz);
      const la = [250, 236, 222, 208][i % 4] * Math.PI / 180, off = r.r < 90 ? r.r + 54 : r.r + 5;
      text(gz, cx + off * Math.cos(la), cy + off * Math.sin(la), r.label, "ring-lbl", "end");
    });
    for (let a = 0; a < 360; a += 30) {
      const rad = a * Math.PI / 180, r0 = 40, r1 = (S.rings[S.rings.length - 1].r) + 6;
      svgEl("line", { class: "bearing", x1: cx + r0 * Math.cos(rad), y1: cy + r0 * Math.sin(rad), x2: cx + r1 * Math.cos(rad), y2: cy + r1 * Math.sin(rad) }, gz);
      const lb = ((a + 90) % 360);
      text(gz, cx + (r1 + 10) * Math.cos(rad), cy + (r1 + 10) * Math.sin(rad) + 2, String(lb).padStart(3, "0") + "°", "bearing-lbl");
    }
    if (S.nfz) {
      svgEl("polygon", { class: "nfz", points: ptsStr(S.nfz.pts) }, gz);
      text(gz, S.nfz.pts[0][0] + 6, S.nfz.pts[0][1] - 6, S.nfz.label, "nfz-lbl", "start");
    }

    /* warstwy dynamiczne */
    layers.fx = svgEl("g", { class: "fx-layer" }, root);
    layers.sns = svgEl("g", { class: "sns-layer" }, root);
    layers.trk = svgEl("g", { class: "trk-layer" }, root);

    /* sensory i efektory */
    S.sensors.forEach((s) => drawSensor(layers.sns, s));
  }

  function drawGeo(g, o) {
    switch (o.t) {
      case "rect": {
        svgEl("rect", { class: o.cls, x: o.x, y: o.y, width: o.w, height: o.h, rx: 1 }, g);
        if (o.label) text(g, o.x + o.w / 2, o.h >= 20 ? o.y + o.h / 2 + 3 : o.y - 3, o.label, "obj-lbl");
        break;
      }
      case "circle": {
        svgEl("circle", { class: o.cls, cx: o.cx, cy: o.cy, r: o.r }, g);
        if (o.label) text(g, o.cx, o.cy + o.r + 10, o.label, "obj-lbl");
        break;
      }
      case "poly": svgEl("polygon", { class: o.cls, points: ptsStr(o.pts) }, g); break;
      case "line": svgEl("polyline", { class: o.cls, points: ptsStr(o.pts), fill: "none" }, g); break;
      case "asset": {
        svgEl("rect", { class: "asset", x: o.x, y: o.y, width: o.w, height: o.h, rx: 2 }, g);
        if (o.label) text(g, o.x + o.w / 2, o.y + o.h + 12, o.label, "asset-lbl");
        break;
      }
      case "text": text(g, o.x, o.y, o.label, "obj-lbl", "start"); break;
      case "wtg": {
        const w = svgEl("g", { class: "wtg", "data-id": o.id }, g);
        svgEl("circle", { class: "mast", cx: o.cx, cy: o.cy, r: o.r }, w);
        const bl = svgEl("g", { class: "blade" }, w);
        for (let i = 0; i < 3; i++) {
          const a = (i * 120) * Math.PI / 180;
          svgEl("line", { x1: o.cx, y1: o.cy, x2: o.cx + o.r * 2.1 * Math.cos(a), y2: o.cy + o.r * 2.1 * Math.sin(a) }, bl);
        }
        const spin = site().wtgSpin || 0;
        if (spin) svgEl("animateTransform", { attributeName: "transform", type: "rotate", from: `0 ${o.cx} ${o.cy}`, to: `360 ${o.cx} ${o.cy}`, dur: (spin + (o.cx % 7)) + "s", repeatCount: "indefinite" }, bl);
        text(w, o.cx, o.cy - o.r - 3, o.id, "id");
        break;
      }
      case "vessel": {
        const v = svgEl("g", { class: `vessel ${o.cls}`, "data-id": o.id }, g);
        const a = (o.dir || 0) * Math.PI / 180, L = 9, W = 3.4;
        const nose = [o.cx + L * Math.cos(a), o.cy + L * Math.sin(a)];
        const p1 = [o.cx - L * 0.6 * Math.cos(a) + W * Math.cos(a + 1.57), o.cy - L * 0.6 * Math.sin(a) + W * Math.sin(a + 1.57)];
        const p2 = [o.cx - L * 0.6 * Math.cos(a) - W * Math.cos(a + 1.57), o.cy - L * 0.6 * Math.sin(a) - W * Math.sin(a + 1.57)];
        svgEl("polygon", { points: ptsStr([nose, p1, p2]) }, v);
        if (o.label) text(v, o.cx, o.cy + 14, o.label, "vessel-lbl");
        break;
      }
    }
  }

  const SNS_ICON = { radar: "RAD", rf: "RF", eoir: "EO/IR", aku: "AKU", ais: "AIS", adsb: "ADS-B", sat: "SAT", jam: "ZAKŁ", spoof: "PRZEJ", inter: "PRZECH" };
  const EFF = { jam: 1, spoof: 1, inter: 1 };

  function drawSensor(parent, s) {
    const g = svgEl("g", {
      class: `sns ${EFF[s.kind] ? "eff" : ""} ${s.offline ? "off" : ""}`,
      "data-id": s.id, tabindex: 0, role: "button",
    }, parent);
    if (s.kind === "radar" && s.range) {
      svgEl("circle", { class: "cov", cx: s.x, cy: s.y, r: s.range }, g);
      const wrap = svgEl("g", {}, g);
      const p = svgEl("path", { class: "sweep", d: wedgePath(s.x, s.y, s.range, -13, 13) }, wrap);
      svgEl("animateTransform", { attributeName: "transform", type: "rotate", from: `0 ${s.x} ${s.y}`, to: `360 ${s.x} ${s.y}`, dur: "5s", repeatCount: "indefinite" }, p);
    }
    if (s.kind === "rf" && s.range) svgEl("circle", { class: "cov rf", cx: s.x, cy: s.y, r: s.range * 0.42 }, g);
    if (s.kind === "aku" && s.range) svgEl("circle", { class: "cov aku", cx: s.x, cy: s.y, r: s.range }, g);
    if (s.kind === "ais" && s.range) svgEl("circle", { class: "cov rf", cx: s.x, cy: s.y, r: s.range * 0.5 }, g);
    if (s.kind === "eoir") {
      const w = svgEl("path", { class: "cov eoir", d: wedgePath(s.x, s.y, s.range || 200, 0, (s.fov || 16) / 2) }, g);
      w.style.transformOrigin = `${s.x}px ${s.y}px`;
      w.style.transform = `rotate(${s.dir || 0}deg)`;
      g._fov = w;
    }
    svgEl("circle", { class: "ring2", cx: s.x, cy: s.y, r: 5 }, g);
    svgEl("circle", { class: "core", cx: s.x, cy: s.y, r: 2.4 }, g);
    svgEl("circle", { class: "hit", cx: s.x, cy: s.y, r: 11 }, g);
    text(g, s.x + 8, s.y + 2.6, `${s.id}`, "id", "start");
    g.addEventListener("click", () => selectSensor(s.id));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSensor(s.id); } });
    g.addEventListener("mouseenter", (e) => showTooltip(s, e));
    g.addEventListener("mousemove", moveTooltip);
    g.addEventListener("mouseleave", hideTooltip);
    return g;
  }

  const snsNode = (id) => els.svg.querySelector(`.sns[data-id="${id}"]`);
  function setSensorState(id, cls) {
    const n = snsNode(id); if (!n) return;
    n.classList.remove("hot", "sel");
    if (cls) n.classList.add(cls);
  }
  /** Obrót pola widzenia głowicy EO/IR w stronę punktu (x, y). */
  function aimSensor(id, x, y) {
    const n = snsNode(id), s = sensorById(id);
    if (!n || !n._fov || !s) return;
    const a = Math.atan2(y - s.y, x - s.x) * 180 / Math.PI;
    n._fov.style.transform = `rotate(${a.toFixed(1)}deg)`;
  }

  function showTooltip(s, e) {
    els.tooltip.innerHTML = `<div class="t">${esc(s.id)} · ${esc(s.name)}</div><div class="s">${esc(s.zone)}</div><div class="st">${esc(s.type)}${s.offline ? " · <span style=\"color:#7f93a4\">OFFLINE</span>" : ""}${s.range ? " · zasięg " + fmtM(s.range) : ""}</div>`;
    els.tooltip.hidden = false; moveTooltip(e);
  }
  function moveTooltip(e) {
    const r = els.svg.parentElement.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    els.tooltip.style.left = Math.min(x, r.width - 230) + "px";
    els.tooltip.style.top = Math.min(y, r.height - 60) + "px";
  }
  function hideTooltip() { els.tooltip.hidden = true; }

  /* ---------- zoom / pan ---------- */
  const VIEW0 = { x: 0, y: 0, w: 1000, h: 620 };
  const view = { ...VIEW0 };
  function applyView() { els.svg.setAttribute("viewBox", `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`); }
  function resetView() { Object.assign(view, VIEW0); syncAspect(); fitTo(site().center[0], site().center[1], site().homeW || 820); }
  function syncAspect() {
    const r = els.svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aspect = r.width / r.height;
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    if (view.w / view.h > aspect) { view.h = view.w / aspect; } else { view.w = view.h * aspect; }
    view.x = cx - view.w / 2; view.y = cy - view.h / 2;
    applyView();
  }
  function svgPoint(e) { const pt = els.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(els.svg.getScreenCTM().inverse()); }
  function zoomAt(px, py, f) {
    const w = clamp(view.w * f, 120, VIEW0.w * 1.4), h = w * view.h / view.w;
    view.x = px - (px - view.x) * (w / view.w);
    view.y = py - (py - view.y) * (h / view.h);
    view.w = w; view.h = h; applyView();
  }
  function fitTo(cx, cy, w) {
    const h = w * view.h / view.w;
    view.x = cx - w / 2; view.y = cy - h / 2; view.w = w; view.h = h; applyView();
  }
  els.svg.addEventListener("wheel", (e) => { e.preventDefault(); const p = svgPoint(e); zoomAt(p.x, p.y, e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  let drag = null;
  els.svg.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; els.svg.classList.add("dragging"); els.svg.setPointerCapture(e.pointerId); });
  els.svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = els.svg.getBoundingClientRect();
    view.x = drag.vx - (e.clientX - drag.x) * view.w / r.width;
    view.y = drag.vy - (e.clientY - drag.y) * view.h / r.height;
    applyView();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => els.svg.addEventListener(ev, () => { drag = null; els.svg.classList.remove("dragging"); }));
  $("#btn-zin").addEventListener("click", () => zoomAt(view.x + view.w / 2, view.y + view.h / 2, 0.8));
  $("#btn-zout").addEventListener("click", () => zoomAt(view.x + view.w / 2, view.y + view.h / 2, 1.25));
  $("#btn-zreset").addEventListener("click", () => resetView());
  window.addEventListener("resize", () => { syncAspect(); drawSpectrum(true); });

  /* ---------- przełącznik widoków panelu ---------- */
  els.viewCtl.addEventListener("click", (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    setPanelView(b.dataset.view);
  });
  function setPanelView(v) {
    state.view = v;
    els.viewCtl.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    ["map", "prof", "intel"].forEach((k) => $("#view-" + k).classList.toggle("on", k === v));
    if (v === "map") syncAspect();
    if (v === "intel") renderIntel();
    if (v === "prof") renderProfile();
  }

  /* ==================================================================
     ŚLADY POWIETRZNE · ruch celów w czasie, fuzja na mapie
     ================================================================== */
  const ALT_K = 0.12;          /* jednostek planu na metr wysokości (rzut 2,5D) */
  const scnTime = () => (performance.now() - state.scnT0) / 1000;

  function clearTracks() {
    state.tracks.forEach((t) => t.node && t.node.remove());
    state.tracks = [];
    state.primary = null;
    state.firedEvents = new Set();
  }

  function makeTrackNode(t) {
    const g = svgEl("g", { class: `trk ${t.cls}`, "data-id": t.id }, layers.trk);
    t.elPred = svgEl("polyline", { class: "pred", points: "" }, g);
    t.elTrail = svgEl("polyline", { class: "trail", points: "" }, g);
    t.elLead = svgEl("line", { class: "lead", x1: 0, y1: 0, x2: 0, y2: 0 }, g);
    t.elShadow = svgEl("ellipse", { class: "shadow", cx: 0, cy: 0, rx: 2.6, ry: 1.2 }, g);
    t.elHalo = svgEl("circle", { class: "halo", cx: 0, cy: 0, r: 4 }, g);
    t.elIcon = svgEl("polygon", { class: "icon", points: "" }, g);
    t.elLbl = svgEl("text", { class: "lbl", x: 0, y: 0, "text-anchor": "start" }, g);
    t.elLbl2 = svgEl("text", { class: "lbl2", x: 0, y: 0, "text-anchor": "start" }, g);
    return g;
  }

  function startTracks(inc) {
    clearTracks();
    state.scnT0 = performance.now();
    (inc.tracks || []).forEach((def) => {
      const t = Object.assign({}, def, { mode: "path", trail: [], last: null, home: def.wps[0] });
      t.node = makeTrackNode(t);
      state.tracks.push(t);
    });
    state.primary = state.tracks.find((t) => t.cls === "hostile") || state.tracks[0] || null;
  }

  function interp(wps, t) {
    if (t <= wps[0][0]) return { x: wps[0][1], y: wps[0][2], alt: wps[0][3], done: false };
    for (let i = 1; i < wps.length; i++) {
      if (t <= wps[i][0]) {
        const a = wps[i - 1], b = wps[i];
        const k = (t - a[0]) / Math.max(0.001, b[0] - a[0]);
        return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, alt: a[3] + (b[3] - a[3]) * k, done: false };
      }
    }
    const l = wps[wps.length - 1];
    return { x: l[1], y: l[2], alt: l[3], done: true };
  }

  function trackPosition(t, time, dt) {
    if (t.mode === "landed") return t.last;
    if (t.mode === "hold") return t.last;
    if (t.mode === "path") {
      const p = interp(t.wps, time);
      if (p.done && t.orbit) {
        const o = t.orbit, last = t.wps[t.wps.length - 1];
        if (t.orbA0 === undefined) { t.orbA0 = Math.atan2(last[2] - o.cy, last[1] - o.cx); t.orbT0 = t.wps[t.wps.length - 1][0]; }
        const a = t.orbA0 + 2 * Math.PI * (time - t.orbT0) / o.period;
        return { x: o.cx + o.r * Math.cos(a), y: o.cy + o.r * Math.sin(a), alt: o.alt };
      }
      return p;
    }
    const cur = t.last || { x: t.wps[0][1], y: t.wps[0][2], alt: t.wps[0][3] };
    if (t.mode === "rth") {
      const tx = t.home[1], ty = t.home[2];
      const d = dist(cur.x, cur.y, tx, ty), step = 1.6 * dt;
      if (d < 1.5) { t.mode = "land"; return cur; }
      return { x: cur.x + (tx - cur.x) / d * step, y: cur.y + (ty - cur.y) / d * step, alt: Math.max(12, cur.alt - 2 * dt) };
    }
    if (t.mode === "land" || t.mode === "captured") {
      const v = t.mode === "captured" ? 22 : 9;
      const alt = cur.alt - v * dt;
      if (alt <= 0) { t.mode = "landed"; onTrackLanded(t); return { x: cur.x, y: cur.y, alt: 0 }; }
      return { x: cur.x, y: cur.y, alt };
    }
    if (t.mode === "chase") {
      const tgt = t.chase && t.chase.last;
      if (!tgt) return cur;
      const d = dist(cur.x, cur.y, tgt.x, tgt.y), step = 3.4 * dt;
      if (d < 5) { onIntercept(t, t.chase); return cur; }
      return { x: cur.x + (tgt.x - cur.x) / d * step, y: cur.y + (tgt.y - cur.y) / d * step, alt: cur.alt + (tgt.alt - cur.alt) * clamp(dt * 0.8, 0, 1) };
    }
    return cur;
  }

  function drawTrack(t, p, dt) {
    const prev = t.last;
    if (prev && dt > 0) {
      const dxy = dist(p.x, p.y, prev.x, prev.y) * D.M / dt;
      t.spd = t.spd == null ? dxy : t.spd * 0.8 + dxy * 0.2;
      if (dxy > 0.2) t.crs = (Math.atan2(p.y - prev.y, p.x - prev.x) * 180 / Math.PI + 90 + 360) % 360;
    }
    const ix = p.x, iy = p.y - p.alt * ALT_K;
    if (!t.trail.length || dist(ix, iy, t.trail[t.trail.length - 1][0], t.trail[t.trail.length - 1][1]) > 1.5) {
      t.trail.push([ix, iy]);
      if (t.trail.length > 240) t.trail.shift();
      t.elTrail.setAttribute("points", ptsStr(t.trail));
    }
    /* przewidywana trasa – pozostałe punkty planu lotu */
    if (t.mode === "path") {
      const time = scnTime();
      const rest = t.wps.filter((w) => w[0] > time).map((w) => [w[1], w[2] - w[3] * ALT_K]);
      if (rest.length) t.elPred.setAttribute("points", ptsStr([[ix, iy], ...rest]));
      else t.elPred.setAttribute("points", "");
    } else t.elPred.setAttribute("points", "");

    t.elLead.setAttribute("x1", ix); t.elLead.setAttribute("y1", iy);
    t.elLead.setAttribute("x2", p.x); t.elLead.setAttribute("y2", p.y);
    t.elShadow.setAttribute("cx", p.x); t.elShadow.setAttribute("cy", p.y);
    t.elHalo.setAttribute("cx", ix); t.elHalo.setAttribute("cy", iy);
    const r = t.cls === "bird" ? 2 : 3.4;
    t.elIcon.setAttribute("points", ptsStr([[ix, iy - r], [ix + r, iy], [ix, iy + r], [ix - r, iy]]));
    t.elLbl.setAttribute("x", ix + 6); t.elLbl.setAttribute("y", iy - 1);
    t.elLbl2.setAttribute("x", ix + 6); t.elLbl2.setAttribute("y", iy + 6);
    t.elLbl.textContent = t.label;
    t.elLbl2.textContent = t.mode === "landed" ? "ŚLAD ZAKOŃCZONY" :
      `${Math.round(p.alt)} m · ${Math.round(t.spd || 0)} m/s · ${pad(Math.round(t.crs || 0))}° · ${fmtM(dist(p.x, p.y, site().center[0], site().center[1]))}`;
    t.last = { x: p.x, y: p.y, alt: p.alt };
  }

  let lastTick = 0;
  function tick(ts) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.2, (ts - lastTick) / 1000 || 0.016);
    lastTick = ts;
    if (!state.tracks.length) return;
    const time = scnTime();
    state.tracks.forEach((t) => {
      const p = trackPosition(t, time, dt);
      if (p) drawTrack(t, p, dt);
    });
    /* zaplanowane zdarzenia w scenariuszu (np. zrzut ładunku) */
    const inc = state.active && state.active.inc;
    if (inc && inc.events) inc.events.forEach((ev, i) => {
      if (time >= ev.t && !state.firedEvents.has(inc.id + i)) { state.firedEvents.add(inc.id + i); fireScenarioEvent(ev); }
    });
    /* głowica EO/IR podąża za celem, OSD i profil aktualizują się na żywo */
    const pr = state.primary;
    if (pr && pr.last) {
      if (state.active && state.active.locked) aimSensor(state.active.inc.sensor, pr.last.x, pr.last.y);
      els.osdTrk.textContent = `${pr.id} · ${Math.round(pr.last.alt)} m · ${Math.round(pr.spd || 0)} m/s · ${fmtM(dist(pr.last.x, pr.last.y, site().center[0], site().center[1]))} od aktywa`;
      if (state.view === "prof") updateProfile();
      updateTrackMeta();
    }
  }

  function setTrackMode(t, mode, extra) {
    if (!t || t.mode === "landed") return;
    t.mode = mode;
    if (extra) Object.assign(t, extra);
  }

  function onTrackLanded(t) {
    pushEvent(`${t.id} ślad zakończony na ziemi`, "ok");
    t.node.classList.add("lost");
    if (t === state.primary) setFeedStatus("CEL SPROWADZONY", "ok");
  }

  function onIntercept(interceptor, target) {
    if (interceptor.done) return;
    interceptor.done = true;
    setTrackMode(interceptor, "hold");
    setTrackMode(target, "captured");
    beep("ok");
    pushEvent(`${target.id} przechwycony`, "ok");
    ok(`<span class="b">Przechwycenie potwierdzone.</span> Cel ${target.id} ujęty w siatkę i sprowadzany. Punkt przyziemienia poza obrysem aktywa krytycznego – zabezpieczam współrzędne dla Policji.`, { options: closeOptions(state.active) });
  }

  function fireScenarioEvent(ev) {
    if (ev.kind === "drop") {
      const g = svgEl("g", { class: "drop" }, layers.fx);
      svgEl("circle", { cx: ev.x, cy: ev.y, r: 3, fill: "#ff4d5e" }, g);
      svgEl("circle", { cx: ev.x, cy: ev.y, r: 9, fill: "none", stroke: "#ff4d5e", "stroke-width": .8, "stroke-dasharray": "3 2" }, g);
      text(g, ev.x + 11, ev.y + 3, ev.label, "nfz-lbl", "start");
      beep("KRYTYCZNY");
      pushEvent(`ZRZUT PRZEDMIOTU · ${ev.label}`, "alert");
      warn(`<span class="r">BSP zrzucił przedmiot</span> przy transformatorze blokowym 2 (${now()}). Zaznaczyłem punkt na mapie i zapisałem stopklatkę. Nie wysyłaj nikogo w promieniu 100 m.`);
    }
  }

  /* ---------- warstwa efektów (namiary, zakłócanie, patrole, zrzuty) ---------- */
  function clearFx() { if (layers.fx) layers.fx.innerHTML = ""; }

  /* ==================================================================
     PROFIL PIONOWY (wysokość × odległość od aktywa)
     ================================================================== */
  const PRF = { x0: 70, x1: 908, y0: 44, y1: 356, maxKm: 5, maxAlt: 320 };
  const prfX = (km) => PRF.x0 + (PRF.x1 - PRF.x0) * clamp(1 - km / PRF.maxKm, 0, 1);
  const prfY = (alt) => PRF.y1 - (PRF.y1 - PRF.y0) * clamp(alt / PRF.maxAlt, 0, 1);

  function renderProfile() {
    const S = site();
    els.prof.innerHTML = "";
    const g = els.prof;
    /* osie i siatka */
    svgEl("line", { class: "ax", x1: PRF.x0, y1: PRF.y1, x2: PRF.x1, y2: PRF.y1 }, g);
    svgEl("line", { class: "ax", x1: PRF.x0, y1: PRF.y0, x2: PRF.x0, y2: PRF.y1 }, g);
    [0, 50, 100, 120, 150, 200, 250, 300].forEach((a) => {
      svgEl("line", { class: "axg", x1: PRF.x0, y1: prfY(a), x2: PRF.x1, y2: prfY(a) }, g);
      text(g, PRF.x0 - 6, prfY(a) + 3, a + " m", "axl", "end");
    });
    for (let km = 0; km <= PRF.maxKm; km++) {
      svgEl("line", { class: "axg", x1: prfX(km), y1: PRF.y0, x2: prfX(km), y2: PRF.y1 }, g);
      text(g, prfX(km), PRF.y1 + 14, km === 0 ? "aktywo" : km + " km", "axl");
    }
    /* pułap lotów BSP i strefy */
    svgEl("rect", { class: "band", x: PRF.x0, y: prfY(S.ceiling), width: PRF.x1 - PRF.x0, height: PRF.y1 - prfY(S.ceiling) }, g);
    text(g, PRF.x1 - 4, prfY(S.ceiling) - 4, `PUŁAP LOTÓW BSP ${S.ceiling} m AGL`, "band-lbl", "end");
    svgEl("rect", { class: "band nfz", x: prfX(0.5), y: PRF.y0, width: prfX(0) - prfX(0.5), height: PRF.y1 - PRF.y0 }, g);
    text(g, prfX(0.25), PRF.y0 + 12, "STREFA ZAKAZANA", "band-lbl");
    /* sylwetka obiektu */
    if (S.kind === "onshore") {
      svgEl("rect", { class: "silh", x: prfX(0) - 26, y: prfY(299), width: 9, height: PRF.y1 - prfY(299) }, g);
      text(g, prfX(0) - 21, prfY(299) - 5, "KOMIN 299 m", "axl", "middle");
      svgEl("rect", { class: "silh", x: prfX(0) - 12, y: prfY(180), width: 22, height: PRF.y1 - prfY(180) }, g);
      text(g, prfX(0) - 1, prfY(180) - 5, "CHŁODNIA 180 m", "axl", "middle");
      svgEl("rect", { class: "silh", x: prfX(0.12), y: prfY(45), width: 34, height: PRF.y1 - prfY(45) }, g);
      text(g, prfX(0.12) + 17, prfY(45) - 5, "ROZDZIELNIA", "axl", "middle");
    } else {
      svgEl("rect", { class: "silh", x: prfX(0) - 10, y: prfY(150), width: 7, height: PRF.y1 - prfY(150) }, g);
      text(g, prfX(0) - 6, prfY(150) - 16, "TURBINA", "axl", "middle");
      text(g, prfX(0) - 6, prfY(150) - 6, "250 m (szczyt)", "axl", "middle");
      svgEl("circle", { class: "silh", cx: prfX(0) - 6, cy: prfY(150), r: 22 }, g);
      svgEl("rect", { class: "silh", x: prfX(0.1), y: prfY(30), width: 26, height: PRF.y1 - prfY(30) }, g);
      text(g, prfX(0.1) + 13, prfY(30) - 5, "OSS", "axl", "middle");
    }
    text(g, PRF.x0 - 6, PRF.y0 - 14, "wysokość AGL", "axl", "start");
    text(g, PRF.x1, PRF.y1 + 30, "odległość od aktywa krytycznego", "axl", "end");
    text(g, PRF.x0 - 6, PRF.y1 + 30, "ślad rysuje się na żywo wraz z ruchem celu", "axl", "start");
    els.prof._tracks = {};
    updateProfile();
  }

  function updateProfile() {
    const g = els.prof, S = site();
    if (!g._tracks) g._tracks = {};
    state.tracks.forEach((t) => {
      if (!t.last) return;
      let n = g._tracks[t.id];
      if (!n) {
        n = g._tracks[t.id] = {
          line: svgEl("polyline", { class: `tline ${t.cls}`, points: "" }, g),
          dot: svgEl("circle", { class: "tdot", r: 2.6, cx: 0, cy: 0 }, g),
          lbl: svgEl("text", { class: "tlbl", x: 0, y: 0, "text-anchor": "start" }, g),
          pts: [],
        };
        if (t.cls === "friend") { n.dot.style.fill = "#43d9a0"; n.lbl.style.fill = "#b6f3da"; }
        if (t.cls === "bird") { n.dot.style.fill = "#8fa6b8"; n.lbl.style.fill = "#9fb4c4"; }
        if (t.cls === "unknown") { n.dot.style.fill = "#ffb347"; n.lbl.style.fill = "#ffe0b8"; }
      }
      const km = dist(t.last.x, t.last.y, S.center[0], S.center[1]) * D.M / 1000;
      const x = prfX(km), y = prfY(t.last.alt);
      const p = n.pts;
      if (!p.length || dist(x, y, p[p.length - 1][0], p[p.length - 1][1]) > 1.2) {
        p.push([x, y]); if (p.length > 400) p.shift();
        n.line.setAttribute("points", ptsStr(p));
      }
      n.dot.setAttribute("cx", x); n.dot.setAttribute("cy", y);
      n.lbl.setAttribute("x", x + 6); n.lbl.setAttribute("y", y - 4);
      n.lbl.textContent = `${t.id} · ${Math.round(t.last.alt)} m · ${km.toFixed(2).replace(".", ",")} km`;
    });
  }

  /* ==================================================================
     WIDOK INTELIGENCJI
     ================================================================== */
  function renderIntel(extraCard) {
    if (extraCard !== undefined) state.intelCard = extraCard;
    const card0 = extraCard === undefined ? state.intelCard : extraCard;
    const I = D.intel[state.site];
    if (!I) { els.intel.innerHTML = ""; return; }
    const kpis = I.kpis.map((k) => `<div class="stat"><div class="big ${k.cls}">${esc(k.v)}</div><div class="sub">${esc(k.k)}</div></div>`).join("");
    const bmax = Math.max(...I.bars.v, 1);
    const bars = I.bars.v.map((v, i) => `<div class="bar ${I.bars.hot.includes(i) ? "hot" : ""}" style="height:${Math.max(4, v / bmax * 100)}%" title="${I.bars.x[i]}: ${v}"></div>`).join("");
    const barsx = I.bars.x.map((x) => `<span>${esc(x)}</span>`).join("");
    const heat = I.heat.v.map((row, r) => row.map((v) => `<i class="h${v}" title="${I.heat.rows[r]} ${v} zdarzeń"></i>`).join("")).join("");
    const ents = I.entities.map((e) => `<div class="ent"><div class="n">${esc(e.n)} <span class="m">${esc(e.m)}</span></div><div class="d">${esc(e.d)}</div></div>`).join("");
    const recs = I.recommendations.map((r) => `<li><span class="w">→</span><span>${esc(r)}</span></li>`).join("");
    const card = card0 ? `<div class="card wide" style="border-color:#5a2a30"><h4>POWIĄZANIE WYKRYTE PRZEZ SYSTEM · ${esc(card0.title)}</h4><div class="verdict">${card0.html}</div></div>` : "";
    els.intel.innerHTML = `
      <div class="intel-grid">
        ${card}
        <div class="card wide"><h4>OBRAZ OGÓLNY · ${esc(I.window)}</h4><div class="stat-row">${kpis}</div></div>
        <div class="card"><h4>${esc(I.bars.title)}</h4><div class="bars">${bars}</div><div class="bars-x">${barsx}</div></div>
        <div class="card"><h4>${esc(I.heat.title)}</h4><div class="heat">${heat}</div><div class="heat-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><div class="sub" style="margin-top:4px">wiersze: ${I.heat.rows.join(" · ")}</div></div>
        <div class="card wide"><h4>POWTARZALNE PODMIOTY I PROFILE</h4>${ents}</div>
        <div class="card wide"><h4>OCENA ANALITYCZNA AI</h4><div class="verdict">${I.verdict}</div><div class="sub" style="margin-top:6px">${esc(I.cross)}</div></div>
        <div class="card wide"><h4>REKOMENDACJE DLA WŁAŚCICIELA OBIEKTU</h4><ul class="ilist">${recs}</ul></div>
      </div>`;
  }

  /* ==================================================================
     TOR EO/IR · obraz, fuzja sensorów, widmo RF
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
    v.onerror = null; v.onloadeddata = null; v.ontimeupdate = null; v.onended = null;
    state.zoom = null; setZoom(null, false);
    v.pause(); v.removeAttribute("src"); v.innerHTML = "";
    if (!src) { v.load(); setNoSignal(true, "brak skonfigurowanego wideo dla tego sensora"); return; }
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

  function setZoom(z, on) {
    let t = "none";
    if (on && z) {
      const v = els.video, vw = v.videoWidth || 16, vh = v.videoHeight || 9, ew = v.clientWidth || 1, eh = v.clientHeight || 1;
      const k = Math.max(ew / vw, eh / vh), dw = vw * k, dh = vh * k;
      const ex = ((ew - dw) / 2 + (z.x / 100) * dw) / ew, ey = ((eh - dh) / 2 + (z.y / 100) * dh) / eh;
      const s = z.scale, tX = (z.tx ?? 50) / 100, tY = (z.ty ?? 42) / 100;
      const lim = (s - 1) / 2;
      const tx = clamp(tX - 0.5 - (ex - 0.5) * s, -lim, lim);
      const ty = clamp(tY - 0.5 - (ey - 0.5) * s, -lim, lim);
      t = `translate(${(tx * 100).toFixed(2)}%, ${(ty * 100).toFixed(2)}%) scale(${s})`;
    }
    [els.video, els.overlay].forEach((el) => { el.style.transformOrigin = "50% 50%"; el.style.transform = t; });
    $("#osd-zoom").hidden = !(on && z);
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
    if (!list || !list.length) { els.detections.innerHTML = '<li class="muted">brak klasyfikacji · scena nominalna</li>'; return; }
    els.detections.innerHTML = list.map(([l, c]) => `<li class="${hot ? (c >= 0.95 ? "hot" : "warn") : ""}"><span>${esc(l)}</span><span class="c">${(c * 100).toFixed(0)} %</span></li>`).join("");
  }

  function renderFusion(inc) {
    if (!inc) { els.fuse.innerHTML = '<li class="off"><span class="note">brak aktywnego celu · sensory w trybie dozoru</span></li>'; return; }
    els.fuse.innerHTML = inc.fusion.map((f) => `
      <li class="${f.neg ? "hot" : ""}">
        <span class="top"><span class="s">${esc(f.label)}</span><span class="v">${f.neg && f.v === 0 ? "BRAK" : (f.v * 100).toFixed(0) + " %"}</span></span>
        <span class="meter"><i style="width:${Math.max(2, f.v * 100)}%"></i></span>
        <span class="note">${esc(f.note)}</span>
      </li>`).join("");
  }

  function updateTrackMeta() {
    const rec = state.active, pr = state.primary;
    if (!rec || !pr || !pr.last) return;
    const t = rec.inc.target, S = site();
    const d = dist(pr.last.x, pr.last.y, S.center[0], S.center[1]);
    els.trkMeta.innerHTML = `
      <dt>ślad</dt><dd>${esc(t.trk)}</dd>
      <dt>typ</dt><dd>${esc(t.kindLabel)}</dd>
      <dt>model</dt><dd>${esc(t.model)}</dd>
      <dt>Remote ID</dt><dd class="${t.rid === "BRAK" ? "r" : t.rid === "ODCZYTANY" ? "g" : ""}">${esc(t.rid)}${t.serial && t.serial !== "—" ? " · " + esc(t.serial) : ""}</dd>
      <dt>masa</dt><dd>${esc(t.mtow)}</dd>
      <dt>ładunek</dt><dd class="${/pakiet|podwieszony/i.test(t.payload) ? "r" : ""}">${esc(t.payload)}</dd>
      <dt>łącze</dt><dd class="${/BRAK/.test(t.link) ? "y" : ""}">${esc(t.link)}</dd>
      <dt>wysokość</dt><dd>${Math.round(pr.last.alt)} m AGL</dd>
      <dt>prędkość</dt><dd>${Math.round(pr.spd || 0)} m/s</dd>
      <dt>kurs</dt><dd>${pad(Math.round(pr.crs || 0))}°</dd>
      <dt>odl. od aktywa</dt><dd class="${d * D.M < 500 ? "r" : d * D.M < 1500 ? "y" : ""}">${fmtM(d)}</dd>
      <dt>start / dom</dt><dd>${esc(t.home)}</dd>`;
  }

  /* ---------- widmo RF (kanwa) ---------- */
  let specMode = "quiet", specPhase = 0;
  function drawSpectrum(resize) {
    const c = els.spec, ctx = c.getContext("2d");
    const w = c.clientWidth || 240, h = 54;
    if (resize || c.width !== w) { c.width = w; c.height = h; }
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a1016"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(79,209,255,.12)";
    for (let x = 0; x < w; x += w / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    specPhase += 0.25;
    const peaks = { quiet: [], rc: [[0.17, 0.72, 0.012], [0.62, 0.55, 0.01]], enc: [[0.08, 0.6, 0.02]], wide: [], none: [] }[specMode] || [];
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const fx = x / w;
      let v = 0.1 + 0.05 * Math.sin(fx * 40 + specPhase) + Math.random() * 0.06;
      if (specMode === "wide") v += 0.55 * Math.exp(-Math.pow((fx - 0.12) / 0.1, 2)) + 0.22;
      peaks.forEach(([p, amp, wd]) => { v += amp * Math.exp(-Math.pow(fx - p, 2) / wd); });
      const y = h - v * h * 0.95;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = specMode === "wide" ? "#ffb347" : specMode === "quiet" || specMode === "none" ? "#4a6578" : "#4fd1ff";
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = specMode === "wide" ? "rgba(255,179,71,.14)" : "rgba(79,209,255,.10)";
    ctx.fill();
  }
  setInterval(() => drawSpectrum(false), 120);

  function setFeedStatus(text_, cls) { els.feedStatus.textContent = text_; els.feedStatus.className = `pill ${cls || ""}`; }

  function setFeedIdle() {
    els.feedMain.classList.add("idle"); $("#feed").classList.add("idle");
    els.feedCamId.textContent = "—";
    renderFusion(null); renderDetections([]); renderBoxes([]);
    els.trkMeta.innerHTML = "<dt>ślad</dt><dd>—</dd>";
    specMode = "quiet";
    els.osdTrk.textContent = "—";
  }

  function selectSensor(id) {
    const s = sensorById(id); if (!s) return;
    els.feedMain.classList.remove("idle"); $("#feed").classList.remove("idle");
    if (state.history) exitHistory();
    state.selectedSensor = id;
    els.svg.querySelectorAll(".sns.sel").forEach((n) => n.classList.remove("sel"));
    if (!snsNode(id)?.classList.contains("hot")) snsNode(id)?.classList.add("sel");
    els.feedCamId.textContent = `${s.id} · ${s.name.toUpperCase()}`;
    els.osdCam.textContent = `${s.id} ${s.name}`;
    els.osdZone.textContent = s.zone;

    const rec = state.active && state.active.inc.sensor === id && state.active.status !== "closed" ? state.active : null;
    if (s.offline) {
      loadVideo(null); setNoSignal(true, "sensor offline · zgłoszenie serwisowe MT-2208"); renderBoxes([]); renderDetections([]); setFeedStatus("OFFLINE", "");
      els.feedMain.classList.remove("alert");
    } else if (rec) {
      loadVideo(rec.inc.video || s.video);
      if (rec.inc.zoom) armZoom(rec.inc.zoom);
      renderBoxes(rec.inc.boxes); renderDetections(rec.inc.detections, true); renderFusion(rec.inc);
      setFeedStatus(rec.status === "new" ? (rec.inc.noAlarm ? "ROZSTRZYGNIĘTE AUTOMATYCZNIE" : "CEL W STREFIE") : "W PROCEDURZE", rec.status === "new" ? (rec.inc.noAlarm ? "ok" : "alert") : "attn");
      els.feedMain.classList.toggle("alert", rec.status === "new" && !rec.inc.noAlarm);
    } else if (s.video) {
      loadVideo(s.video); els.video.loop = true; renderBoxes([]); renderDetections([]); renderFusion(null); setFeedStatus("DOZÓR", "live");
      els.feedMain.classList.remove("alert");
    } else {
      loadVideo(null);
      setNoSignal(true, `sensor <code>${esc(s.id)}</code> nie ma kanału wizyjnego · dane: ${esc(s.type)}`);
      renderBoxes([]); renderDetections([]); setFeedStatus("DANE", "");
      els.feedMain.classList.remove("alert");
    }
  }

  function armZoom(z, onDone) {
    state.zoom = z ? { cfg: z, on: false } : null;
    setZoom(z, false);
    els.video.loop = !z;
    els.video.ontimeupdate = z ? () => {
      const st = state.zoom; if (!st || st.cfg !== z) return;
      if (!st.on && els.video.currentTime >= z.from) { st.on = true; setZoom(z, true); }
    } : null;
    els.video.onended = () => { if (z && state.zoom && state.zoom.cfg === z) setTimeout(() => onDone && onDone(), z.hold || 2000); else onDone && onDone(); };
  }

  function pushEvent(text_, cls, sensorId) {
    const li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = `<span class="t">${now()}</span><span class="s">${text_}</span>`;
    if (sensorId) li.addEventListener("click", () => selectSensor(sensorId));
    els.events.prepend(li);
    while (els.events.children.length > 16) els.events.lastChild.remove();
  }

  $("#btn-fullscreen").addEventListener("click", () => { (els.feedMain.requestFullscreen || (() => {})).call(els.feedMain); });

  function exitHistory() {
    state.history = null; $("#feed-history").hidden = true;
    els.video.loop = true; els.video.onended = null; els.video.ontimeupdate = null;
    state.zoom = null; setZoom(null, false);
  }

  /* ==================================================================
     SILNIK SCENARIUSZY
     ================================================================== */
  function beep(kind) {
    try {
      if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = state.audioCtx, t = ctx.currentTime;
      const tones = kind === "KRYTYCZNY" ? [[880, 0], [660, 0.18], [880, 0.36], [660, 0.54]]
        : kind === "ok" ? [[520, 0], [780, 0.12]] : [[740, 0], [740, 0.22]];
      tones.forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = f; g.gain.value = 0.03;
        o.connect(g).connect(ctx.destination); o.start(t + dt); o.stop(t + dt + 0.12);
      });
    } catch (_) { /* dźwięk jeszcze niedozwolony */ }
  }

  const THREATS = { "ZIELONY": 1, "ŻÓŁTY": 2, "CZERWONY": 3, "CZARNY": 4 };
  function setThreat(level) {
    state.threat = level;
    els.kpiThreat.textContent = level;
    els.kpiThreatBox.className = "kpi threat t" + (THREATS[level] || 1);
  }

  function renderRoe() {
    const rows = (state.roeArmed ? D.roe.armed : D.roe.locked)
      .map((r) => `<div class="row ${r.cls}"><span>${esc(r.k)}</span><span>${esc(r.v)}</span></div>`).join("");
    els.roeBox.innerHTML = `<div class="hd">ŚRODKI AKTYWNE · PODSTAWA PRAWNA I STAN</div>${rows}`;
    els.roeState.textContent = state.roeArmed ? "UZBROJONE" : "ZABLOKOWANE";
    $("#roe-top").classList.toggle("armed", state.roeArmed);
  }

  function updateKpis() {
    const S = site();
    els.kpiSensors.textContent = `${S.sensors.filter((s) => !s.offline).length}/${S.sensors.length}`;
    els.kpiTracks.textContent = state.tracks.filter((t) => t.mode !== "landed").length;
    const n = state.active && state.active.status !== "closed" && !state.active.inc.noAlarm ? 1 : 0;
    els.kpiAlerts.textContent = n;
    els.kpiAlerts.parentElement.classList.toggle("hot", n > 0);
    els.btnAuto.classList.toggle("active", state.auto);
    refreshEventButtons();
    renderRoe();
  }
  setInterval(() => { els.kpiTracks.textContent = state.tracks.filter((t) => t.mode !== "landed").length; }, 1000);

  function toggleAuto() {
    state.auto = !state.auto;
    updateKpis();
    if (state.auto) { sys(`Tryb demo: scenariusze będą uruchamiać się <span class="g">automatycznie</span>.`); scheduleAuto(8000); }
    else { sys(`Tryb demo: scenariusze wybierasz <span class="y">ręcznie</span> przyciskami u góry panelu.`); clearTimeout(state.autoTimer); }
  }
  function scheduleAuto(ms) {
    clearTimeout(state.autoTimer);
    if (!state.auto) return;
    state.autoTimer = setTimeout(() => { if (state.auto && !state.active) fireNextIncident(); else if (state.auto) scheduleAuto(5000); }, ms);
  }

  const SEV_CLS = { NISKI: "LOW", ŚREDNI: "MEDIUM", WYSOKI: "HIGH", KRYTYCZNY: "CRITICAL" };
  const SEV_TXT = { NISKI: "MAŁE ZAGROŻENIE", ŚREDNI: "ŚREDNIE ZAGROŻENIE", WYSOKI: "DUŻE ZAGROŻENIE", KRYTYCZNY: "KRYTYCZNE ZAGROŻENIE" };
  const severityTag = (s) => `<span class="tag ${SEV_CLS[s] || ""}">${SEV_TXT[s] || s}</span>`;

  function abortActive() {
    const rec = state.active; if (!rec || rec.status === "closed") return;
    rec.status = "closed"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    sys(`Scenariusz ${rec.inc.id} przerwany – przełączono na inny scenariusz.`, { delay: 60 });
  }

  function fireIncident(i) {
    if (state.active && state.active.inc === D.incidents[i] && state.active.status !== "closed") return;
    abortActive();
    state.incidentCursor = i;
    fireNextIncident();
  }

  function fireNextIncident() {
    if (state.active && state.active.status !== "closed") {
      warn(`Najpierw zakończ obecny scenariusz – dokończ procedurę, zamknij zdarzenie albo oznacz je jako fałszywy alarm.`);
      return;
    }
    if (state.incidentCursor >= D.incidents.length) {
      ok(`To były wszystkie zaplanowane scenariusze w tym demo. Wybierz dowolny numer u góry panelu, aby odtworzyć go ponownie.`);
      state.auto = false; updateKpis();
      return;
    }
    const inc = D.incidents[state.incidentCursor++];
    if (inc.site !== state.site) switchSite(inc.site, false);
    const sns = sensorById(inc.sensor);
    const rec = { inc, sns, status: "new", step: 0, steps: [], openedAt: now(), n: ++state.seq, locked: false };
    state.active = rec;
    state.roeArmed = false;
    clearFx();

    /* obraz sytuacyjny: ślady, podświetlenia, kamera, widmo RF */
    startTracks(inc);
    setSensorState(inc.sensor, "hot");
    (inc.highlight || []).forEach((id) => {
      els.svg.querySelector(`.vessel[data-id="${id}"]`)?.classList.add("dark");
      els.svg.querySelector(`.wtg[data-id="${id}"]`)?.classList.add("hot");
    });
    setPanelView("map");
    frameIncident(inc);
    specMode = /BRAK/.test(inc.target.link) ? "none" : /szyfrowane/.test(inc.target.link) ? "enc" : /zakłóc/.test(inc.target.link) ? "wide" : "rc";
    document.body.classList.remove("flash"); void document.body.offsetWidth;
    if (!inc.noAlarm) { document.body.classList.add("flash"); beep(inc.severity); }
    setThreat(inc.threat || "ŻÓŁTY");
    selectSensor(inc.sensor);
    pushEvent(`${inc.id} ${esc(inc.title)}`, inc.noAlarm ? "attn" : "alert", inc.sensor);
    updateKpis();

    const S = site();
    say(inc.noAlarm ? "warn" : (inc.severity === "KRYTYCZNY" ? "alert crit" : "alert"),
      inc.noAlarm ? `ℹ ROZSTRZYGNIĘTE AUTOMATYCZNIE · ${inc.id}` : `⚠ NOWE ZDARZENIE · ${inc.id}`,
      `${severityTag(inc.severity)}
<span class="b">${esc(inc.title)}</span>
<table class="kv">
<tr><td>obiekt</td><td>${esc(S.name)} <span class="k">(${esc(S.sub)})</span></td></tr>
<tr><td>sensor wiodący</td><td>${inc.sensor} · ${esc(sns ? sns.name : "")}</td></tr>
<tr><td>ślad</td><td>${esc(inc.target.trk)} · ${esc(inc.target.kindLabel)}</td></tr>
<tr><td>kiedy</td><td>${rec.openedAt}</td></tr>
<tr><td>poziom zagrożenia</td><td>${esc(inc.threat)}</td></tr>
</table>${esc(inc.summary)}`, { delay: 120 });

    ai(`Ślad jest na obrazie sytuacyjnym, obraz z ${inc.sensor} po prawej. Fuzja sensorów po prawej pokazuje, z czego ten ślad jest zbudowany.${inc.autoNote ? " " + esc(inc.autoNote) : ""} <span class="b">Co robimy?</span>`, {
      options: (inc.options || []).map((o) => ({ label: o.label, cls: o.cls, action: () => runAction(o.action, rec, o) })),
      multi: inc.multi !== false,
    });
  }

  /** Kadruje mapę tak, by w widoku były: aktywo krytyczne, punkty wejścia śladów i rejon ich działania. */
  function frameIncident(inc) {
    const pts = [site().center];
    (inc.tracks || []).forEach((t) => {
      const f = t.wps[0], l = t.wps[t.wps.length - 1];
      pts.push([f[1], f[2]], [l[1], l[2]]);
      if (t.orbit) pts.push([t.orbit.cx, t.orbit.cy]);
    });
    if (inc.operator) pts.push([inc.operator.x, inc.operator.y]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const ar = view.w / view.h;
    const w = clamp(Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * ar) * 1.45, 700, 1120);
    fitTo(cx, cy, w);
  }

  /* ---------- akcje operatora ---------- */
  function runAction(action, rec, o) {
    switch (action) {
      case "lock": lockTarget(rec); break;
      case "locate": locateOperator(rec); break;
      case "patrol": showPatrols(rec, o); break;
      case "notify": notify(rec, o); break;
      case "jam": jam(rec, o); break;
      case "takeover": takeover(rec, o); break;
      case "intercept": intercept(rec, o); break;
      case "sat": satellite(rec); break;
      case "hail": hail(rec, o); break;
      case "permit": permit(rec); break;
      case "suspend": suspend(rec); break;
      case "stopops": stopOps(rec); break;
      case "gnss": gnssConfirm(rec); break;
      case "priority": priority(rec); break;
      case "roe": requestRoe(rec); break;
      case "intel": showIntel(rec); break;
      case "record": record(rec); break;
      case "analysis": analysis(rec); break;
      case "confirm": confirmIncident(); break;
      case "hold": holdIncident(rec); break;
      case "false": falseAlarm(rec); break;
      case "close": closeSimple(rec); break;
    }
  }

  const closeOptions = (rec) => [
    { label: "Zamknij zdarzenie", cls: "good", action: () => closeSimple(rec) },
    { label: "Jeszcze nie – obserwuję dalej", action: () => {} },
  ];

  function lockTarget(rec) {
    rec.locked = true;
    const pr = state.primary;
    if (pr && pr.last) aimSensor(rec.inc.sensor, pr.last.x, pr.last.y);
    armZoom(rec.inc.zoom || { x: 50, y: 36, scale: 2.2, tx: 50, ty: 42, from: 2.2, hold: 99999 });
    setFeedStatus("AUTOTRACKING", "alert");
    pushEvent(`${rec.inc.id} ${rec.inc.sensor} autotracking na ${rec.inc.target.trk}`, "attn", rec.inc.sensor);
    ok(`Głowica <span class="b">${rec.inc.sensor}</span> przejęła cel w autotracking i trzyma go w kadrze. Pole widzenia na mapie podąża za śladem, obraz jest zbliżony.`);
  }

  function locateOperator(rec) {
    const opn = rec.inc.operator;
    if (!opn) { ai(`Dla tego śladu nie ma emisji, z której dałoby się wyznaczyć pozycję operatora – ten obiekt leci autonomicznie.`); return; }
    const g = svgEl("g", { class: "df-layer" }, layers.fx);
    (opn.df || []).forEach((id) => {
      const s = sensorById(id); if (!s) return;
      const a = Math.atan2(opn.y - s.y, opn.x - s.x);
      const R = dist(s.x, s.y, opn.x, opn.y) * 1.25;
      svgEl("line", { class: "df", x1: s.x, y1: s.y, x2: s.x + R * Math.cos(a), y2: s.y + R * Math.sin(a) }, g);
    });
    svgEl("ellipse", { class: "df-fix", cx: opn.x, cy: opn.y, rx: 9, ry: 6 }, g);
    svgEl("circle", { class: "op-mark", cx: opn.x, cy: opn.y, r: 2.4 }, g);
    text(g, opn.x + 12, opn.y + 3, opn.label, "op-lbl", "start");
    setPanelView("map");
    pushEvent(`${rec.inc.id} triangulacja RF/DF · ${opn.label}`, "attn");
    ok(`<span class="b">${esc(opn.label)}</span> – zaznaczyłem na mapie wraz z liniami namiarów. ${esc(opn.note)}`);
  }

  /* ---------- patrole / jednostki ---------- */
  function patrolLayer() { return layers.fx; }
  function drawPatrol(pt, cls = "") {
    let g = patrolLayer().querySelector(`[data-pid="${pt.id}"]`);
    if (!g) g = svgEl("g", { class: `patrol ${cls}`, "data-pid": pt.id }, patrolLayer());
    else g.setAttribute("class", `patrol ${cls}`);
    g.innerHTML = "";
    svgEl("circle", { class: "ring", cx: pt.x, cy: pt.y, r: 5 }, g);
    svgEl("circle", { class: "core", cx: pt.x, cy: pt.y, r: 2.2 }, g);
    text(g, pt.x + 7, pt.y + 1, pt.id, "pl", "start");
    text(g, pt.x + 7, pt.y + 7, pt.names.map((n) => n.split(" ").slice(-1)[0]).join(", "), "pn", "start");
    return g;
  }
  function showPatrols(rec, o) {
    rec.patrolArrival = o && o.arrival;
    const S = site();
    const goal = (o && o.target === "operator" && rec.inc.operator) ? rec.inc.operator : { x: S.center[0], y: S.center[1], label: "aktywo krytyczne" };
    rec.patrolGoal = goal;
    const list = S.patrols.map((pt) => {
      const d = dist(pt.x, pt.y, goal.x, goal.y) * D.M;
      return { pt, d, eta: Math.max(1, Math.round(d / (pt.speed || 8) / 60)) };
    }).sort((a, b) => a.d - b.d);
    S.patrols.forEach((pt) => drawPatrol(pt, ""));
    const near = list.slice(0, 3);
    near.forEach(({ pt }) => drawPatrol(pt, "near"));
    setPanelView("map");
    const rows = near.map(({ pt, d, eta }) => `<li><span class="b">${pt.id}</span> · ${esc(pt.names.join(", "))} · ${esc(pt.kind)} · ${(d / 1000).toFixed(1).replace(".", ",")} km · ok. ${eta} min</li>`).join("");
    ai(`Najbliższe siły zaznaczyłem na mapie – cel skierowania: <span class="b">${esc(goal.label)}</span>:<ul class="plain">${rows}</ul>Kogo wysłać?`, {
      options: near.map(({ pt, eta }) => ({ label: `Skieruj ${pt.id} · ${pt.kind} · ${eta} min`, cls: "danger", action: () => dispatchPatrol(rec, pt, eta, goal) })),
    });
  }
  function dispatchPatrol(rec, pt, eta, goal) {
    const g = drawPatrol(pt, "sent");
    const route = svgEl("line", { class: "route", x1: pt.x, y1: pt.y, x2: goal.x, y2: goal.y });
    patrolLayer().insertBefore(route, g);
    const T = 10000, t0 = performance.now();
    const step = (ts) => {
      const k = Math.min(1, (ts - t0) / T);
      g.setAttribute("transform", `translate(${(goal.x - pt.x) * k} ${(goal.y - pt.y) * k})`);
      if (k < 1) requestAnimationFrame(step);
      else { route.remove(); patrolArrived(rec, pt); }
    };
    requestAnimationFrame(step);
    pushEvent(`${rec.inc.id} skierowano ${pt.id}`, "attn");
    ok(`<span class="b">${pt.id}</span> (${esc(pt.names.join(", "))}) skierowany do: ${esc(goal.label)}. Czas dojścia ok. ${eta} min. Śledzisz jednostkę na mapie.`);
  }
  function patrolArrived(rec, pt) {
    if (state.active !== rec) return;
    beep("ok");
    const txt = rec.patrolArrival ? esc(rec.patrolArrival).replace("Patrol jest", `${pt.id} jest`)
      : `<span class="b">${pt.id}</span> jest na miejscu i przekazuje meldunek.`;
    ok(txt, { options: closeOptions(rec) });
  }

  /* ---------- powiadomienia, wywołania, dowody ---------- */
  function notify(rec, o) {
    pushEvent(`${rec.inc.id} powiadomiono: ${esc(o.to || "służby")}`, "attn");
    ok(`<span class="b">${esc(o.to || "Służby")}</span> – ${esc(o.text || "zgłoszenie wysłane.")}`);
    if (o.reply) setTimeout(() => { if (state.active !== rec) return; sys(esc(o.reply)); }, o.replyDelay || 6000);
  }
  function hail(rec, o) {
    pushEvent(`${rec.inc.id} wywołanie / ostrzeżenie nadane`, "attn");
    ok(`Nadano: <span class="b">„${esc(o.text || "Proszę opuścić strefę.")}”</span> Nagranie zapisane w karcie zdarzenia.`);
    if (o.after) setTimeout(() => { if (state.active !== rec) return; ai(esc(o.after), { options: closeOptions(rec) }); }, o.afterDelay || 7000);
  }
  function record(rec) {
    ok(`Pakiet dowodowy <span class="h">PD-${rec.inc.id}-${pad(rec.n)}</span> zamknięty: ślad radarowy, namiary RF, nagranie EO/IR, zrzut Remote ID, log decyzji operatora. Suma kontrolna zapisana.`);
  }
  function satellite(rec) {
    pushEvent(`${rec.inc.id} zamówiono zobrazowanie satelitarne`, "attn");
    ok(`Zobrazowanie zamówione (SAR + optyczne, akwen 20 × 20 km). Przewidywana dostawa: <span class="b">ok. 40 min</span>. Dołączę je automatycznie do karty zdarzenia.`);
    setTimeout(() => { if (state.active !== rec) return; sys(`Potwierdzenie od dostawcy: przejście satelity nad akwenem za 34 min, zobrazowanie zarezerwowane.`); }, 9000);
  }
  function permit(rec) {
    const t = rec.inc.target;
    ai(`<span class="b">Weryfikacja uprawnień:</span><table class="kv">
<tr><td>Remote ID</td><td>${esc(t.rid)}${t.serial && t.serial !== "—" ? " · " + esc(t.serial) : ""}</td></tr>
<tr><td>plan lotu</td><td>${rec.inc.id === "ZD-03" ? "2025/114 · Energo-Serwis · ważny do 18:00" : rec.inc.id === "ZD-07" ? "2025/207 · Energo-Serwis · ważny do 16:00" : "<span class=\"r\">brak w PansaUTM</span>"}</td></tr>
<tr><td>zgoda PGE</td><td>${rec.inc.id === "ZD-03" || rec.inc.id === "ZD-07" ? "jest · inspekcja, korytarz zatwierdzony" : "<span class=\"r\">brak</span>"}</td></tr>
<tr><td>warunki</td><td>${rec.inc.id === "ZD-07" ? "<span class=\"y\">wirnik zatrzymany – NIESPEŁNIONY</span>" : rec.inc.id === "ZD-03" ? "spełnione" : "—"}</td></tr>
</table>`);
  }
  function suspend(rec) {
    pushEvent(`${rec.inc.id} nakazano zawieszenie lotu`, "attn");
    ok(`Nakaz zawieszenia lotu wysłany do wykonawcy i do pilota (kanał roboczy + SMS). Zgoda na loty zostaje <span class="y">wstrzymana do wyjaśnienia</span>. Utworzyłem kartę niezgodności.`);
    const t = state.primary; if (t) setTrackMode(t, "rth");
  }
  function stopOps(rec) {
    pushEvent(`${rec.inc.id} wstrzymano operacje w sektorze`, "attn");
    ok(`Wstrzymane: loty BSP inspekcyjnych, transfery personelu na turbiny w sektorze, operacje z pozycjonowaniem dynamicznym. Powiadomiłem SOV, CTV i koordynatora prac.`);
    const f = state.tracks.find((t) => t.cls === "friend"); if (f) setTrackMode(f, "rth");
  }
  function gnssConfirm(rec) {
    ai(`<span class="b">Potwierdzenie na niezależnych odbiornikach:</span><ul class="plain">
<li>stacja referencyjna OSS: C/N₀ −14 dB, utrata RTK</li>
<li>BSP inspekcyjny 2025/207: przejście w zawis, pozycja z INS</li>
<li>CTV „Wind Breeze”: rozbieżność pozycji 160 m, DP niedostępne</li>
<li>SOV „Baltica Supporter”: ostrzeżenie odbiornika, pozycja z radaru</li></ul>
To wyklucza awarię pojedynczego urządzenia. Zakłócenia są zewnętrzne i kierunkowe.`);
  }
  function priority(rec) {
    const S = site();
    const list = state.tracks.filter((t) => t.last).map((t) => ({ t, d: dist(t.last.x, t.last.y, S.center[0], S.center[1]) })).sort((a, b) => a.d - b.d);
    const rows = list.map(({ t, d }, i) => `<li><span class="b">P${i + 1}</span> · ${esc(t.id)} · ${fmtM(d)} od aktywa · ${Math.round(t.last.alt)} m</li>`).join("");
    ai(`Priorytety celów (aktualizowane co 2 s, kryterium: odległość do aktywa i tempo zniżania):<ul class="plain">${rows}</ul>
Cel <span class="b">P1</span> jest rekomendowany do przechwycenia – pozostałe utrzymuję na radarze i EO/IR.`);
    if (list[0]) { state.primary = list[0].t; updateTrackMeta(); }
  }
  function showIntel(rec) {
    const card = D.intelCards[rec.inc.intelCard];
    renderIntel(card);
    setPanelView("intel");
    pushEvent(`${rec.inc.id} korelacja z archiwum`, "attn");
    ai(`Przełączyłem panel na <span class="b">INTELIGENCJĘ</span>. ${card ? "To zdarzenie nie jest pojedyncze – szczegóły w karcie powiązania na górze." : "Pokazuję obraz 30-dniowy dla tego obiektu."}`);
  }

  /* ---------- środki aktywne ---------- */
  function requestRoe(rec) {
    if (state.roeArmed) { ai(`Zgoda na środki aktywne jest już udzielona – środki pozostają uzbrojone.`); return; }
    ai(`Wniosek o użycie środków aktywnych przygotowany automatycznie: podstawa <span class="b">art. 26a ustawy antyterrorystycznej</span>, uzasadnienie z karty zdarzenia (${esc(rec.inc.target.kindLabel)}, aktywo krytyczne, brak uprawnień do lotu). Potrzebna akceptacja dowódcy ochrony obiektu.`);
    setTimeout(() => {
      if (state.active !== rec) return;
      state.roeArmed = true;
      renderRoe(); updateKpis();
      beep("ok");
      ok(`<span class="b">Zgoda udzielona</span> (dowódca ochrony obiektu, ${now()}). Środki aktywne: <span class="r">UZBROJONE</span>. Użycie jest rejestrowane i raportowane do organów.`);
    }, 5000);
  }
  function roeBlocked(what) {
    warn(`<span class="r">${esc(what)} jest zablokowane.</span> Nie ma zgody na użycie środków aktywnych. Najpierw wystąp o zgodę (art. 26a) – przygotuję wniosek z karty zdarzenia.`, {
      options: [{ label: "Wystąp o zgodę na środki aktywne (art. 26a)", cls: "danger", action: () => requestRoe(state.active) }],
    });
  }
  function jam(rec, o) {
    if (!state.roeArmed) { roeBlocked("Zakłócanie"); return; }
    const s = site().sensors.find((x) => x.kind === "jam");
    const pr = state.primary;
    if (s && pr && pr.last) {
      const a = Math.atan2(pr.last.y - s.y, pr.last.x - s.x) * 180 / Math.PI;
      svgEl("path", { class: "jam-cone", d: wedgePath(s.x, s.y, s.range || 220, a, (s.fov || 60) / 2) }, layers.fx);
    }
    pushEvent(`${rec.inc.id} zakłócanie uruchomione`, "alert");
    specMode = "wide";
    if (o.warn) warn(esc(o.warn));
    if (o.effect === "none") {
      ai(`Zakłócanie nadaje, ale <span class="r">bez efektu</span> – cele nie mają łącza RC do zakłócenia. Lot jest autonomiczny, po zaprogramowanych punktach. Skuteczne pozostają: zakłócanie GNSS (ryzyko zawisu nad obiektem) i przechwycenie fizyczne.`);
    } else if (o.effect === "rth") {
      ok(`Łącze przerwane. Cel przeszedł w tryb awaryjny i <span class="b">wraca po własnym śladzie</span> do punktu startu, zniżając się. Prowadzę go dalej – punkt przyziemienia będzie znany.`);
      if (pr) setTrackMode(pr, "rth");
    } else {
      ok(`Łącze przerwane. Cel zniża się i ląduje w miejscu utraty sterowania.`);
      if (pr) setTrackMode(pr, "land");
    }
  }
  function takeover(rec, o) {
    if (!state.roeArmed) { roeBlocked("Przejęcie protokołu"); return; }
    const pr = state.primary;
    if (o && o.effect === "fail") {
      warn(`Przejęcie protokołu <span class="r">nieudane</span>: łącze jest szyfrowane i nie odpowiada znanym protokołom producenta. Pozostają: zakłócanie i przechwycenie fizyczne.`);
      return;
    }
    pushEvent(`${rec.inc.id} przejęcie protokołu`, "attn");
    ok(`Przejęcie łącza powiodło się. Przejmuję sterowanie i <span class="b">sprowadzam BSP</span> na wskazane miejsce poza obrysem aktywa. Operator traci kontrolę – jego aparatura jest nadal namierzana.`);
    if (pr) setTrackMode(pr, "land");
  }
  function intercept(rec, o) {
    if (!state.roeArmed) { roeBlocked("Dron przechwytujący"); return; }
    const from = sensorById(o.from) || site().sensors.find((s) => s.kind === "inter");
    const tgt = state.primary;
    if (!from || !tgt) return;
    const t = {
      id: "INT-" + pad(rec.n), cls: "inter", label: "INT · DRON PRZECHWYTUJĄCY", mode: "chase",
      wps: [[0, from.x, from.y, 0]], chase: tgt, trail: [], last: { x: from.x, y: from.y, alt: 10 },
    };
    t.node = makeTrackNode(t);
    state.tracks.push(t);
    pushEvent(`${rec.inc.id} start drona przechwytującego`, "alert");
    ok(`Dron przechwytujący wystartował ze stanowiska <span class="b">${from.id}</span> i zbliża się do celu ${tgt.id}. Siatka gotowa, punkt przechwycenia dobieram poza obrysem aktywa krytycznego.`);
  }

  /* ---------- analiza, fałszywy alarm, zamknięcie ---------- */
  function analysis(rec) {
    const inc = rec.inc, proc = D.procedures[inc.procedure];
    const seen = inc.detections.map((d) => `<li>${esc(d[0])} <span class="k">${(d[1] * 100).toFixed(0)} %</span></li>`).join("");
    ai(`<span class="b">Co widzę i z czego to wynika:</span><ul class="plain">${seen}</ul>${esc(inc.aiNotes)}

${proc ? `Jeśli to potwierdzisz, poprowadzę Cię przez procedurę <span class="b">„${esc(proc.title)}”</span> <span class="k">(${esc(proc.ref)})</span>.` : ""}`);
  }
  function holdIncident(rec) {
    ai(`Dobrze, obserwuję dalej. Jeśli za 20 sekund cel nadal będzie w strefie, odezwę się ponownie.`);
    setTimeout(() => {
      if (state.active !== rec || rec.status !== "new") return;
      beep(rec.inc.severity);
      say("alert", `⚠ CEL NADAL W STREFIE · ${rec.inc.id}`, `${severityTag(rec.inc.severity)} Minęło 20 sekund, ślad ${esc(rec.inc.target.trk)} nadal jest w strefie. Trzeba zdecydować.`, {
        options: (rec.inc.options || []).map((o) => ({ label: o.label, cls: o.cls, action: () => runAction(o.action, rec, o) })), multi: true, delay: 100,
      });
    }, 20000);
  }
  function falseAlarm(rec) {
    rec.status = "false"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    ok(`Zapisałem jako <span class="b">fałszywy alarm</span> (${rec.closedAt}) wraz z uzasadnieniem – klasyfikator uczy się na tej decyzji. Sensory wracają do dozoru.`);
    pushEvent(`${rec.inc.id} fałszywy alarm`, "ok");
    scheduleAuto(10000);
  }
  function closeSimple(rec) {
    if (!rec || rec.status === "closed") return;
    rec.status = "closed"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    const d = new Date();
    const reportId = `R-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(rec.n).padStart(3, "0")}`;
    beep("ok");
    ok(`<span class="b">Zdarzenie zamknięte</span> o ${rec.closedAt}. Raport <span class="h">${reportId}</span> i pakiet dowodowy zapisały się automatycznie; zdarzenie trafiło do warstwy inteligencji (korelacje, trendy).`);
    pushEvent(`${rec.inc.id} zamknięte · ${reportId}`, "ok");
    scheduleAuto(12000);
  }

  /* ---------- procedura krok po kroku ---------- */
  function confirmIncident() {
    const rec = state.active; if (!rec || rec.status !== "new") return;
    const inc = rec.inc, proc = D.procedures[inc.procedure];
    if (!proc) { ai(`Dla tego zdarzenia nie ma przypisanej procedury.`); return; }
    rec.status = "confirmed";
    rec.steps = proc.steps.map(() => "todo");
    setSensorState(inc.sensor, "hot");
    if (state.selectedSensor === inc.sensor) { setFeedStatus("W PROCEDURZE", "attn"); els.feedMain.classList.remove("alert"); }
    updateKpis();
    pushEvent(`${inc.id} potwierdzone → ${inc.procedure}`, "attn", inc.sensor);
    ai(`Dobrze. <span class="b">Powiadomiłem dowódcę zmiany.</span> Teraz wykonaj po kolei ${proc.steps.length} kroków procedury <span class="b">„${esc(proc.title)}”</span>. Po każdym kliknij „Zrobione”. Wszystko zapisuję w karcie zdarzenia.`);
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
  function refreshChecklist(rec) { if (rec.checklistEl) rec.checklistEl.querySelector(".body").innerHTML = procedureHtml(rec); }
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
    const t = rec.inc.interjections && rec.inc.interjections[rec.step];
    if (t) sys(t);
    askStep(rec);
  }
  function stepSkip(rec) {
    rec.steps[rec.step] = "skip"; rec.step++;
    warn(`Rozumiem. Zapisałem, że krok ${rec.step} nie został wykonany, i powiadomiłem dowódcę zmiany. Przechodzimy dalej.`);
    askStep(rec);
  }
  function completeIncident(rec) {
    rec.status = "closed"; rec.closedAt = now();
    refreshChecklist(rec);
    closeIncidentVisuals(rec);
    const skipped = rec.steps.filter((s) => s === "skip").length;
    const d = new Date();
    const reportId = `R-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(rec.n).padStart(3, "0")}`;
    beep("ok");
    ok(`<span class="b">Wszystkie kroki wykonane.</span> Zdarzenie zakończone o ${rec.closedAt}. Raport <span class="h">${reportId}</span> zapisany${skipped ? ` (z informacją o ${skipped} ${skipped === 1 ? "niewykonanym kroku" : "niewykonanych krokach"})` : ""}. Zdarzenie zasiliło warstwę inteligencji – jeśli wzorzec się powtórzy, zobaczysz to w panelu INTELIGENCJA.`);
    pushEvent(`${rec.inc.id} zamknięte · ${reportId}`, "ok");
    scheduleAuto(12000);
  }

  function closeIncidentVisuals(rec) {
    els.log.querySelectorAll(".opts:not(.used)").forEach((w) => w.classList.add("used"));
    state.pendingOptions = null;
    state.closed.push(rec);
    if (state.active === rec) state.active = null;
    setSensorState(rec.inc.sensor, null);
    state.roeArmed = false;
    setThreat("ZIELONY");
    clearFx();
    clearTracks();
    specMode = "quiet";
    state.intelCard = null;
    els.osdTrk.textContent = "—";
    renderFusion(null);
    els.trkMeta.innerHTML = "<dt>ślad</dt><dd>—</dd>";
    if (state.selectedSensor === rec.inc.sensor) selectSensor(rec.inc.sensor);
    updateKpis();
  }

  /* ---------- modal ---------- */
  function showModal(title, text_) {
    $("#modal-title").textContent = title; $("#modal-text").textContent = text_;
    $("#modal").hidden = false; $("#modal-ok").focus();
  }
  $("#modal-ok").addEventListener("click", () => { $("#modal").hidden = true; });
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });

  /* ==================================================================
     START
     ================================================================== */
  function tickClock() {
    const d = new Date();
    els.clockTime.textContent = now();
    els.clockDate.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${["NDZ", "PON", "WT", "ŚR", "CZW", "PT", "SOB"][d.getDay()]}`;
    els.osdTime.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${now()}`;
  }

  function boot() {
    renderSiteButtons();
    renderEventButtons();
    renderScene();
    resetView();
    renderProfile();
    renderIntel();
    setFeedIdle();
    setThreat("ZIELONY");
    updateKpis();
    tickClock(); setInterval(tickClock, 1000);
    requestAnimationFrame(tick);
    drawSpectrum(true);
    ["click", "keydown"].forEach((ev) => window.addEventListener(ev, () => {
      if (!state.audioCtx) { try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    }, { once: true }));
    sys(`System antydronowy w dozorze. Obiekt: <span class="b">${esc(site().name)}</span> · ${esc(site().sub)}. Sensory: ${site().sensors.filter((s) => !s.offline).length} czynne. ${esc(site().airspaceNote)}`);
    ai(`Jestem asystentem operatora. Prowadzę fuzję sensorów, klasyfikuję cele i prowadzę Cię przez procedury. Wybierz scenariusz numerem u góry panelu albo włącz <span class="b">AUTO</span>. Obiekt przełączasz w lewym górnym narożniku; panel po prawej ma trzy widoki: <span class="b">SYTUACJA</span>, <span class="b">PROFIL PIONOWY</span> i <span class="b">INTELIGENCJA</span>.`);
  }

  boot();
})();

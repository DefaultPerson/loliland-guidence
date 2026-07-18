/* TechnoMagic RPG — Reactor HUD checklist. Vanilla, file:// safe. */
(function () {
  "use strict";
  var G = window.GUIDE || { meta: {}, sections: [], order: [], milestones: [], serverMeta: null };
  var NS = "tmrpg.v1.";

  function $(s, r) { return (r || document).querySelector(s); }
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function ico(name) { return '<svg class="ico"><use href="#i-' + name + '"/></svg>'; }
  function pad2(n) { return ("0" + n).slice(-2); }
  function load(k, d) { try { var v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} }

  var done = load("done", {}), notes = load("notes", {});

  /* ---------- static config ---------- */
  var WAVES = {
    1: { name: "Старт", sub: "Фундамент — проходится первым." },
    2: { name: "Ранняя техника", sub: "Инструменты, базовая обработка и базовая AE2-автоматизация — фундамент для обеих веток; можно вести параллельно." },
    3: { name: "Развитие — параллельные ветки", sub: "Эти этапы проходятся одновременно. Вдвоём удобно делить: техник углубляет автоматизацию (LoliEnergistics, Mekanism, энергия) поверх базовой AE2, магик ведёт Таумкрафт -> Botania -> кровь." },
    4: { name: "Эндгейм-сборка", sub: "Сходятся ветки: энергия, драконы, пчёлы-хаб, реликвии — частично параллелятся." },
    5: { name: "Финал", sub: "«Дорога к Бесконечному» — собирается из всего предыдущего." }
  };
  var TRACK = {
    base: { v: "--t-base", label: "Старт" },
    tech: { v: "--t-tech", label: "Техника" },
    magic: { v: "--t-magic", label: "Магия" },
    explore: { v: "--t-explore", label: "Исслед." },
    endgame: { v: "--t-endgame", label: "Эндгейм" }
  };
  var ROLE = { tech: { l: "A · техника", i: "server" }, magic: { l: "B · магия", i: "zap" } };
  function roleOf(t) { return ROLE[t] || { l: "оба игрока", i: "users" }; }
  function trk(s) { return TRACK[s.track] || TRACK.tech; }
  function trackC(s) { return "var(" + trk(s).v + ")"; }

  /* game-asset icon per stage (extracted client textures) */
  var STAGE_ICON = {
    start: "icons/divinerpg_wildwoodPickaxe.png",
    tinkers: "icons/ThermalExpansion_wrench.png",
    processing: "icons/ThermalExpansion_Cell.png",
    thaumcraft: "icons/Thaumcraft_blockTable.png",
    botania: "icons/Botania_blackLotus.png",
    dimensions: "icons/lolidimensions_end_portal_eye.png",
    bloodmagic: "icons/lolimagically_blood_crystal.png",
    ae2: "icons/lolienergistics_niobium_chip.png",
    energistics: "icons/lolienergistics_quantum_core.png",
    mekanism: "icons/uniresources_ingotMithril.png",
    bees: "icons/Forestry_beeCombs.png",
    draconic: "icons/DraconicEvolution_draconicCore.png",
    dragons: "icons/lolidimensions_dragon_heart.png",
    relics_elements: "icons/lolienergyrelics_ItemNewChaosCore.png",
    avaritia: "icons/Avaritia_Crystal_Matrix.png"
  };

  /* ---------- ordered sections + stable step ids (preserve saved progress) ---------- */
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36); }
  function orderedSections() {
    var secs = (G.sections || []).slice(), ord = G.order && G.order.length ? G.order : null;
    if (!ord) return secs;
    var by = {}; secs.forEach(function (s) { by[s.key] = s; });
    var out = []; ord.forEach(function (k) { if (by[k]) { out.push(by[k]); delete by[k]; } });
    secs.forEach(function (s) { if (by[s.key]) out.push(s); });
    return out;
  }
  var SECTIONS = orderedSections();
  SECTIONS.forEach(function (s) { (s.steps || []).forEach(function (st, i) { st._id = s.key + "." + hash(st.title + "#" + i); }); });
  var byKey = {}; SECTIONS.forEach(function (s) { byKey[s.key] = s; });
  var PHASE_LIST = SECTIONS.map(function (s) { return s.phase || 3; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });

  /* ---------- progress maths (only required steps count) ---------- */
  function reqSteps(s) { return (s.steps || []).filter(function (x) { return !x.optional; }); }
  function counts(s) { var t = reqSteps(s); return { d: t.filter(function (x) { return done[x._id]; }).length, t: t.length }; }
  function pct(s) { var c = counts(s); return c.t ? Math.round(c.d / c.t * 100) : 0; }
  function overall() { var d = 0, t = 0; SECTIONS.forEach(function (s) { var c = counts(s); d += c.d; t += c.t; }); return { d: d, t: t, pct: t ? Math.round(d / t * 100) : 0 }; }
  function inWave(ph) { return SECTIONS.filter(function (s) { return (s.phase || 3) === ph; }); }
  function wavePct(secs) { var d = 0, t = 0; secs.forEach(function (s) { var c = counts(s); d += c.d; t += c.t; }); return t ? Math.round(d / t * 100) : 0; }
  function hereSection() { for (var i = 0; i < SECTIONS.length; i++) if (pct(SECTIONS[i]) < 100) return SECTIONS[i]; return null; }
  function shortTime(t) { if (!t) return ""; var x = String(t).split(" (")[0].trim(); return x.length > 18 ? x.slice(0, 17) + "…" : x; }
  function laneRank(s) { return s.track === "tech" ? 0 : s.track === "magic" ? 2 : 1; }

  /* ---------- shared: stage badge with game icon ---------- */
  function badgeIco(s, cls) {
    var b = el("div", cls);
    var img = document.createElement("img"); img.src = STAGE_ICON[s.key] || ""; img.alt = ""; img.loading = "lazy"; b.appendChild(img);
    if (pct(s) === 100) b.appendChild(el("span", "done-pip", ico("check")));
    return b;
  }

  /* ---------- ui state ---------- */
  var tab = "map", activeKey = SECTIONS.length ? SECTIONS[0].key : null, query = "";
  var ui = load("ui", {});
  if (ui.active && byKey[ui.active]) activeKey = ui.active;
  if (ui.tab === "stages" || ui.tab === "map") tab = ui.tab;
  function persistUI() { save("ui", { tab: tab, active: activeKey }); }

  /* =========================================================
     MAP view
  ========================================================= */
  function renderMap() {
    var root = $("#view-map"); root.innerHTML = "";
    var wrap = el("div", "wrap");
    if (G.meta && G.meta.wipeBanner && !load("wipeban.18072026", false)) {
      var wb = el("div", "wipe-banner", ico("triangle-alert") + " <b>Вайп!</b> " + esc(G.meta.wipeBanner));
      var wx = el("button", "wipe-x", ico("x")); wx.type = "button"; wx.setAttribute("aria-label", "Скрыть");
      wx.onclick = function () { save("wipeban.18072026", true); wb.remove(); };
      wb.appendChild(wx);
      wrap.appendChild(wb);
    }
    wrap.appendChild(heroNode());
    var waves = el("div", "waves");
    PHASE_LIST.forEach(function (ph) { waves.appendChild(waveNode(ph)); });
    wrap.appendChild(waves);
    wrap.appendChild(serverPanel());
    wrap.appendChild(footer());
    root.appendChild(wrap);
  }

  function heroNode() {
    var o = overall(), here = hereSection();
    var stagesDone = SECTIONS.filter(function (s) { return pct(s) === 100; }).length;
    var hero = el("div", "hero");
    var ring = el("div", "hero-ring");
    ring.style.background = "conic-gradient(var(--brand) " + o.pct + "%, rgba(255,255,255,.06) 0)";
    ring.innerHTML = '<div class="ring-in"><div class="ring-pct">' + o.pct + '%</div><div class="ring-cap">прогресс</div></div>';
    hero.appendChild(ring);
    var info = el("div", "hero-info");
    info.appendChild(el("div", "hero-kicker", "Карта прохождения · реактор сборки"));
    var now = el("div", "hero-now");
    if (here) {
      now.innerHTML = '<span class="now-tag">' + ico("play") + ' сейчас</span>';
      var txt = el("span", "now-txt", "Этап " + (SECTIONS.indexOf(here) + 1) + " — " + esc(here.title));
      txt.onclick = function () { openStage(here.key); };
      now.appendChild(txt);
    } else {
      now.innerHTML = '<span class="now-tag">' + ico("check") + ' готово</span><span class="now-txt">Все этапы закрыты — поздравляю!</span>';
    }
    info.appendChild(now);
    var stats = el("div", "hero-stats");
    stats.appendChild(el("div", "stat", "<b>" + o.d + "<i> / " + o.t + "</i></b><span>шагов выполнено</span>"));
    stats.appendChild(el("div", "stat", "<b>" + stagesDone + "<i> / " + SECTIONS.length + "</i></b><span>этапов закрыто</span>"));
    info.appendChild(stats);
    hero.appendChild(info);
    return hero;
  }

  function waveNode(ph) {
    var w = WAVES[ph] || { name: "Этап " + ph }, secs = inWave(ph), here = hereSection();
    var wave = el("div", "wave");
    var head = el("div", "wave-head");
    head.appendChild(el("span", "wave-no", "Волна " + ph));
    head.appendChild(el("span", "wave-name", esc(w.name)));
    head.appendChild(el("span", "wave-pct", wavePct(secs) + "%"));
    if (secs.some(function (s) { return s.parallel; })) head.appendChild(el("span", "wave-par", ico("arrow-left-right") + " параллельно — вдвоём"));
    wave.appendChild(head);
    if (w.sub) wave.appendChild(el("div", "wave-sub", esc(w.sub)));
    var grid = el("div", "wave-grid");
    secs.slice().sort(function (a, b) { return laneRank(a) - laneRank(b); }).forEach(function (s) { grid.appendChild(mapCard(s, here)); });
    wave.appendChild(grid);
    return wave;
  }

  function mapCard(s, here) {
    var p = pct(s), c = counts(s), idx = SECTIONS.indexOf(s);
    var card = el("div", "scard" + (p === 100 ? " is-done" : "") + (s === here ? " is-here" : ""));
    card.style.setProperty("--c", trackC(s));
    card.tabIndex = 0;
    var top = el("div", "sc-top");
    top.appendChild(badgeIco(s, "badge-ico"));
    top.appendChild(el("span", "sc-branch", trk(s).label));
    top.appendChild(el("span", "sc-num", pad2(idx + 1)));
    if (s === here) top.appendChild(el("span", "sc-here", ico("play") + " ты здесь"));
    if (s.estTime) top.appendChild(el("span", "sc-time", esc(shortTime(s.estTime))));
    card.appendChild(top);
    card.appendChild(el("div", "sc-title", esc(s.title)));
    var foot = el("div", "sc-foot");
    foot.appendChild(el("div", "bar", '<i style="width:' + p + '%"></i>'));
    foot.appendChild(el("span", "sc-step", c.d + "/" + c.t));
    card.appendChild(foot);
    card.onclick = function () { openStage(s.key); };
    card.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStage(s.key); } };
    return card;
  }

  function serverPanel() {
    var m = G.serverMeta, box = el("div", "srv"); if (!m) return box;
    var parts = [["Кратко", m.summary], ["Premium vs VIP", m.premiumVsVip], ["Экономика", m.economy], ["Приват / клейм", m.claims], ["Измерения", m.dimensionsAccess], ["Заметки вайпа", m.wipeNotes]]
      .filter(function (p) { return p[1] && String(p[1]).trim() && p[1] !== "нет данных"; });
    var open = load("srvopen", false);
    var h = el("div", "srv-h"); h.innerHTML = "<h2>" + ico("server") + " Сервер LoliLand · экономика и привилегии</h2>";
    var tg = el("span", "srv-tog", ico(open ? "chevron-down" : "chevron-right")); h.appendChild(tg); box.appendChild(h);
    var body = el("div", "srv-body"); if (!open) body.style.display = "none";
    var grid = el("div", "srv-grid");
    parts.forEach(function (p) { grid.appendChild(el("div", "srv-b", "<h3>" + esc(p[0]) + "</h3><p>" + esc(p[1]) + "</p>")); });
    if (m.commands && m.commands.length) grid.appendChild(el("div", "srv-b", "<h3>Команды</h3><div class='srv-cmds'>" + m.commands.map(function (c) { return "<code>" + esc(c) + "</code>"; }).join("") + "</div>"));
    body.appendChild(grid); box.appendChild(body);
    h.onclick = function () { var o = body.style.display === "none"; body.style.display = o ? "" : "none"; tg.innerHTML = ico(o ? "chevron-down" : "chevron-right"); save("srvopen", o); };
    return box;
  }

  function footer() {
    var f = el("footer", "foot");
    if (G.meta && G.meta.generatedNote) f.appendChild(el("p", null, esc(G.meta.generatedNote)));
    f.appendChild(el("p", null, "Прогресс хранится локально в браузере (localStorage). Точное дерево квестов — на сервере, сверяйся с квест-буком в игре."));
    return f;
  }

  /* =========================================================
     STAGES view
  ========================================================= */
  function renderStages() {
    var root = $("#view-stages"); root.innerHTML = "";
    var wrap = el("div", "stages-wrap");
    wrap.appendChild(sidebarNode());
    wrap.appendChild(detailNode());
    root.appendChild(wrap);
  }

  function matchStage(s, q) {
    if (!q) return true;
    if (s.title.toLowerCase().indexOf(q) >= 0) return true;
    return (s.steps || []).some(function (st) { return ((st.title || "") + " " + (st.detail || "") + " " + (st.items || []).join(" ")).toLowerCase().indexOf(q) >= 0; });
  }

  function sidebarNode() {
    var aside = el("aside", "sidebar"), inn = el("div", "sidebar-in");
    inn.appendChild(el("div", "sidebar-h", ico("list-ordered") + " Все этапы"));
    var any = false;
    PHASE_LIST.forEach(function (ph) {
      var secs = inWave(ph).filter(function (s) { return matchStage(s, query); });
      if (!secs.length) return;
      any = true;
      var w = WAVES[ph] || { name: "Этап " + ph };
      inn.appendChild(el("div", "side-wave", "Волна " + ph + " · " + esc(w.name)));
      secs.forEach(function (s) { inn.appendChild(sideItem(s)); });
    });
    if (!any) inn.appendChild(el("div", "side-empty", "Ничего не найдено"));
    aside.appendChild(inn);
    return aside;
  }

  function sideItem(s) {
    var p = pct(s);
    var it = el("div", "side-item" + (p === 100 ? " is-done" : "") + (activeKey === s.key ? " active" : ""));
    it.style.setProperty("--c", trackC(s));
    it.appendChild(badgeIco(s, "side-badge"));
    var main = el("div", "side-main");
    main.appendChild(el("div", "side-title", esc(s.title)));
    var prog = el("div", "side-prog");
    prog.appendChild(el("div", "bar", '<i style="width:' + p + '%"></i>'));
    prog.appendChild(el("span", null, p + "%"));
    main.appendChild(prog);
    it.appendChild(main);
    it.onclick = function () { openStage(s.key); };
    return it;
  }

  function detailNode() {
    var s = byKey[activeKey] || SECTIONS[0]; activeKey = s.key;
    var d = el("div", "detail");
    var crumb = el("div", "crumb");
    var back = el("button", "back", ico("arrow-left") + " Карта");
    back.type = "button"; back.onclick = function () { tab = "map"; setTab("map"); renderMap(); persistUI(); locHash("map"); window.scrollTo(0, 0); };
    crumb.appendChild(back);
    crumb.appendChild(el("span", "sep", "/"));
    crumb.appendChild(el("span", null, "Волна " + (s.phase || 3) + " · " + esc(((WAVES[s.phase] || {}).name) || "")));
    d.appendChild(crumb);
    d.appendChild(stageHeader(s));
    var tasks = el("div", "tasks"); tasks.style.setProperty("--c", trackC(s));
    (s.steps || []).forEach(function (st, i) { tasks.appendChild(taskNode(s, st, i)); });
    d.appendChild(tasks);
    (G.milestones || []).filter(function (m) { return m.at === s.key; }).forEach(function (m) { d.appendChild(el("div", "milestone", ico("flag") + " " + esc(m.label))); });
    d.appendChild(stageNav(s));
    return d;
  }

  function stageHeader(s) {
    var idx = SECTIONS.indexOf(s), c = counts(s), p = pct(s);
    var head = el("div", "stage-head"); head.style.setProperty("--c", trackC(s));
    var top = el("div", "stage-head-top");
    var badge = badgeIco(s, "stage-badge"); badge.appendChild(el("span", "snum", String(idx + 1)));
    top.appendChild(badge);
    top.appendChild(el("h1", "stage-h1", esc(s.title)));
    head.appendChild(top);
    var badges = el("div", "stage-badges");
    badges.appendChild(el("span", "pill pill-branch", trk(s).label));
    var r = roleOf(s.track); badges.appendChild(el("span", "pill pill-role", ico(r.i) + " Роль: " + r.l));
    if (s.questGroupGuess && s.questGroupGuess.trim()) badges.appendChild(el("span", "pill pill-soft", ico("flag") + " " + esc(s.questGroupGuess)));
    if (s.estTime) badges.appendChild(el("span", "pill pill-soft", ico("timer") + " " + esc(s.estTime)));
    if (s.parallel) badges.appendChild(el("span", "pill pill-par", ico("arrow-left-right") + " параллельный этап — оба игрока"));
    head.appendChild(badges);
    if (s.intro) head.appendChild(el("div", "stage-intro", esc(s.intro)));
    var prog = el("div", "stage-prog");
    prog.appendChild(el("div", "bar", '<i style="width:' + p + '%"></i>'));
    prog.appendChild(el("span", "sp-pct", p + "%"));
    prog.appendChild(el("span", "sp-cnt", c.d + " / " + c.t + " шагов"));
    head.appendChild(prog);
    return head;
  }

  function taskNode(s, st, i) {
    var node = el("div", "task" + (done[st._id] ? " done" : "") + (st.optional ? " optional" : ""));
    var row = el("div", "task-row");
    var box = el("button", "task-box", ico("check")); box.type = "button"; box.setAttribute("aria-pressed", done[st._id] ? "true" : "false"); box.setAttribute("aria-label", "Отметить шаг выполненным");
    box.onclick = function () { toggle(st, node, box); };
    row.appendChild(box);
    var body = el("div", "task-body");
    var head = el("div", "task-head");
    head.appendChild(el("span", "task-idx", String(i + 1)));
    head.appendChild(el("span", "task-title", esc(st.title)));
    if (st.optional) head.appendChild(el("span", "task-opt-tag", "по желанию"));
    head.onclick = function () { toggle(st, node, box); };
    body.appendChild(head);
    if (st.detail) body.appendChild(el("p", "task-desc", esc(st.detail)));
    if (st.items && st.items.length) { var ch = el("div", "chips"); st.items.forEach(function (it) { ch.appendChild(chipNode(it)); }); body.appendChild(ch); }
    if (st.serverNote && String(st.serverNote).trim()) body.appendChild(noteBox("srv", "server", "Сервер", st.serverNote));
    if (st.coop && String(st.coop).trim()) body.appendChild(noteBox("coop", "users", "Кооп", st.coop));
    if (st.opt && String(st.opt).trim()) body.appendChild(noteBox("opt", "zap", "Оптимизация", st.opt));
    if (st.kit && String(st.kit).trim()) body.appendChild(noteBox("kit", "package", "С привилегией", st.kit));
    if (st.trap && String(st.trap).trim()) body.appendChild(noteBox("trap", "triangle-alert", "Грабли — не повторяй", st.trap));
    if (st.skip && String(st.skip).trim()) body.appendChild(noteBox("skip", "scissors", "Скип", st.skip));
    if (st.trick && String(st.trick).trim()) body.appendChild(noteBox("trick", "zap", "Хитрость / дюп", st.trick));
    if (st.tipv && String(st.tipv).trim()) body.appendChild(noteBox("tipv", "lightbulb", "Совет из комментов", st.tipv));
    var tools = el("div", "task-tools");
    var nb = el("button", "note-btn"); nb.type = "button"; nb.innerHTML = (notes[st._id] ? ico("square-pen") : ico("pencil")) + " заметка";
    var ta = el("textarea", "mynote" + (notes[st._id] ? " show" : "")); ta.placeholder = "Личная заметка к шагу…"; ta.value = notes[st._id] || "";
    ta.oninput = function () { notes[st._id] = ta.value; save("notes", notes); };
    nb.onclick = function () { ta.classList.toggle("show"); if (ta.classList.contains("show")) ta.focus(); };
    tools.appendChild(nb); body.appendChild(tools); body.appendChild(ta);
    row.appendChild(body); node.appendChild(row);
    return node;
  }
  function noteBox(kind, icoName, label, text) { return el("div", "note note-" + kind, "<b>" + ico(icoName) + " " + label + ":</b> " + esc(text)); }
  var ITEM_ICONS = window.ITEM_ICONS || {};
  function chipNode(name) {
    var c = el("span", "chip"), p = ITEM_ICONS[name];
    if (p) { var im = document.createElement("img"); im.className = "chip-ico" + (p.indexOf("__iso") >= 0 ? " iso" : ""); im.src = p; im.alt = ""; im.loading = "lazy"; c.appendChild(im); c.className = "chip has-ico"; }
    c.appendChild(document.createTextNode(name));
    return c;
  }

  function toggle(st, node, box) {
    if (done[st._id]) delete done[st._id]; else done[st._id] = true;
    save("done", done);
    node.classList.toggle("done", !!done[st._id]);
    box.setAttribute("aria-pressed", done[st._id] ? "true" : "false");
    partialRefresh();
  }

  function stageNav(s) {
    var idx = SECTIONS.indexOf(s), nav = el("div", "stage-nav");
    if (idx > 0) { var pv = SECTIONS[idx - 1]; var b = el("button", null, ico("arrow-left") + "<span>" + esc(pv.title) + "</span>"); b.type = "button"; b.onclick = function () { openStage(pv.key); }; nav.appendChild(b); }
    else nav.appendChild(el("div", "spacer"));
    if (idx < SECTIONS.length - 1) { var nx = SECTIONS[idx + 1]; var b2 = el("button", "next", "<span>" + esc(nx.title) + "</span>" + ico("arrow-right")); b2.type = "button"; b2.onclick = function () { openStage(nx.key); }; nav.appendChild(b2); }
    else nav.appendChild(el("div", "spacer"));
    return nav;
  }

  /* ---------- partial refresh after a toggle (keep focus/scroll) ---------- */
  function partialRefresh() {
    refreshProgress();
    if (tab !== "stages") return;
    var s = byKey[activeKey];
    var head = $(".stage-head");
    if (head && s) {
      var c = counts(s), p = pct(s);
      var bi = head.querySelector(".bar i"); if (bi) bi.style.width = p + "%";
      var pc = head.querySelector(".sp-pct"); if (pc) pc.textContent = p + "%";
      var cn = head.querySelector(".sp-cnt"); if (cn) cn.textContent = c.d + " / " + c.t + " шагов";
      var badge = head.querySelector(".stage-badge");
      if (badge) { var pip = badge.querySelector(".done-pip"); if (p === 100 && !pip) badge.appendChild(el("span", "done-pip", ico("check"))); else if (p < 100 && pip) pip.remove(); }
    }
    var sb = $(".sidebar"); if (sb) sb.replaceWith(sidebarNode());
  }

  /* =========================================================
     reset modal (themed)
  ========================================================= */
  function countNotes() { var n = 0; for (var k in notes) if (notes[k] && String(notes[k]).trim()) n++; return n; }
  function openResetModal() {
    var o = overall(), nn = countNotes();
    var back = el("div", "modal-backdrop");
    var m = el("div", "modal");
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML =
      '<div class="modal-ico">' + ico("rotate-ccw") + '</div>' +
      '<h3>Сбросить весь прогресс?</h3>' +
      '<p>Будут сняты все отметки выполнения' + (nn ? ' и удалены личные заметки' : '') + ' по всем шагам. Действие необратимо.</p>' +
      '<p class="modal-meta">Сейчас отмечено: ' + o.d + ' / ' + o.t + ' шагов' + (nn ? ' · заметок: ' + nn : '') + '</p>' +
      '<div class="modal-actions"><button class="btn-cancel" type="button">Отмена</button><button class="btn-danger" type="button">Сбросить</button></div>';
    back.appendChild(m); $("#modal-root").appendChild(back);
    var cancel = m.querySelector(".btn-cancel"), confirm = m.querySelector(".btn-danger");
    function close() { back.remove(); document.removeEventListener("keydown", onKey); $("#reset").focus(); }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } else if (e.key === "Enter") { e.preventDefault(); doReset(); close(); } }
    cancel.onclick = close;
    confirm.onclick = function () { doReset(); close(); };
    back.onclick = function (e) { if (e.target === back) close(); };
    document.addEventListener("keydown", onKey);
    confirm.focus();
  }
  function doReset() { done = {}; notes = {}; save("done", {}); save("notes", {}); render(); refreshProgress(); }

  /* =========================================================
     shell: tabs, progress, routing
  ========================================================= */
  function refreshProgress() {
    var o = overall();
    $("#overall-bar").style.width = o.pct + "%";
    $("#overall-pct").textContent = o.pct + "%";
    $("#overall-count").textContent = o.d + " / " + o.t + " шагов";
  }
  function setTab(t) {
    tab = t;
    $("#view-map").classList.toggle("hidden", t !== "map");
    $("#view-stages").classList.toggle("hidden", t !== "stages");
    $("#tabs").querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === t); });
  }
  function render() { if (tab === "map") renderMap(); else renderStages(); refreshProgress(); }
  function openStage(key) { activeKey = key; setTab("stages"); renderStages(); refreshProgress(); persistUI(); locHash("s=" + encodeURIComponent(key)); window.scrollTo(0, 0); }

  function locHash(h) { try { history.replaceState(null, "", "#" + h); } catch (e) {} }
  function applyHash() {
    var h = location.hash || "";
    if (/^#stages/.test(h)) tab = "stages";
    else if (/^#map/.test(h)) tab = "map";
    var m = h.match(/^#s=(.+)$/);
    if (m) { var k = decodeURIComponent(m[1]); if (byKey[k]) { tab = "stages"; activeKey = k; } }
    setTab(tab); render();
  }

  function wire() {
    $("#tabs").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { setTab(b.dataset.tab); render(); persistUI(); locHash(b.dataset.tab); window.scrollTo(0, 0); };
    });
    $("#search").oninput = function (e) {
      query = e.target.value.trim().toLowerCase();
      if (query && tab !== "stages") setTab("stages");
      if (tab === "stages") { var sb = $(".sidebar"); if (sb) sb.replaceWith(sidebarNode()); else renderStages(); }
    };
    $("#reset").onclick = openResetModal;
    if (G.meta && G.meta.version) $("#pack-ver").textContent = "Чеклист · LoliLand · пак " + G.meta.version;
    window.addEventListener("hashchange", applyHash);
  }

  /* ---------- boot ---------- */
  wire();
  if (location.hash) applyHash(); else { setTab(tab); render(); }
  refreshProgress();

  /* used by external tools / future craft links */
  window.tmDoneItems = function () {
    var out = {};
    SECTIONS.forEach(function (s) { (s.steps || []).forEach(function (st) { if (done[st._id]) (st.items || []).forEach(function (it) { out[String(it).toLowerCase()] = 1; }); }); });
    return out;
  };
})();

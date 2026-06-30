/* Craft pyramid — compact vertical indented tree with in-game icons. Per-goal, lazy, fast. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.innerHTML = x; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]; }); }
  function ico(name) { return '<svg class="ico"><use href="#i-' + name + '"/></svg>'; }
  var DONE = {};

  /* dual palette: tech=circuit, magic=arcane, blood/dragon=ichor, gaia=moss, goal=ember */
  var CAT = { energetics: "#36d1dc", energy: "#36d1dc", neutronium: "#36d1dc", matter: "#36d1dc", molecular: "#36d1dc", energon: "#36d1dc",
    magic: "#b388ff", infinity: "#b388ff", chaotic: "#b388ff",
    dragons: "#ff5470", blood: "#ff5470", gaia: "#9be15d", goal: "#ffd166" };
  function color(n) { if (n && n.kind === "goal") return "#ffd166"; return CAT[n && n.category] || "#8aa0c8"; }
  var KIND = { raw: "сырьё", intermediate: "", component: "компонент", machine: "машина", goal: "цель" };

  var C, byId, ingr, ICONS;
  function init() {
    C = window.CRAFT || { nodes: [], edges: [] }; ICONS = C.icons || {};
    byId = {}; ingr = {};
    C.nodes.forEach(function (n) { byId[n.id] = n; });
    C.edges.forEach(function (e) { if (byId[e.from] && byId[e.to]) { (ingr[e.to] = ingr[e.to] || []); if (ingr[e.to].indexOf(e.from) < 0) ingr[e.to].push(e.from); } });
  }

  function rowFor(id, path) {
    var n = byId[id] || { id: id, label: id };
    var kids = (ingr[id] || []).filter(function (x) { return byId[x]; });
    var inPath = path.indexOf(id) >= 0;
    var canExp = kids.length > 0 && !inPath;

    var crafted = !!DONE[String(n.label || "").toLowerCase()];
    var li = el("li", "ct2-li");
    var r = el("div", "ct2-row" + (crafted ? " is-crafted" : ""));
    r.appendChild(el("span", "ct2-tog", ico(canExp ? "chevron-right" : (kids.length ? "corner-left-up" : "circle-dot"))));
    if (ICONS[id]) { var img = document.createElement("img"); img.className = "ct2-ico"; img.src = ICONS[id]; img.loading = "lazy"; img.alt = ""; r.appendChild(img); }
    else { var d = el("span", "ct2-dot"); d.style.background = color(n); r.appendChild(d); }
    r.appendChild(el("span", "ct2-lbl" + (n.kind === "goal" ? " goal" : ""), esc(n.label || id)));
    if (kids.length) r.appendChild(el("span", "ct2-cnt", "×" + kids.length));
    if (typeof n.tier === "number") r.appendChild(el("span", "ct2-tier st" + (n.stage || 1), "T" + n.tier));
    if (n.kind && KIND[n.kind]) r.appendChild(el("span", "ct2-kind", KIND[n.kind]));
    if (n.station) { var stn = el("span", "ct2-stn", ico("settings") + esc(n.station)); stn.title = "Крафтится в: " + n.station; r.appendChild(stn); }
    if (inPath && kids.length) r.appendChild(el("span", "ct2-flag", ico("corner-left-up") + " выше по ветке"));
    li.appendChild(r);
    if (n.source) li.appendChild(el("div", "ct2-src" + (kids.length ? "" : " leaf"), ico("corner-down-right") + esc(n.source)));

    var ul = el("ul", "ct2-ul"); ul.style.display = "none"; li.appendChild(ul);
    var tog = r.firstChild, built = false;
    function expand() { if (!built) { kids.forEach(function (k) { ul.appendChild(rowFor(k, path.concat(id))); }); built = true; } ul.style.display = ""; tog.innerHTML = ico("chevron-down"); }
    function collapse() { ul.style.display = "none"; tog.innerHTML = ico("chevron-right"); }
    if (canExp) { r.style.cursor = "pointer"; r.onclick = function () { ul.style.display === "none" ? expand() : collapse(); }; li._expand = expand; li._collapse = collapse; }
    r.dataset.label = (n.label || id).toLowerCase();
    return li;
  }

  function expandAll(li, cap) {
    if (cap.n <= 0) return;
    if (li._expand) { li._expand(); cap.n--; }
    var ul = li.querySelector(":scope > ul.ct2-ul");
    if (ul) Array.prototype.forEach.call(ul.children, function (c) { expandAll(c, cap); });
  }

  window.renderCraft = function (goalId) {
    var root = $("#view-craft"); if (!root) return;
    init(); root.innerHTML = "";
    DONE = (window.tmDoneItems && window.tmDoneItems()) || {};
    if (!C.nodes.length) { root.appendChild(el("div", "ct-empty", ico("git-fork") + " Дерево крафтов ещё генерируется. Загляни позже.")); return; }

    var goals = C.nodes.filter(function (n) { return n.kind === "goal"; });
    if (!goals.length) goals = C.nodes.filter(function (n) { return !C.edges.some(function (e) { return e.from === n.id; }); });
    goals.sort(function (a, b) { return (b.tier || 0) - (a.tier || 0); });

    root.appendChild(el("h2", "ct-h2", ico("git-fork") + " Пирамида крафта"));
    root.appendChild(el("p", "ct-note", "Выбери цель — дерево покажет, из чего она крафтится, по уровням вниз до сырья. Клик по строке — раскрыть/свернуть. Иконки — из игры. " +
      "Точных количеств (N×) кэш не отдаёт — ×N показывает число ингредиентов, не штук."));

    var bar = el("div", "ct-bar");
    var left = el("div", "ct-chips");
    left.appendChild(el("span", "ct-sel-lbl", "Цель:"));
    var sel = el("select", "ct-goalsel");
    var byStage = {};
    goals.forEach(function (g) { var k = g.stage || 5; (byStage[k] = byStage[k] || []).push(g); });
    Object.keys(byStage).sort(function (a, b) { return a - b; }).forEach(function (st) {
      var og = document.createElement("optgroup");
      og.label = "Этап " + st + " · " + ((byStage[st][0] && byStage[st][0].stageName) || "");
      byStage[st].forEach(function (g) { var o = document.createElement("option"); o.value = g.id; o.textContent = (g.label || g.id); og.appendChild(o); });
      sel.appendChild(og);
    });
    left.appendChild(sel);
    bar.appendChild(left);
    var tools = el("div", "ct-tools");
    var filter = el("input", "ct-filter"); filter.type = "search"; filter.placeholder = "Подсветить предмет…";
    var expB = el("button", "ghost", "Развернуть всё"); var colB = el("button", "ghost", "Свернуть");
    tools.appendChild(filter); tools.appendChild(expB); tools.appendChild(colB);
    bar.appendChild(tools);
    root.appendChild(bar);

    var legend = el("div", "ct-legend");
    legend.innerHTML = '<span><i class="ct-dot" style="background:#36d1dc"></i>техника / материя</span>' +
      '<span><i class="ct-dot" style="background:#b388ff"></i>магия / бесконечность</span>' +
      '<span><i class="ct-dot" style="background:#ff5470"></i>драконы / кровь</span>' +
      '<span><i class="ct-dot" style="background:#9be15d"></i>Гайя</span>' +
      '<span><i class="ct-dot" style="background:#ffd166"></i>цель</span>' +
      '<span class="ct-leg-done">' + ico("check") + ' собрано (отмечено в чеклисте)</span>' +
      '<span id="ct-info" class="ct-infospan"></span>';
    root.appendChild(legend);

    var stageBar = el("div", "ct-stage"); root.appendChild(stageBar);
    var wrap = el("div", "ct2-wrap"); root.appendChild(wrap);
    var ul = el("ul", "ct2-ul ct2-root"); wrap.appendChild(ul);

    var STAGE_COL = { 1: "var(--steel)", 2: "var(--circuit)", 3: "var(--ichor)", 4: "var(--arcane)", 5: "var(--ember)" };
    function show(id) {
      ul.innerHTML = ""; filter.value = "";
      var g = byId[id] || {};
      stageBar.innerHTML = ico("layers") + "Этап " + (g.stage || "?") + " · " + esc(g.stageName || "") + "  —  цель: <b>" + esc(g.label || id) + "</b>";
      stageBar.style.setProperty("--stcol", STAGE_COL[g.stage || 5]);
      var li = rowFor(id, []); ul.appendChild(li);
      if (li._expand) { li._expand(); /* auto-open one more level */
        var sub = li.querySelector(":scope > ul.ct2-ul");
        if (sub) Array.prototype.forEach.call(sub.children, function (c) { if (c._expand) c._expand(); });
      }
      info();
    }
    function info() { var i = $("#ct-info"); if (i) i.textContent = "Строк показано: " + wrap.querySelectorAll(".ct2-row").length; }

    sel.onchange = function () { show(sel.value); };
    expB.onclick = function () { var cap = { n: 600 }; Array.prototype.forEach.call(ul.children, function (li) { expandAll(li, cap); }); info(); if (cap.n <= 0) { var i = $("#ct-info"); if (i) i.textContent += " (показан предел 600 — сверни лишнее)"; } };
    colB.onclick = function () { show(sel.value); };
    filter.oninput = function () {
      var q = filter.value.trim().toLowerCase(); var hits = 0;
      wrap.querySelectorAll(".ct2-row").forEach(function (r) { var h = q && r.dataset.label.indexOf(q) >= 0; r.classList.toggle("ct2-hit", !!h); if (h) hits++; });
      var i = $("#ct-info"); if (i) i.textContent = q ? ("найдено среди раскрытых: " + hits + " (жми «Развернуть всё» для полного поиска)") : ("Строк показано: " + wrap.querySelectorAll(".ct2-row").length);
    };

    var pref = goals.filter(function (g) { return /sparkling_panel|искрящ.*панел/i.test(g.label + g.id); })[0]
      || goals.filter(function (g) { return /разрушител|infinity_pickaxe|сердце повелител/i.test(g.label + g.id); })[0];
    var want = (goalId && goals.some(function (g) { return g.id === goalId; })) ? goalId : (pref || goals[0]).id;
    sel.value = want; show(want);
  };
})();

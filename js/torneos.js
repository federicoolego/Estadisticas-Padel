// ===== Torneos Stats Dashboard =====
(function () {
  const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Etapas en orden progresivo
  const ETAPAS = ["zona", "octavos", "cuartos", "semifinal", "final"];
  const ETAPA_LABEL = {
    zona: "Zona",
    octavos: "Octavos",
    cuartos: "Cuartos",
    semifinal: "Semifinal",
    final: "Final",
    campeon: "Campeón"
  };
  const PUESTO_LABEL = {
    campeon: "🥇 Campeón",
    subcampeon: "🥈 Subcampeón",
    tercero: "🥉 Tercero"
  };

  let ALL = [];
  let charts = {};
  let initialized = false;

  const filters = { companiero: [], organizador: [], categoria: [], anio: [], mes: [], puesto: [], lastN: null };
  const combos = {};

  const el = (id) => document.getElementById(id);

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      ALL = await window.APP_ENV.loadTable("torneos");
    } catch (e) {
      console.error("Error cargando torneos:", e);
      const envMsg = window.APP_ENV && window.APP_ENV.isProd
        ? "No se pudieron cargar los torneos desde Supabase. Revisá la consola."
        : 'No se pudo cargar data/torneos.json. Si abriste el archivo directamente, servilo con un servidor local (ej: <code>python -m http.server</code>).';
      const cont = document.getElementById("tab-torneos");
      if (cont) cont.innerHTML = `<p class="empty">${envMsg}</p>`;
      return;
    }
    buildFilterOptions();
    bindFilters();
    renderLastUpdate();
    render();
  }

  function renderLastUpdate() {
    if (!ALL.length) return;
    const last = [...ALL].sort((a, b) => a.id - b.id)[ALL.length - 1];
    const [y, mo, d] = last.fecha.split("-");
    el("t-last-update").textContent = `Última actualización: ${d}/${mo}/${y}`;
  }

  function uniqueSorted(key) {
    return [...new Set(ALL.map(m => m[key]).filter(v => v !== null && v !== undefined && v !== ""))]
      .sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  }

  function buildFilterOptions() {
    setupCombo("t-combo-anio", uniqueSorted("anio").map(v => [String(v), String(v)]), "anio", "Todos");
    setupCombo("t-combo-mes", uniqueSorted("mes").map(n => [String(n), MESES[n]]), "mes", "Todos");
    setupCombo("t-combo-organizador", uniqueSorted("organizador").map(v => [v, v]), "organizador", "Todos");
    setupCombo("t-combo-categoria", uniqueSorted("categoria").map(v => [v, v]), "categoria", "Todas");
    setupCombo("t-combo-companiero", uniqueSorted("companiero").map(v => [v, v]), "companiero", "Todos");
    // Puesto: incluye "sin_podio" para representar los que no obtuvieron medalla
    const puestos = [];
    if (ALL.some(t => t.puesto === "campeon")) puestos.push(["campeon", "🥇 Campeón"]);
    if (ALL.some(t => t.puesto === "subcampeon")) puestos.push(["subcampeon", "🥈 Subcampeón"]);
    if (ALL.some(t => t.puesto === "tercero")) puestos.push(["tercero", "🥉 Tercero"]);
    if (ALL.some(t => !t.puesto)) puestos.push(["sin_podio", "Sin podio"]);
    setupCombo("t-combo-puesto", puestos, "puesto", "Todos");
  }

  function setupCombo(comboId, items, filterKey, placeholder) {
    const root = el(comboId);
    if (!root) return;
    const input = root.querySelector(".combo-input");
    const search = root.querySelector(".combo-search");
    const list = root.querySelector(".combo-list");
    const hasSearch = root.dataset.search === "1";

    combos[comboId] = { root, input, search, list, filterKey, placeholder, items, hasSearch };

    input.addEventListener("click", () => toggleCombo(comboId));
    if (search) search.addEventListener("input", () => renderComboList(comboId, search.value));
    renderComboList(comboId, "");
    updateComboInput(comboId);
  }

  function renderComboList(comboId, q) {
    const c = combos[comboId];
    const query = (q || "").trim().toLowerCase();
    const sel = filters[c.filterKey];
    const filtered = c.items.filter(([, label]) => label.toLowerCase().includes(query));

    let html = `<li class="combo-opt combo-all" data-val="__all">
        <span class="chk${sel.length === 0 ? " on" : ""}"></span>Todos</li>`;
    html += filtered.map(([val, label]) => {
      const on = sel.includes(val);
      return `<li class="combo-opt" data-val="${String(val).replace(/"/g, "&quot;")}">
        <span class="chk${on ? " on" : ""}"></span>${label}</li>`;
    }).join("");
    if (!filtered.length) html += '<li class="combo-empty">Sin resultados</li>';
    c.list.innerHTML = html;

    c.list.querySelectorAll(".combo-opt").forEach(li => {
      li.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const val = li.getAttribute("data-val");
        if (val === "__all") {
          filters[c.filterKey] = [];
        } else {
          const arr = filters[c.filterKey];
          const i = arr.indexOf(val);
          if (i === -1) arr.push(val); else arr.splice(i, 1);
        }
        renderComboList(comboId, c.hasSearch && c.search ? c.search.value : "");
        updateComboInput(comboId);
        render();
      });
    });
  }

  function updateComboInput(comboId) {
    const c = combos[comboId];
    const sel = filters[c.filterKey];
    if (sel.length === 0) {
      c.input.value = "";
      c.input.placeholder = c.placeholder;
    } else {
      const labels = sel.map(v => {
        const found = c.items.find(([val]) => val === v);
        return found ? found[1] : v;
      });
      c.input.value = labels.length <= 2 ? labels.join(", ") : `${labels.length} seleccionados`;
    }
  }

  function toggleCombo(comboId) {
    const c = combos[comboId];
    const open = c.root.classList.contains("open");
    closeAllCombos();
    if (!open) {
      c.root.classList.add("open");
      if (c.hasSearch && c.search) {
        c.search.value = "";
        renderComboList(comboId, "");
        setTimeout(() => c.search.focus(), 0);
      }
    }
  }
  function closeCombo(comboId) { combos[comboId].root.classList.remove("open"); }
  function closeAllCombos() { Object.keys(combos).forEach(closeCombo); }

  document.addEventListener("click", e => {
    if (!e.target.closest("#tab-torneos .combo")) return;
    // Cerrar solo los combos de torneos que NO son el target
    Object.keys(combos).forEach(id => {
      if (!e.target.closest(`#${id}`)) closeCombo(id);
    });
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#tab-torneos")) return;
    if (!e.target.closest(".combo")) closeAllCombos();
  });

  function bindFilters() {
    const lastNInput = el("t-last-n");
    if (lastNInput) {
      lastNInput.addEventListener("input", () => {
        let v = parseInt(lastNInput.value, 10);
        if (isNaN(v) || v <= 0) {
          filters.lastN = null;
        } else {
          if (v > 100) { v = 100; lastNInput.value = "100"; }
          filters.lastN = v;
        }
        render();
      });
    }
    el("t-reset").addEventListener("click", () => {
      Object.keys(filters).forEach(k => {
        if (k === "lastN") filters[k] = null;
        else filters[k] = [];
      });
      Object.keys(combos).forEach(id => {
        if (combos[id].search) combos[id].search.value = "";
        updateComboInput(id);
        renderComboList(id, "");
      });
      if (lastNInput) lastNInput.value = "";
      closeAllCombos();
      render();
    });
  }

  function matchPuesto(t, selected) {
    if (!selected.length) return true;
    const val = t.puesto || "sin_podio";
    return selected.includes(val);
  }

  function applyFilters() {
    const f = filters;
    let list = ALL.filter(t =>
      (!f.companiero.length || f.companiero.includes(t.companiero)) &&
      (!f.organizador.length || f.organizador.includes(t.organizador)) &&
      (!f.categoria.length || f.categoria.includes(t.categoria)) &&
      (!f.anio.length || f.anio.includes(String(t.anio))) &&
      (!f.mes.length || f.mes.includes(String(t.mes))) &&
      matchPuesto(t, f.puesto)
    );
    if (f.lastN && f.lastN > 0) {
      list = [...list].sort((a, b) => b.id - a.id).slice(0, f.lastN);
    }
    return list;
  }

  // Instancia máxima alcanzada: la última etapa con valor no null.
  // Si en esa etapa hubo victoria (true) y no hay siguiente, y es "final" con puesto=campeon → "campeon".
  function instanciaMaxima(t) {
    if (t.puesto === "campeon") return "campeon";
    let ultima = null;
    for (const et of ETAPAS) {
      if (t[et] !== null && t[et] !== undefined) ultima = et;
    }
    return ultima; // puede ser null si no jugó nada
  }

  function render() {
    const data = applyFilters();
    renderKPIs(data);
    renderRecord(data);
    renderCharts(data);
    renderTable(data);
  }

  function stats(list) {
    const tj = list.length;
    const campeon = list.filter(t => t.puesto === "campeon").length;
    const subcampeon = list.filter(t => t.puesto === "subcampeon").length;
    const tercero = list.filter(t => t.puesto === "tercero").length;
    const podios = campeon + subcampeon + tercero;
    const eff = tj ? podios / tj : 0;
    const finalesJugadas = list.filter(t => t.final === true || t.final === false).length;
    const semisAlcanzadas = list.filter(t =>
      t.semifinal === true || t.semifinal === false ||
      t.final === true || t.final === false || t.puesto === "campeon"
    ).length;
    return { tj, campeon, subcampeon, tercero, podios, eff, finalesJugadas, semisAlcanzadas };
  }

  function renderRecord(data) {
  const s = stats(data);
  const sinPodio = s.tj - s.podios;
  el("t-record").innerHTML =
    `<span class="w">${s.campeon}</span>` +
    `<span class="sep">/</span>` +
    `<span class="m">${s.subcampeon}</span>` +
    `<span class="sep">/</span>` +
    `<span class="l">${sinPodio}</span>`;
  const totalEl = el("t-record-total");
  if (totalEl) totalEl.textContent = s.tj;
}

  function renderKPIs(data) {
    const s = stats(data);
    el("t-kpi-tj").textContent = s.tj;
    el("t-kpi-camp").textContent = s.campeon;
    el("t-kpi-sub").textContent = s.subcampeon;
    el("t-kpi-podios").textContent = s.podios;
    el("t-kpi-eff").innerHTML = (s.eff * 100).toFixed(1) + "<small>%</small>";
    el("t-kpi-finales").textContent = s.finalesJugadas;
    el("t-kpi-semis").textContent = s.semisAlcanzadas;

    // Instancia más frecuente
    const counts = {};
    data.forEach(t => {
      const inst = instanciaMaxima(t);
      if (inst) counts[inst] = (counts[inst] || 0) + 1;
    });
    let maxInst = null, maxCount = 0;
    Object.entries(counts).forEach(([k, v]) => {
      if (v > maxCount) { maxCount = v; maxInst = k; }
    });
    el("t-kpi-inst").innerHTML = maxInst
      ? `${ETAPA_LABEL[maxInst]}<small> (${maxCount})</small>`
      : "–";
  }

  function renderTable(data) {
    const tbody = el("t-tabla-body");
    const rows = [...data].sort((a, b) => a.id - b.id);
    el("t-tabla-count").textContent = `${rows.length} torneo${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay torneos con estos filtros.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(t => {
      const [y, mo, d] = t.fecha.split("-");
      const inst = instanciaMaxima(t);
      const instLabel = inst ? ETAPA_LABEL[inst] : "—";
      let puestoBadge = "—";
      if (t.puesto === "campeon") puestoBadge = '<span class="badge b-gold">🥇 Campeón</span>';
      else if (t.puesto === "subcampeon") puestoBadge = '<span class="badge b-silver">🥈 Subcamp.</span>';
      else if (t.puesto === "tercero") puestoBadge = '<span class="badge b-bronze">🥉 Tercero</span>';
      return `<tr data-id="${t.id}">
        <td class="c-num">${t.id}</td>
        <td>${d}/${mo}/${y}</td>
        <td>${t.organizador || "—"}</td>
        <td>${t.companiero || "—"}</td>
        <td>${t.categoria || "—"}</td>
        <td>${instLabel}</td>
        <td class="c-res">${puestoBadge}</td>
      </tr>`;
    }).join("");
  }

  // ---- Charts ----
  // GRID / TICK dependen del tema (claro / oscuro) → se recalculan en applyPalette()
  let GRID = "#2a313c", TICK = "#8b949e";
  const WIN = "#4ade80", LOSS = "#f87171";
  function applyPalette() {
    const c = window.THEME ? window.THEME.colors() : null;
    if (c) { GRID = c.grid; TICK = c.tick; }
  }
  applyPalette();
  document.addEventListener("themechange", () => {
    applyPalette();
    if (initialized && ALL.length) renderCharts(applyFilters());
  });
  const WIN_DARK = "#15803d";
  const GOLD = "#fbbf24", SILVER = "#cbd5e1", BRONZE = "#d97706";

  function destroyChart(k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } }

  function baseOpts(extra = {}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, padding: 14 } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: { grid: { color: GRID }, ticks: { color: TICK }, beginAtZero: true }
      }
    }, extra);
  }

  function effColor(v) { return v >= 50 ? "#15803d" : "#b91c1c"; }

  function renderCharts(data) {
    // Gráfico apilado: campeón / subcampeón / tercero / sin podio + línea % podios
    const comboBar = (canvasId, chartKey, opts) => {
      const groups = {};
      data.forEach(t => {
        const g = opts.groupBy(t);
        if (g == null || g === "") return;
        groups[g] = groups[g] || { camp: 0, sub: 0, ter: 0, sinPodio: 0 };
        if (t.puesto === "campeon") groups[g].camp++;
        else if (t.puesto === "subcampeon") groups[g].sub++;
        else if (t.puesto === "tercero") groups[g].ter++;
        else groups[g].sinPodio++;
      });
      let keys = Object.keys(groups);
      if (opts.order === "cronologico") {
        keys.sort();
      } else {
        keys.sort((a, b) => {
          const ta = groups[a].camp + groups[a].sub + groups[a].ter + groups[a].sinPodio;
          const tb = groups[b].camp + groups[b].sub + groups[b].ter + groups[b].sinPodio;
          return tb - ta;
        });
      }
      const labels = keys.map(opts.labelOf || (k => k));
      const effPodio = keys.map(k => {
        const g = groups[k];
        const tot = g.camp + g.sub + g.ter + g.sinPodio;
        const pod = g.camp + g.sub + g.ter;
        return tot ? +((pod / tot) * 100).toFixed(1) : 0;
      });
      destroyChart(chartKey);
      charts[chartKey] = new Chart(el(canvasId), {
        data: {
          labels,
          datasets: [
            { type: "bar", label: "🥇 Campeón", data: keys.map(k => groups[k].camp),
              backgroundColor: GOLD, stack: "s", yAxisID: "y", order: 2 },
            { type: "bar", label: "🥈 Subcampeón", data: keys.map(k => groups[k].sub),
              backgroundColor: SILVER, stack: "s", yAxisID: "y", order: 2 },
            { type: "bar", label: "🥉 Tercero", data: keys.map(k => groups[k].ter),
              backgroundColor: BRONZE, stack: "s", yAxisID: "y", order: 2 },
            { type: "bar", label: "Sin podio", data: keys.map(k => groups[k].sinPodio),
              backgroundColor: "#475569", stack: "s", yAxisID: "y", order: 2 },
            { type: "line", label: "% Podios", data: effPodio,
              borderColor: WIN_DARK, backgroundColor: WIN_DARK,
              pointBackgroundColor: effPodio.map(effColor), pointBorderColor: effPodio.map(effColor),
              pointRadius: 5, tension: 0.35,
              yAxisID: "y1", order: 1 }
          ]
        },
        options: baseOpts({
          plugins: {
            legend: { labels: { boxWidth: 12, padding: 14 } },
            tooltip: {
              callbacks: {
                label: c => c.dataset.type === "line"
                  ? `% Podios: ${c.parsed.y}%`
                  : `${c.dataset.label}: ${c.parsed.y}`,
                footer: items => {
                  const g = groups[keys[items[0].dataIndex]];
                  return `Total: ${g.camp + g.sub + g.ter + g.sinPodio}`;
                }
              }
            }
          },
          scales: {
            x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
            y: {
              stacked: true, position: "left", beginAtZero: true,
              grid: { color: GRID }, ticks: { color: TICK, precision: 0 },
              title: { display: true, text: "Torneos", color: TICK }
            },
            y1: {
              position: "right", beginAtZero: true, max: 100,
              grid: { drawOnChartArea: false }, ticks: { color: WIN_DARK, callback: v => v + "%" },
              title: { display: true, text: "% Podios", color: WIN_DARK }
            }
          }
        })
      });
    };

    comboBar("t-chart-anio", "t-anio", {
      groupBy: t => String(t.anio),
      order: "cronologico"
    });
    comboBar("t-chart-organizador", "t-organizador", { groupBy: t => t.organizador, order: "tj" });
    comboBar("t-chart-categoria", "t-categoria", { groupBy: t => t.categoria, order: "tj" });

    // Títulos y subcampeonatos en el tiempo (categoría + compañero)
    titulosTimeline(data);

    // Top 5 compañeros
    topCompanieros(data);

    // Distribución de instancia alcanzada
    instanciaChart(data);
  }

  // ---- Títulos y subcampeonatos en el tiempo ----
  // Línea escalonada de títulos acumulados sobre un eje de tiempo real.
  //  · Título: punto con aro dorado (relleno = color del compañero); suma un escalón.
  //    Arriba: 🏆 categoría / compañero / fecha.
  //  · Subcampeonato: punto con aro plateado sobre el escalón vigente; NO suma.
  //    Abajo: 🥈 categoría / compañero.
  //  · Resto de los torneos: puntito gris sobre el escalón vigente (misma línea), para
  //    dar contexto de frecuencia sin despegarse de la curva.
  //  · Rango: "Todo" (colapsado) o un año expandido; el escalón arranca en los títulos
  //    acumulados antes de ese año.
  // La misma configuración se usa en pantalla y para la imagen de WhatsApp.
  const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DAY_MS = 864e5;
  const toDay = f => { const [y, m, d] = f.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
  const fromDay = v => new Date(v * DAY_MS);
  const shortName = n => {
    const parts = String(n || "").trim().split(/\s+/);
    return parts.length > 1 ? parts[0][0] + ". " + parts.slice(1).join(" ") : (parts[0] || "—");
  };
  const fechaCorta = f => { const d = fromDay(toDay(f)); return d.getUTCDate() + " " + MES_CORTO[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2); };

  const FALLBACK_PALETTE = {
    grid: "#2a313c", tick: "#8b949e", text: "#e6edf3", gold: "#fbbf24", goldFill: "rgba(251,191,36,0.08)",
    silver: "#cbd5e1", silverText: "#cbd5e1", other: "#3a4352",
    partners: ["#60a5fa", "#f472b6", "#2dd4bf", "#a78bfa", "#fb923c", "#facc15", "#f87171", "#94a3b8"]
  };
  const paletteOf = name => (window.THEME
    ? (name ? window.THEME.palette(name) : window.THEME.colors())
    : FALLBACK_PALETTE);

  // Modelo de datos del gráfico (independiente de colores y tamaños).
  // range: null = todo el historial; { from, to } en días = año expandido.
  function titulosModel(data, range = null) {
    const conFecha = data.filter(t => t.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
    const titulosAll = conFecha.filter(t => t.puesto === "campeon");
    const inRange = t => !range || (toDay(t.fecha) >= range.from && toDay(t.fecha) <= range.to);
    // Escalón vigente a una fecha = títulos hasta ese día inclusive
    const escalon = f => titulosAll.filter(c => c.fecha <= f).length;

    const visibles = conFecha.filter(inRange);
    const titulos = visibles.filter(t => t.puesto === "campeon");
    const subs = visibles.filter(t => t.puesto === "subcampeon");

    // Compañeros ordenados por títulos, después por subcampeonatos. El orden (y por ende el color)
    // sale de todo el historial filtrado, así no cambia al expandir un año; la leyenda muestra
    // solo los que aparecen en el período visible, con sus números de ese período.
    const tally = (ts, ss) => {
      const st = {};
      const bump = (t, k) => { const n = t.companiero || "—"; (st[n] = st[n] || { camp: 0, sub: 0 })[k]++; };
      ts.forEach(t => bump(t, "camp"));
      ss.forEach(t => bump(t, "sub"));
      return st;
    };
    const statsAll = tally(titulosAll, conFecha.filter(t => t.puesto === "subcampeon"));
    const stats = tally(titulos, subs);
    const partners = Object.keys(statsAll).sort((a, b) =>
      statsAll[b].camp - statsAll[a].camp || statsAll[b].sub - statsAll[a].sub || a.localeCompare(b, "es"));
    const legend = partners.filter(p => stats[p]);

    const base = range ? titulosAll.filter(c => toDay(c.fecha) < range.from).length : 0;
    // Títulos con mismo día: escalones consecutivos (no todos en el mismo valor)
    const pts = titulos.map((t, i) => ({ x: toDay(t.fecha), y: base + i + 1, t }));
    const subPts = subs.map(t => ({ x: toDay(t.fecha), y: escalon(t.fecha), t }));
    // Resto de los torneos: sobre la misma línea escalonada
    const otros = visibles.filter(t => t.puesto !== "campeon" && t.puesto !== "subcampeon")
      .map(t => ({ x: toDay(t.fecha), y: escalon(t.fecha), t }));
    const acc = base + titulos.length;

    let x0, x1;
    if (range) {
      x0 = range.from - 6; x1 = range.to + 6;
    } else {
      const first = conFecha.length ? toDay(conFecha[0].fecha) : toDay(new Date().toISOString().slice(0, 10));
      const last = conFecha.length ? toDay(conFecha[conFecha.length - 1].fecha) : first;
      const span = Math.max(last - first, 60);
      x0 = first - Math.max(10, span * 0.03);
      x1 = last + Math.max(20, span * 0.06);
    }
    const step = [{ x: x0, y: base }, ...pts, { x: x1, y: acc }];

    return { pts, subPts, otros, step, acc, base, x0, x1, partners, legend, stats, nTitulos: titulos.length, nSubs: subs.length };
  }

  // ---- Expandir / colapsar por año ----
  let titulosYear = null; // null = Todo (colapsado)
  const yearRange = y => (y ? { from: toDay(y + "-01-01"), to: toDay(y + "-12-31") } : null);

  function renderTitulosRange(data) {
    const box = el("t-titulos-range");
    if (!box) return;
    const years = [...new Set(data.filter(t => t.fecha).map(t => t.fecha.slice(0, 4)))].sort();
    if (titulosYear && !years.includes(titulosYear)) titulosYear = null; // el filtro dejó afuera el año
    if (years.length < 2) { box.innerHTML = ""; titulosYear = null; return; }
    const btn = (val, label) => {
      const on = (val || null) === titulosYear;
      return `<button type="button" data-year="${val}" class="${on ? "on" : ""}" aria-pressed="${on}">${label}</button>`;
    };
    box.innerHTML = btn("", "Todo") +
      years.map(y => btn(y, (y === titulosYear ? "▾ " : "▸ ") + y)).join("");
  }

  function partnerColor(m, C, name) {
    return C.partners[m.partners.indexOf(name || "—") % C.partners.length];
  }

  function legendHTML(m, C) {
    return m.legend.map(p => {
      const s = m.stats[p], parts = [];
      if (s.camp) parts.push(`🏆 ${s.camp}`);
      if (s.sub) parts.push(`🥈 ${s.sub}`);
      return `<span><i style="background:${partnerColor(m, C, p)}"></i><b>${p}</b> ${parts.join(" · ")}</span>`;
    }).join("");
  }

  // Configuración de Chart.js. opts.scale agranda textos y puntos (imagen de WhatsApp);
  // opts.compact fuerza / desactiva el modo compacto (por defecto: ancho < 600px).
  function titulosConfig(m, C, opts = {}) {
    const fs = opts.scale || 1;
    const colorOf = name => partnerColor(m, C, name);
    const isCompact = ch => (opts.compact !== undefined ? opts.compact : ch.width < 600);

    // Ticks en el día 1 de cada mes, raleados según el ancho (máx. 5 en mobile, 12 en desktop)
    function monthTicks(maxTicks) {
      const a = fromDay(m.x0), out = [];
      let y = a.getUTCFullYear(), mo = a.getUTCMonth() + 1;
      for (;;) {
        if (mo > 11) { mo = 0; y++; }
        const v = Date.UTC(y, mo, 1) / DAY_MS;
        if (v > m.x1) break;
        out.push(v); mo++;
      }
      const every = Math.max(1, Math.ceil(out.length / maxTicks));
      return out.filter((_, i) => i % every === 0);
    }

    const labelPlugin = {
      id: "titulosLabels",
      afterDatasetsDraw(ch) {
        const ctx = ch.ctx, area = ch.chartArea;
        const compact = isCompact(ch);
        if (!m.pts.length && !m.subPts.length) {
          ctx.save();
          ctx.textAlign = "center"; ctx.fillStyle = C.tick;
          ctx.font = `500 ${13 * fs}px Inter, sans-serif`;
          ctx.fillText(titulosYear ? "Sin títulos ni subcampeonatos en " + titulosYear : "Sin títulos ni subcampeonatos con estos filtros", (area.left + area.right) / 2, (area.top + area.bottom) / 2);
          ctx.restore();
          return;
        }

        // Ubicación de etiquetas sin superposición: cada etiqueta prueba posiciones
        // candidatas (arriba, a los costados, más arriba…) y se queda con la primera
        // que no pisa otra etiqueta ni otro punto. Si se aleja, lleva una línea guía.
        const placed = [];
        const hit = (r, q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t;
        const pointBoxes = [1, 2, 3].flatMap(di => ch.getDatasetMeta(di).data.map(p => {
          const rr = (di === 1 ? 12 : di === 2 ? 10 : 5) * fs;
          return { l: p.x - rr, r: p.x + rr, t: p.y - rr, b: p.y + rr, x: p.x, y: p.y };
        }));
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

        function drawLabel(p, lines, candidates) {
          // lines: [font, text, color, baselineOffsetDesdeArriba]; h: alto del bloque
          ctx.save();
          const w = Math.max(...lines.map(([f, txt]) => { ctx.font = f; return ctx.measureText(txt).width; })) + 8 * fs;
          const h = lines.h;
          const obstacles = placed.concat(pointBoxes.filter(q => q.x !== p.x || q.y !== p.y));
          const rectAt = (cx, ty) => ({ l: cx - w / 2, r: cx + w / 2, t: ty, b: ty + h });
          const ok = r => r.t >= area.top - 2 && r.b <= area.bottom - 2 &&
            r.l >= 0 && r.r <= ch.width && !obstacles.some(q => hit(r, q));
          let best = null;
          for (const c of candidates(w, h)) { if (ok(rectAt(c.cx, c.ty))) { best = c; break; } }
          if (!best) best = candidates(w, h).next().value;  // sin lugar libre: posición por defecto
          const r = rectAt(best.cx, best.ty);
          placed.push(r);
          // línea guía si la etiqueta quedó lejos del punto
          const gx = clamp(p.x, r.l, r.r), gy = clamp(p.y, r.t, r.b);
          if (Math.hypot(gx - p.x, gy - p.y) > 22 * fs) {
            ctx.strokeStyle = C.tick; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(gx, gy); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.textAlign = "center";
          lines.forEach(([f, txt, color, off]) => {
            ctx.font = f; ctx.fillStyle = color;
            ctx.fillText(txt, best.cx, best.ty + off);
          });
          ctx.restore();
        }

        const step = 4 * fs;
        // Títulos: arriba del punto → costados → subiendo de a poco
        function* titleCandidates(p, w, h) {
          const side = w / 2 + 14 * fs;
          for (let ty = p.y - 14 * fs - h; ty >= area.top - 2; ty -= step) {
            yield { cx: p.x, ty }; yield { cx: p.x - side, ty }; yield { cx: p.x + side, ty };
          }
        }
        // Subcampeonatos: abajo → derecha → izquierda → arriba (y subiendo)
        function* subCandidates(p, w, h) {
          const side = w / 2 + 14 * fs;
          yield { cx: p.x, ty: p.y + 12 * fs };
          yield { cx: p.x + side, ty: p.y - h / 2 };
          yield { cx: p.x - side, ty: p.y - h / 2 };
          for (let ty = p.y - 12 * fs - h; ty >= area.top - 2; ty -= step) {
            yield { cx: p.x, ty }; yield { cx: p.x - side, ty }; yield { cx: p.x + side, ty };
          }
        }

        ch.getDatasetMeta(1).data.forEach((p, i) => {
          const t = m.pts[i].t;
          let lines;
          if (compact) {
            lines = [[`700 ${14 * fs}px 'Barlow Condensed', sans-serif`, t.categoria || "🏆", C.gold, 12 * fs]];
            lines.h = 15 * fs;
          } else {
            lines = [
              [`700 ${17 * fs}px 'Barlow Condensed', sans-serif`, "🏆 " + (t.categoria || ""), C.gold, 14 * fs],
              [`600 ${12 * fs}px Inter, sans-serif`, shortName(t.companiero), colorOf(t.companiero), 30 * fs],
              [`500 ${11 * fs}px Inter, sans-serif`, fechaCorta(t.fecha), C.tick, 44 * fs]
            ];
            lines.h = 48 * fs;
          }
          drawLabel(p, lines, (w, h) => titleCandidates(p, w, h));
        });

        ch.getDatasetMeta(2).data.forEach((p, i) => {
          const t = m.subPts[i].t;
          let lines;
          if (compact) {
            lines = [[`700 ${13 * fs}px 'Barlow Condensed', sans-serif`, t.categoria || "🥈", C.silverText, 11 * fs]];
            lines.h = 14 * fs;
          } else {
            lines = [
              [`700 ${15 * fs}px 'Barlow Condensed', sans-serif`, "🥈 " + (t.categoria || ""), C.silverText, 12 * fs],
              [`600 ${11 * fs}px Inter, sans-serif`, shortName(t.companiero), colorOf(t.companiero), 26 * fs]
            ];
            lines.h = 30 * fs;
          }
          drawLabel(p, lines, (w, h) => subCandidates(p, w, h));
        });
      }
    };

    const tickFont = { size: 12 * fs };
    return {
      data: {
        datasets: [
          { type: "line", label: "Títulos acumulados", data: m.step, stepped: "before",
            borderColor: C.gold, borderWidth: 2 * fs, backgroundColor: C.goldFill, fill: true,
            pointRadius: 0, pointHoverRadius: 0, order: 4 },
          { type: "scatter", label: "Título", data: m.pts,
            pointRadius: 9 * fs, pointHoverRadius: 11 * fs,
            pointBackgroundColor: m.pts.map(p => colorOf(p.t.companiero)),
            pointBorderColor: C.gold, pointBorderWidth: 3 * fs, order: 1 },
          { type: "scatter", label: "Subcampeonato", data: m.subPts,
            pointRadius: 7 * fs, pointHoverRadius: 9 * fs,
            pointBackgroundColor: m.subPts.map(p => colorOf(p.t.companiero)),
            pointBorderColor: C.silver, pointBorderWidth: 3 * fs, order: 2 },
          { type: "scatter", label: "Otros torneos", data: m.otros,
            pointRadius: 3.5 * fs, pointHoverRadius: 5 * fs,
            pointBackgroundColor: C.tick, pointBorderWidth: 0, order: 3 }
        ]
      },
      options: {
        responsive: !opts.static, maintainAspectRatio: false,
        animation: opts.static ? false : undefined,
        devicePixelRatio: opts.dpr || undefined,
        layout: { padding: { top: 6 * fs, right: 12 * fs } },
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !opts.static,
            filter: i => i.datasetIndex !== 0,
            callbacks: {
              title: items => {
                const t = items[0].raw.t;
                return t ? `${fechaCorta(t.fecha)} · ${t.organizador || "—"}` : "";
              },
              label: c => {
                const t = c.raw.t;
                if (!t) return "";
                if (c.datasetIndex === 1) return `🏆 Campeón ${t.categoria || ""} con ${t.companiero || "—"} (título #${c.raw.y})`;
                if (c.datasetIndex === 2) return `🥈 Subcampeón ${t.categoria || ""} con ${t.companiero || "—"}`;
                // Torneos sin título ni subcampeonato: mostrar la instancia máxima alcanzada
                const inst = instanciaMaxima(t);
                const p = t.puesto === "tercero" ? PUESTO_LABEL.tercero
                  : inst ? `Instancia máx.: ${ETAPA_LABEL[inst]}` : "Instancia máx.: sin dato";
                return `${p} · ${t.categoria || "—"} con ${t.companiero || "—"}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: "linear", min: m.x0, max: m.x1,
            grid: { color: C.grid }, ticks: {
              color: C.tick, autoSkip: false, maxRotation: 0, font: tickFont,
              callback: v => { const d = fromDay(v); return MES_CORTO[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2); }
            },
            afterBuildTicks: axis => { axis.ticks = monthTicks(axis.chart.width < 600 * fs ? 5 : 12).map(value => ({ value })); }
          },
          y: {
            min: m.base, max: m.acc + (m.acc - m.base ? 3 : 1.5),
            grid: { color: C.grid },
            ticks: { color: C.tick, stepSize: 1, precision: 0, font: tickFont, callback: v => (v <= m.acc ? v : "") },
            title: { display: true, text: "Títulos acumulados", color: C.tick, font: tickFont }
          }
        }
      },
      plugins: [labelPlugin]
    };
  }

  function titulosTimeline(data) {
    const C = paletteOf();
    renderTitulosRange(data);
    const m = titulosModel(data, yearRange(titulosYear));
    const legend = el("t-titulos-legend");
    if (legend) legend.innerHTML = legendHTML(m, C);
    destroyChart("t-titulos");
    const canvas = el("t-chart-titulos");
    if (!canvas) return;
    charts["t-titulos"] = new Chart(canvas, titulosConfig(m, C));
  }

  // Renderiza el gráfico en un canvas fuera de pantalla (tema oscuro, tamaño fijo)
  // y devuelve el canvas listo para dibujar en la imagen de WhatsApp.
  function renderTitulosOffscreen(m, w, h) {
    const C = paletteOf("dark");
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px;`;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    host.appendChild(cv);
    document.body.appendChild(host);
    const chart = new Chart(cv, titulosConfig(m, C, { scale: 1.3, compact: false, static: true, dpr: 2 }));
    return {
      canvas: cv,
      dispose: () => { chart.destroy(); host.remove(); }
    };
  }

  function topCompanieros(data) {
    const groups = {};
    data.forEach(t => {
      if (!t.companiero) return;
      groups[t.companiero] = groups[t.companiero] || { tj: 0, camp: 0, sub: 0, ter: 0, sinPodio: 0 };
      groups[t.companiero].tj++;
      if (t.puesto === "campeon") groups[t.companiero].camp++;
      else if (t.puesto === "subcampeon") groups[t.companiero].sub++;
      else if (t.puesto === "tercero") groups[t.companiero].ter++;
      else groups[t.companiero].sinPodio++;
    });
    const rows = Object.entries(groups)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.tj - a.tj || (b.camp + b.sub + b.ter) - (a.camp + a.sub + a.ter) || a.name.localeCompare(b.name, "es"))
      .slice(0, 5);

    const eff = rows.map(r => r.tj ? +(((r.camp + r.sub + r.ter) / r.tj) * 100).toFixed(1) : 0);

    destroyChart("t-comp");
    charts["t-comp"] = new Chart(el("t-chart-comp"), {
      data: {
        labels: rows.map(r => r.name),
        datasets: [
          { type: "bar", label: "🥇 Campeón", data: rows.map(r => r.camp),
            backgroundColor: GOLD, stack: "s", yAxisID: "y", order: 2 },
          { type: "bar", label: "🥈 Subcampeón", data: rows.map(r => r.sub),
            backgroundColor: SILVER, stack: "s", yAxisID: "y", order: 2 },
          { type: "bar", label: "🥉 Tercero", data: rows.map(r => r.ter),
            backgroundColor: BRONZE, stack: "s", yAxisID: "y", order: 2 },
          { type: "bar", label: "Sin podio", data: rows.map(r => r.sinPodio),
            backgroundColor: "#475569", stack: "s", yAxisID: "y", order: 2 },
          { type: "line", label: "% Podios", data: eff,
            borderColor: WIN_DARK, backgroundColor: WIN_DARK,
            pointBackgroundColor: eff.map(effColor), pointBorderColor: eff.map(effColor),
            pointRadius: 5, tension: 0.35,
            yAxisID: "y1", order: 1 }
        ]
      },
      options: baseOpts({
        plugins: {
          legend: { labels: { boxWidth: 12, padding: 14 } },
          tooltip: {
            callbacks: {
              label: c => c.dataset.type === "line"
                ? `% Podios: ${c.parsed.y}%`
                : `${c.dataset.label}: ${c.parsed.y}`,
              footer: items => `Total: ${rows[items[0].dataIndex].tj}`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
          y: {
            stacked: true, position: "left", beginAtZero: true,
            grid: { color: GRID }, ticks: { color: TICK, precision: 0 },
            title: { display: true, text: "Torneos", color: TICK }
          },
          y1: {
            position: "right", beginAtZero: true, max: 100,
            grid: { drawOnChartArea: false }, ticks: { color: WIN_DARK, callback: v => v + "%" },
            title: { display: true, text: "% Podios", color: WIN_DARK }
          }
        }
      })
    });
  }

  function instanciaChart(data) {
    // Distribución: cuántos torneos terminaron en cada instancia (zona / octavos / cuartos / semi / final-subcamp / campeón)
    const buckets = { zona: 0, octavos: 0, cuartos: 0, semifinal: 0, final: 0, campeon: 0 };
    data.forEach(t => {
      if (t.puesto === "campeon") buckets.campeon++;
      else {
        const inst = instanciaMaxima(t);
        if (inst && buckets[inst] !== undefined) buckets[inst]++;
      }
    });
    const labels = ["Zona", "Octavos", "Cuartos", "Semifinal", "Subcampeón", "Campeón"];
    const values = [buckets.zona, buckets.octavos, buckets.cuartos, buckets.semifinal, buckets.final, buckets.campeon];
    const colors = ["#475569", "#64748b", "#94a3b8", BRONZE, SILVER, GOLD];

    destroyChart("t-inst");
    charts["t-inst"] = new Chart(el("t-chart-instancia"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Torneos",
          data: values,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: baseOpts({
        plugins: { legend: { display: false }, tooltip: {} },
        scales: {
          x: { grid: { color: GRID }, ticks: { color: TICK } },
          y: {
            beginAtZero: true, grid: { color: GRID },
            ticks: { color: TICK, precision: 0 },
            title: { display: true, text: "Torneos", color: TICK }
          }
        }
      })
    });
  }

  window.initTorneos = init;

  // ================= WhatsApp: compartir estadísticas de torneos =================
  (function () {
    const FILTER_LABELS_T = {
      anio: "Año", mes: "Mes", organizador: "Organizador",
      categoria: "Categoría", companiero: "Compañero", puesto: "Puesto",
      lastN: "Últimos"
    };
    const FILTER_ORDER_T = ["anio", "mes", "organizador", "categoria", "companiero", "puesto", "lastN"];
    const PUESTO_SHORT = { campeon: "Campeón", subcampeon: "Subcampeón", tercero: "Tercero", sin_podio: "Sin podio" };

    function txt(id) { const e = document.getElementById(id); return e ? e.textContent.trim() : "–"; }

    function shownFiltersTorneos() {
      const out = [];
      FILTER_ORDER_T.forEach(key => {
        if (key === "lastN") {
          if (filters.lastN) out.push(`${FILTER_LABELS_T.lastN}: ${filters.lastN}`);
          return;
        }
        const arr = filters[key] || [];
        if (arr.length) {
          const vals = arr.map(v => {
            if (key === "mes") { const n = parseInt(v, 10); return MESES[n] || v; }
            if (key === "puesto") return PUESTO_SHORT[v] || v;
            return String(v);
          }).join(", ");
          out.push((FILTER_LABELS_T[key] || key) + ": " + vals);
        }
      });
      return out;
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function buildTorneosImage() {
      const DPR = 2;
      const W = 1080, H = 1080;
      const cv = document.createElement("canvas");
      cv.width = W * DPR; cv.height = H * DPR;
      const ctx = cv.getContext("2d");
      ctx.scale(DPR, DPR);

      // fondo
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0d1117"); g.addColorStop(1, "#0a0e14");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // glow dorado arriba-izq
      const rg = ctx.createRadialGradient(150, -40, 0, 150, -40, 520);
      rg.addColorStop(0, "rgba(251,191,36,0.18)"); rg.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

      const PAD = 64;
      // eyebrow
      ctx.fillStyle = "#fbbf24";
      ctx.font = "600 22px Inter, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("CIRCUITO DE TORNEOS", PAD, 96);
      // título
      ctx.fillStyle = "#e6edf3";
      ctx.font = "700 76px 'Barlow Condensed', Arial Narrow, sans-serif";
      ctx.fillText("MIS TORNEOS DE PÁDEL", PAD, 168);
      // última actualización
      ctx.fillStyle = "#8b949e";
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillText(txt("t-last-update") || "", PAD, 208);

      // filtros activos
      const fl = shownFiltersTorneos();
      let filterLine = fl.length ? fl.join("  ·  ") : "Todos los torneos";
      ctx.fillStyle = "#9aa4b0";
      ctx.font = "500 22px Inter, sans-serif";
      if (ctx.measureText(filterLine).width > W - PAD * 2) {
        while (ctx.measureText(filterLine + "…").width > W - PAD * 2 && filterLine.length) filterLine = filterLine.slice(0, -1);
        filterLine += "…";
      }
      ctx.fillText("Filtros · " + filterLine, PAD, 248);

      const cards = [
        { label: "TORNEOS JUGADOS",        value: txt("t-kpi-tj"),      color: "#e6edf3" },
        { label: "CAMPEÓN 🥇",             value: txt("t-kpi-camp"),    color: "#fbbf24" },
        { label: "SUBCAMPEÓN 🥈",          value: txt("t-kpi-sub"),     color: "#cbd5e1" },
        { label: "PODIOS TOTALES",         value: txt("t-kpi-podios"),  color: "#e6edf3" },
        { label: "% PODIOS",               value: txt("t-kpi-eff"),     color: "#4ade80" },
        { label: "SEMIS ALCANZADAS",       value: txt("t-kpi-semis"),   color: "#e6edf3" },
        { label: "FINALES JUGADAS",        value: txt("t-kpi-finales"), color: "#e6edf3" },
        { label: "INSTANCIA MÁS FRECUENTE", value: txt("t-kpi-inst"),  color: "#fbbf24" },
      ];

      const cols = 2, gap = 26;
      const gridTop = 300, gridBottom = 1000;
      const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
      const rowCount = Math.ceil(cards.length / cols);
      const ch = (gridBottom - gridTop - gap * (rowCount - 1)) / rowCount;

      cards.forEach((c, i) => {
        const cx = PAD + (i % cols) * (cw + gap);
        const cy = gridTop + Math.floor(i / cols) * (ch + gap);
        roundRect(ctx, cx, cy, cw, ch, 18);
        ctx.fillStyle = "#161b22"; ctx.fill();
        ctx.strokeStyle = "#2a313c"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = c.color;
        roundRect(ctx, cx, cy, 6, ch, 3); ctx.fill();
        ctx.fillStyle = "#8b949e";
        ctx.font = "600 20px Inter, sans-serif";
        ctx.fillText(c.label, cx + 30, cy + 44);
        ctx.fillStyle = c.color;
        ctx.font = "700 72px 'Barlow Condensed', Arial Narrow, sans-serif";
        ctx.fillText(c.value.replace(/\s+/g, " "), cx + 30, cy + ch - 30);
      });

      ctx.fillStyle = "#8b949e";
      ctx.font = "500 22px Inter, sans-serif";
      ctx.fillText("Estadísticas de Pádel · Federico Olego", PAD, 1048);

      return cv;
    }

    function canvasToBlob(cv) {
      return new Promise(res => cv.toBlob(res, "image/png"));
    }

    async function shareTorneosStats() {
      const fab = document.getElementById("wa-share");
      if (fab) fab.classList.add("busy");
      try {
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
        const cv = buildTorneosImage();
        const blob = await canvasToBlob(cv);
        const file = new File([blob], "mis-estadisticas-torneos.png", { type: "image/png" });
        const camp = txt("t-kpi-camp"), sub = txt("t-kpi-sub"), eff = txt("t-kpi-eff");
        const text = "Mis estadísticas de torneos 🏆 " + camp + " campeón · " + sub + " subcampeón · " + eff + " podios";

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
      } catch (err) {
        if (err && err.name === "AbortError") return;
        console.error(err);
        alert("No se pudo generar la imagen para compartir.");
      } finally {
        if (fab) fab.classList.remove("busy");
      }
    }

    window.shareTorneosStats = shareTorneosStats;

    // ---------- Compartir solo el gráfico "Títulos y subcampeonatos en el tiempo" ----------
    function buildTitulosImage() {
      const DPR = 2;
      const W = 1080, H = 1080, PAD = 64;
      const m = titulosModel(applyFilters(), yearRange(titulosYear));
      const C = paletteOf("dark");

      const cv = document.createElement("canvas");
      cv.width = W * DPR; cv.height = H * DPR;
      const ctx = cv.getContext("2d");
      ctx.scale(DPR, DPR);

      // fondo (mismo estilo que la imagen general de torneos)
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0d1117"); g.addColorStop(1, "#0a0e14");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(150, -40, 0, 150, -40, 520);
      rg.addColorStop(0, "rgba(251,191,36,0.18)"); rg.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = "#fbbf24";
      ctx.font = "600 22px Inter, sans-serif";
      ctx.fillText("CIRCUITO DE TORNEOS", PAD, 96);
      ctx.fillStyle = "#e6edf3";
      ctx.font = "700 76px 'Barlow Condensed', Arial Narrow, sans-serif";
      ctx.fillText("MIS TÍTULOS DE PÁDEL", PAD, 168);

      // resumen: títulos y subcampeonatos
      ctx.font = "700 34px 'Barlow Condensed', Arial Narrow, sans-serif";
      let x = PAD;
      const seg = (text, color) => { ctx.fillStyle = color; ctx.fillText(text, x, 214); x += ctx.measureText(text).width; };
      seg(`🏆 ${m.nTitulos} título${m.nTitulos === 1 ? "" : "s"}`, "#fbbf24");
      seg("   ·   ", "#8b949e");
      seg(`🥈 ${m.nSubs} subcampeonato${m.nSubs === 1 ? "" : "s"}`, "#cbd5e1");

      // filtros activos
      const fl = shownFiltersTorneos().concat(titulosYear ? ["Año " + titulosYear] : []);
      let filterLine = fl.length ? fl.join("  ·  ") : "Todos los torneos";
      ctx.fillStyle = "#9aa4b0";
      ctx.font = "500 22px Inter, sans-serif";
      const maxW = W - PAD * 2 - ctx.measureText("Filtros · ").width;
      if (ctx.measureText(filterLine).width > maxW) {
        while (ctx.measureText(filterLine + "…").width > maxW && filterLine.length) filterLine = filterLine.slice(0, -1);
        filterLine += "…";
      }
      ctx.fillText("Filtros · " + filterLine, PAD, 254);

      // leyenda de compañeros (con salto de línea)
      ctx.font = "600 22px Inter, sans-serif";
      let lx = PAD, ly = 302;
      m.legend.forEach(p => {
        const s = m.stats[p], parts = [];
        if (s.camp) parts.push(`🏆 ${s.camp}`);
        if (s.sub) parts.push(`🥈 ${s.sub}`);
        ctx.font = "600 22px Inter, sans-serif";
        const nameW = ctx.measureText(p).width;
        ctx.font = "500 20px Inter, sans-serif";
        const cntTxt = "  " + parts.join(" · ");
        const itemW = 24 + nameW + ctx.measureText(cntTxt).width + 30;
        if (lx + itemW > W - PAD && lx > PAD) { lx = PAD; ly += 36; }
        ctx.fillStyle = partnerColor(m, C, p);
        ctx.beginPath(); ctx.arc(lx + 8, ly - 7, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e6edf3"; ctx.font = "600 22px Inter, sans-serif";
        ctx.fillText(p, lx + 24, ly);
        ctx.fillStyle = "#8b949e"; ctx.font = "500 20px Inter, sans-serif";
        ctx.fillText(cntTxt, lx + 24 + nameW, ly);
        lx += itemW;
      });

      // panel con el gráfico
      const panelTop = ly + 30, panelBottom = 1004;
      roundRect(ctx, PAD, panelTop, W - PAD * 2, panelBottom - panelTop, 18);
      ctx.fillStyle = "#161b22"; ctx.fill();
      ctx.strokeStyle = "#2a313c"; ctx.lineWidth = 1; ctx.stroke();
      const inset = 22;
      const cw = W - PAD * 2 - inset * 2, chh = panelBottom - panelTop - inset * 2;
      const off = renderTitulosOffscreen(m, cw, chh);
      try { ctx.drawImage(off.canvas, PAD + inset, panelTop + inset, cw, chh); }
      finally { off.dispose(); }

      ctx.fillStyle = "#8b949e";
      ctx.font = "500 22px Inter, sans-serif";
      ctx.fillText("Estadísticas de Pádel · Federico Olego", PAD, 1048);
      return { canvas: cv, model: m };
    }

    async function shareTitulosChart() {
      const btn = document.getElementById("t-titulos-share");
      if (btn) btn.classList.add("busy");
      try {
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
        const { canvas, model: m } = buildTitulosImage();
        const blob = await canvasToBlob(canvas);
        const file = new File([blob], "mis-titulos-padel.png", { type: "image/png" });
        const text = `Mis títulos de pádel 🏆 ${m.nTitulos} título${m.nTitulos === 1 ? "" : "s"} · 🥈 ${m.nSubs} subcampeonato${m.nSubs === 1 ? "" : "s"}`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
      } catch (err) {
        if (err && err.name === "AbortError") return;
        console.error(err);
        alert("No se pudo generar la imagen para compartir.");
      } finally {
        if (btn) btn.classList.remove("busy");
      }
    }

    window.shareTitulosChart = shareTitulosChart;
    window.buildTitulosImage = buildTitulosImage; // útil para depurar desde la consola
    const rangeBox = document.getElementById("t-titulos-range");
    if (rangeBox) rangeBox.addEventListener("click", e => {
      const b = e.target.closest("button[data-year]");
      if (!b) return;
      const y = b.dataset.year || null;
      titulosYear = (y === titulosYear) ? null : y; // clic en el año abierto → colapsa a Todo
      titulosTimeline(applyFilters());
    });
    const shareBtn = document.getElementById("t-titulos-share");
    if (shareBtn) shareBtn.addEventListener("click", shareTitulosChart);
  })();
})();
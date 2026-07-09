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
    el("t-record").innerHTML =
      `<span class="w">${s.campeon}</span><span class="sep">·</span><span class="l">${s.tj - s.podios}</span>`;
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
  const GRID = "#2a313c", TICK = "#8b949e", WIN = "#4ade80", LOSS = "#f87171";
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

    // Top 5 compañeros
    topCompanieros(data);

    // Distribución de instancia alcanzada
    instanciaChart(data);
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
        { label: "FINALES JUGADAS",        value: txt("t-kpi-finales"), color: "#e6edf3" },
        { label: "SEMIS ALCANZADAS",       value: txt("t-kpi-semis"),   color: "#e6edf3" },
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
  })();
})();

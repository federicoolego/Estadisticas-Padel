// ===== Padel Stats Dashboard =====
const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let ALL = [];
let charts = {};

const filters = { companiero: [], rival: [], anio: [], mes: [], cancha: [], formato: [] };

const el = (id) => document.getElementById(id);

async function init() {
  try {
    const res = await fetch("data/partidos.json");
    ALL = await res.json();
  } catch (e) {
    document.querySelector(".wrap").innerHTML =
      '<p class="empty">No se pudo cargar data/partidos.json. Si abriste el archivo directamente, servilo con un servidor local (ej: <code>python -m http.server</code>).</p>';
    return;
  }
  buildFilterOptions();
  bindFilters();
  renderLastUpdate();
  render();
}

// Fecha del último partido cargado (por #), independiente de los filtros
function renderLastUpdate() {
  if (!ALL.length) return;
  const last = [...ALL].sort((a, b) => a.id - b.id)[ALL.length - 1];
  const [y, mo, d] = last.fecha.split("-");
  el("last-update").textContent = `Última actualización: ${d}/${mo}/${y}`;
}

function uniqueSorted(key) {
  return [...new Set(ALL.map(m => m[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "es", { numeric: true }));
}

function buildFilterOptions() {
  setupCombo("combo-companiero", uniqueSorted("companiero").map(v => [v, v]), "companiero", "Todos");
  setupCombo("combo-rival", rivalPlayers().map(v => [v, v]), "rival", "Todos");
  setupCombo("combo-anio", uniqueSorted("anio").map(v => [String(v), String(v)]), "anio", "Todos");
  setupCombo("combo-mes", uniqueSorted("mes").map(n => [String(n), MESES[n]]), "mes", "Todos");
  setupCombo("combo-cancha", uniqueSorted("cancha").map(v => [v, v]), "cancha", "Todas");
  setupCombo("combo-formato", uniqueSorted("formato").map(v => [v, v]), "formato", "Todos");
}

// ---- Combobox multi-selección con checkboxes ----
// items: array de [value, label]
const combos = {};

function setupCombo(comboId, items, filterKey, placeholder) {
  const root = el(comboId);
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
    // mostrar labels elegidos
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
  if (!e.target.closest(".combo")) closeAllCombos();
});

// Divide "A - B" en jugadores individuales
function splitRivals(str) {
  if (!str) return [];
  return str.split(" - ").map(s => s.trim()).filter(Boolean);
}

// Lista única de personas rivales, ordenada alfabéticamente
function rivalPlayers() {
  const set = new Set();
  ALL.forEach(m => splitRivals(m.rivales).forEach(p => set.add(p)));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function bindFilters() {
  el("reset").addEventListener("click", () => {
    Object.keys(filters).forEach(k => filters[k] = []);
    Object.keys(combos).forEach(id => {
      if (combos[id].search) combos[id].search.value = "";
      updateComboInput(id);
      renderComboList(id, "");
    });
    closeAllCombos();
    render();
  });
}

function applyFilters() {
  const f = filters;
  return ALL.filter(m =>
    (!f.companiero.length || f.companiero.includes(m.companiero)) &&
    (!f.rival.length || splitRivals(m.rivales).some(p => f.rival.includes(p))) &&
    (!f.anio.length || f.anio.includes(String(m.anio))) &&
    (!f.mes.length || f.mes.includes(String(m.mes))) &&
    (!f.cancha.length || f.cancha.includes(m.cancha)) &&
    (!f.formato.length || f.formato.includes(m.formato))
  );
}

function render() {
  const data = applyFilters();
  renderKPIs(data);
  renderRecord(data);
  renderCharts(data);
  renderTable(data);
}

function renderTable(data) {
  const tbody = el("tabla-body");
  const rows = [...data].sort((a, b) => a.id - b.id);
  el("tabla-count").textContent = `${rows.length} partido${rows.length === 1 ? "" : "s"}`;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay partidos con estos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(m => {
    const win = m.resultado === "PG";
    const [y, mo, d] = m.fecha.split("-");
    return `<tr>
      <td class="c-num">${m.id}</td>
      <td>${d}/${mo}/${y}</td>
      <td>${m.formato || "—"}</td>
      <td>${m.companiero || "—"}</td>
      <td class="c-vs">🆚</td>
      <td>${m.rivales || "—"}</td>
      <td class="c-res"><span class="badge ${win ? "b-win" : "b-loss"}">${win ? "✅ PG" : "❌ PP"}</span></td>
    </tr>`;
  }).join("");
}

function stats(list) {
  const pj = list.length;
  const pg = list.filter(m => m.resultado === "PG").length;
  const pp = pj - pg;
  const dif = pg - pp;
  const eff = pj ? pg / pj : 0;
  return { pj, pg, pp, dif, eff };
}

// Rachas sobre la lista filtrada, ordenada cronológicamente por # (id).
// target = "PG" (racha positiva) o "PP" (negativa).
// Devuelve { max, veces, actual }: mejor racha, cuántas veces se alcanzó ese máximo, y la racha vigente al final.
function streak(list, target) {
  const seq = [...list].sort((a, b) => a.id - b.id);
  let max = 0, veces = 0, run = 0, actual = 0;
  seq.forEach(m => {
    if (m.resultado === target) {
      run++;
      if (run > max) { max = run; veces = 1; }
      else if (run === max && run > 0) veces++;
    } else {
      run = 0;
    }
  });
  // racha actual: contar desde el final mientras coincida
  for (let i = seq.length - 1; i >= 0; i--) {
    if (seq[i].resultado === target) actual++; else break;
  }
  return { max, veces, actual };
}

function renderRecord(data) {
  const s = stats(data);
  el("record").innerHTML =
    `<span class="w">${s.pg}</span><span class="sep">/</span><span class="l">${s.pp}</span>`;
}

function renderKPIs(data) {
  const s = stats(data);
  el("kpi-pj").textContent = s.pj;
  el("kpi-pg").textContent = s.pg;
  el("kpi-pp").textContent = s.pp;
  el("kpi-dif").textContent = (s.dif > 0 ? "+" : "") + s.dif;
  el("kpi-eff").innerHTML = (s.eff * 100).toFixed(1) + "<small>%</small>";

  const rp = streak(data, "PG");
  const rn = streak(data, "PP");
  el("kpi-rp").innerHTML = rp.max + (rp.max ? ` <small>(${rp.veces})</small>` : "");
  el("kpi-rn").innerHTML = rn.max + (rn.max ? ` <small>(${rn.veces})</small>` : "");

  // Racha actual: una sola métrica. Positiva -> verde, negativa -> rojo.
  const card = el("kpi-card-actual");
  card.classList.remove("win", "loss");
  let valor, tip;
  if (rp.actual > 0) {
    valor = rp.actual;
    tip = `${rp.actual} ${rp.actual === 1 ? "partido" : "partidos"} sin perder`;
    card.classList.add("win");
  } else if (rn.actual > 0) {
    valor = rn.actual;
    tip = `${rn.actual} ${rn.actual === 1 ? "partido" : "partidos"} sin ganar`;
    card.classList.add("loss");
  } else {
    valor = 0;
    tip = "Sin partidos en el filtro actual";
  }
  el("kpi-ra").textContent = valor;
  card.setAttribute("data-tip", tip);
}

// ---- Chart helpers ----
const GRID = "#2a313c", TICK = "#8b949e", WIN = "#4ade80", LOSS = "#f87171", ACCENT = "#2563eb";
const WIN_DARK = "#15803d", LOSS_DARK = "#b91c1c";
Chart.defaults.color = TICK;
Chart.defaults.font.family = "Inter, sans-serif";

function destroyChart(k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } }

// Color del punto según efectividad: rojo si <50%, verde si >=50% (tonos oscuros)
function effColor(v) { return v >= 50 ? WIN_DARK : LOSS_DARK; }

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

function renderCharts(data) {
  // comboBar genérico: barras apiladas PG/PP (total = alto) + línea de efectividad.
  // opts.groupBy(m) -> clave; opts.labelOf(key) -> etiqueta visible; opts.order: "cronologico" | "pj"
  const comboBar = (canvasId, chartKey, opts) => {
    const groups = {};
    data.forEach(m => {
      const g = opts.groupBy(m);
      if (g == null || g === "") return;
      groups[g] = groups[g] || { pg: 0, pp: 0 };
      groups[g][m.resultado === "PG" ? "pg" : "pp"]++;
    });
    let keys = Object.keys(groups);
    if (opts.order === "cronologico") {
      keys.sort();
    } else {
      keys.sort((a, b) => (groups[b].pg + groups[b].pp) - (groups[a].pg + groups[a].pp));
    }
    const labels = keys.map(opts.labelOf || (k => k));
    const eff = keys.map(k => {
      const pj = groups[k].pg + groups[k].pp;
      return pj ? +((groups[k].pg / pj) * 100).toFixed(1) : 0;
    });
    destroyChart(chartKey);
    charts[chartKey] = new Chart(el(canvasId), {
      data: {
        labels,
        datasets: [
          { type: "bar", label: "Ganados", data: keys.map(k => groups[k].pg),
            backgroundColor: WIN, stack: "s", yAxisID: "y", order: 2 },
          { type: "bar", label: "Perdidos", data: keys.map(k => groups[k].pp),
            backgroundColor: LOSS, stack: "s", yAxisID: "y", order: 2 },
          { type: "line", label: "Efectividad %", data: eff,
            borderColor: WIN_DARK, backgroundColor: WIN_DARK,
            pointBackgroundColor: eff.map(effColor), pointBorderColor: eff.map(effColor),
            pointRadius: 5, tension: 0.35,
            yAxisID: "y1", order: 1 }
        ]
      },
      options: baseOpts({
        plugins: {
          legend: { labels: { boxWidth: 12, padding: 14 } },
          tooltip: { callbacks: {
            label: c => c.dataset.type === "line"
              ? `Efectividad: ${c.parsed.y}%`
              : `${c.dataset.label}: ${c.parsed.y}`,
            footer: items => {
              const g = groups[keys[items[0].dataIndex]];
              return `Total: ${g.pg + g.pp}`;
            }
          } }
        },
        scales: {
          x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
          y: { stacked: true, position: "left", beginAtZero: true,
               grid: { color: GRID }, ticks: { color: TICK, precision: 0 },
               title: { display: true, text: "Partidos", color: TICK } },
          y1: { position: "right", beginAtZero: true, max: 100,
                grid: { drawOnChartArea: false }, ticks: { color: WIN_DARK, callback: v => v + "%" },
                title: { display: true, text: "Efectividad", color: WIN_DARK } }
        }
      })
    });
  };

  comboBar("chart-anio", "anio", {
    groupBy: m => String(m.anio),
    order: "cronologico"
  });
  comboBar("chart-mes", "mes", {
    groupBy: m => `${m.anio}-${String(m.mes).padStart(2, "0")}`,
    labelOf: k => { const [y, mo] = k.split("-"); return `${MESES[+mo].slice(0, 3)} ${y.slice(2)}`; },
    order: "cronologico"
  });
  comboBar("chart-formato", "formato", { groupBy: m => m.formato, order: "pj" });
  comboBar("chart-cancha", "cancha", { groupBy: m => m.cancha, order: "pj" });

  // TOP 5 compañeros y rivales: orden PJ → PG → alfabético
  topRanking("companiero", "chart-comp", "comp");
  topRanking("rivales", "chart-rival", "rival");
}

function topRanking(key, canvasId, chartKey) {
  const data = applyFilters();
  const groups = {};
  data.forEach(m => {
    // Para rivales, contabilizar cada persona por separado; para el resto, el valor directo
    const names = key === "rivales" ? splitRivals(m.rivales) : (m[key] ? [m[key]] : []);
    names.forEach(g => {
      groups[g] = groups[g] || { pj: 0, pg: 0 };
      groups[g].pj++;
      if (m.resultado === "PG") groups[g].pg++;
    });
  });
  const rows = Object.entries(groups)
    .map(([name, v]) => ({ name, pj: v.pj, pg: v.pg, pp: v.pj - v.pg }))
    .sort((a, b) =>
      b.pj - a.pj ||
      b.pg - a.pg ||
      a.name.localeCompare(b.name, "es"))
    .slice(0, 5);

  const eff = rows.map(r => r.pj ? +((r.pg / r.pj) * 100).toFixed(1) : 0);

  destroyChart(chartKey);
  charts[chartKey] = new Chart(el(canvasId), {
    data: {
      labels: rows.map(r => r.name),
      datasets: [
        { type: "bar", label: "Ganados", data: rows.map(r => r.pg),
          backgroundColor: WIN, stack: "s", yAxisID: "y", order: 2 },
        { type: "bar", label: "Perdidos", data: rows.map(r => r.pp),
          backgroundColor: LOSS, stack: "s", yAxisID: "y", order: 2 },
        { type: "line", label: "Efectividad %", data: eff,
          borderColor: WIN_DARK, backgroundColor: WIN_DARK,
          pointBackgroundColor: eff.map(effColor), pointBorderColor: eff.map(effColor),
          pointRadius: 5, tension: 0.35,
          yAxisID: "y1", order: 1 }
      ]
    },
    options: baseOpts({
      plugins: {
        legend: { labels: { boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: {
          label: c => c.dataset.type === "line"
            ? `Efectividad: ${c.parsed.y}%`
            : `${c.dataset.label}: ${c.parsed.y}`,
          footer: items => {
            const r = rows[items[0].dataIndex];
            return `Total: ${r.pj}`;
          }
        } }
      },
      scales: {
        x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
        y: { stacked: true, position: "left", beginAtZero: true,
             grid: { color: GRID }, ticks: { color: TICK, precision: 0 },
             title: { display: true, text: "Partidos", color: TICK } },
        y1: { position: "right", beginAtZero: true, max: 100,
              grid: { drawOnChartArea: false }, ticks: { color: WIN_DARK, callback: v => v + "%" },
              title: { display: true, text: "Efectividad", color: WIN_DARK } }
      }
    })
  });
}

init();

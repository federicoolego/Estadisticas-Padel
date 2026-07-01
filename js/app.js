// ===== Padel Stats Dashboard =====
const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let ALL = [];
let charts = {};

const filters = { companiero: "", rival: "", anio: "", mes: "", cancha: "", formato: "" };

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
  render();
}

function uniqueSorted(key) {
  return [...new Set(ALL.map(m => m[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "es", { numeric: true }));
}

function buildFilterOptions() {
  fillSelect("f-companiero", uniqueSorted("companiero"));
  fillSelect("f-rival", rivalPlayers());
  fillSelect("f-anio", uniqueSorted("anio"));
  fillSelect("f-mes", uniqueSorted("mes").map(n => [n, MESES[n]]));
  fillSelect("f-cancha", uniqueSorted("cancha"));
  fillSelect("f-formato", uniqueSorted("formato"));
}

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

function fillSelect(id, items) {
  const sel = el(id);
  items.forEach(it => {
    const opt = document.createElement("option");
    if (Array.isArray(it)) { opt.value = it[0]; opt.textContent = it[1]; }
    else { opt.value = it; opt.textContent = it; }
    sel.appendChild(opt);
  });
}

function bindFilters() {
  const map = {
    "f-companiero": "companiero", "f-rival": "rival", "f-anio": "anio",
    "f-mes": "mes", "f-cancha": "cancha", "f-formato": "formato"
  };
  Object.entries(map).forEach(([id, key]) => {
    el(id).addEventListener("change", e => { filters[key] = e.target.value; render(); });
  });
  el("reset").addEventListener("click", () => {
    Object.keys(filters).forEach(k => filters[k] = "");
    document.querySelectorAll(".filters select").forEach(s => s.value = "");
    render();
  });
}

function applyFilters() {
  return ALL.filter(m =>
    (!filters.companiero || m.companiero === filters.companiero) &&
    (!filters.rival || splitRivals(m.rivales).includes(filters.rival)) &&
    (!filters.anio || String(m.anio) === filters.anio) &&
    (!filters.mes || String(m.mes) === filters.mes) &&
    (!filters.cancha || m.cancha === filters.cancha) &&
    (!filters.formato || m.formato === filters.formato)
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
}

// ---- Chart helpers ----
const GRID = "#2a313c", TICK = "#8b949e", WIN = "#4ade80", LOSS = "#f87171", ACCENT = "#2563eb";
Chart.defaults.color = TICK;
Chart.defaults.font.family = "Inter, sans-serif";

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

function renderCharts(data) {
  // 1. Win/Loss doughnut
  const s = stats(data);
  destroyChart("wl");
  charts.wl = new Chart(el("chart-wl"), {
    type: "doughnut",
    data: {
      labels: ["Ganados", "Perdidos"],
      datasets: [{ data: [s.pg, s.pp], backgroundColor: [WIN, LOSS], borderColor: "#161b22", borderWidth: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14 } } } }
  });

  // 2. Efectividad por mes (línea, orden cronológico anio-mes)
  const byMonth = {};
  data.forEach(m => {
    const key = `${m.anio}-${String(m.mes).padStart(2, "0")}`;
    (byMonth[key] = byMonth[key] || []).push(m);
  });
  const monthKeys = Object.keys(byMonth).sort();
  destroyChart("mes");
  charts.mes = new Chart(el("chart-mes"), {
    type: "line",
    data: {
      labels: monthKeys.map(k => { const [y, mo] = k.split("-"); return `${MESES[+mo].slice(0, 3)} ${y.slice(2)}`; }),
      datasets: [{
        label: "Efectividad %",
        data: monthKeys.map(k => +(stats(byMonth[k]).eff * 100).toFixed(1)),
        borderColor: WIN, backgroundColor: "rgba(74,222,128,0.15)",
        fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: WIN
      }]
    },
    options: baseOpts({ scales: {
      x: { grid: { color: GRID }, ticks: { color: TICK } },
      y: { grid: { color: GRID }, ticks: { color: TICK, callback: v => v + "%" }, beginAtZero: true, max: 100 }
    }, plugins: { legend: { display: false } } })
  });

  // 3. Combo por formato / cancha: barras apiladas PG/PP (total = alto de barra) + línea de efectividad
  const comboBar = (key, canvasId, chartKey) => {
    const groups = {};
    data.forEach(m => {
      const g = m[key] || "—";
      groups[g] = groups[g] || { pg: 0, pp: 0 };
      groups[g][m.resultado === "PG" ? "pg" : "pp"]++;
    });
    // orden por total de partidos (PJ) desc
    const labels = Object.keys(groups).sort((a, b) =>
      (groups[b].pg + groups[b].pp) - (groups[a].pg + groups[a].pp));
    const eff = labels.map(l => {
      const pj = groups[l].pg + groups[l].pp;
      return pj ? +((groups[l].pg / pj) * 100).toFixed(1) : 0;
    });
    destroyChart(chartKey);
    charts[chartKey] = new Chart(el(canvasId), {
      data: {
        labels,
        datasets: [
          { type: "bar", label: "Ganados", data: labels.map(l => groups[l].pg),
            backgroundColor: WIN, stack: "s", yAxisID: "y", order: 2 },
          { type: "bar", label: "Perdidos", data: labels.map(l => groups[l].pp),
            backgroundColor: LOSS, stack: "s", yAxisID: "y", order: 2 },
          { type: "line", label: "Efectividad %", data: eff,
            borderColor: ACCENT, backgroundColor: ACCENT,
            pointBackgroundColor: ACCENT, pointRadius: 4, tension: 0.35,
            yAxisID: "y1", order: 1 }
        ]
      },
      options: baseOpts({
        plugins: {
          legend: { labels: { boxWidth: 12, padding: 14 } },
          tooltip: { callbacks: { label: c =>
            c.dataset.type === "line"
              ? `Efectividad: ${c.parsed.y}%`
              : `${c.dataset.label}: ${c.parsed.y}` } }
        },
        scales: {
          x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
          y: { stacked: true, position: "left", beginAtZero: true,
               grid: { color: GRID }, ticks: { color: TICK, precision: 0 },
               title: { display: true, text: "Partidos", color: TICK } },
          y1: { position: "right", beginAtZero: true, max: 100,
                grid: { drawOnChartArea: false }, ticks: { color: ACCENT, callback: v => v + "%" },
                title: { display: true, text: "Efectividad", color: ACCENT } }
        }
      })
    });
  };
  comboBar("formato", "chart-formato", "formato");
  comboBar("cancha", "chart-cancha", "cancha");

  // 4. TOP 5 compañeros y rivales: orden PJ → PG → alfabético
  topRanking("companiero", "chart-comp", "comp");
  topRanking("rivales", "chart-rival", "rival");
}

function topRanking(key, canvasId, chartKey) {
  const data = applyFilters();
  const groups = {};
  data.forEach(m => {
    const g = m[key];
    if (!g) return;
    groups[g] = groups[g] || { pj: 0, pg: 0 };
    groups[g].pj++;
    if (m.resultado === "PG") groups[g].pg++;
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
          borderColor: ACCENT, backgroundColor: ACCENT,
          pointBackgroundColor: ACCENT, pointRadius: 4, tension: 0.35,
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
              grid: { drawOnChartArea: false }, ticks: { color: ACCENT, callback: v => v + "%" },
              title: { display: true, text: "Efectividad", color: ACCENT } }
      }
    })
  });
}

init();

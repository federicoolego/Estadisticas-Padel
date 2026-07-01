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
  fillSelect("f-rival", uniqueSorted("rivales"));
  fillSelect("f-anio", uniqueSorted("anio"));
  fillSelect("f-mes", uniqueSorted("mes").map(n => [n, MESES[n]]));
  fillSelect("f-cancha", uniqueSorted("cancha"));
  fillSelect("f-formato", uniqueSorted("formato"));
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
    (!filters.rival || m.rivales === filters.rival) &&
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
const GRID = "#2a313c", TICK = "#8b949e", WIN = "#4ade80", LOSS = "#f87171", ACCENT = "#38bdf8";
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

  // 3. PG vs PP por formato
  const groupBar = (key, canvasId, chartKey) => {
    const groups = {};
    data.forEach(m => {
      const g = m[key] || "—";
      groups[g] = groups[g] || { pg: 0, pp: 0 };
      groups[g][m.resultado === "PG" ? "pg" : "pp"]++;
    });
    const labels = Object.keys(groups).sort((a, b) =>
      (groups[b].pg + groups[b].pp) - (groups[a].pg + groups[a].pp));
    destroyChart(chartKey);
    charts[chartKey] = new Chart(el(canvasId), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Ganados", data: labels.map(l => groups[l].pg), backgroundColor: WIN },
          { label: "Perdidos", data: labels.map(l => groups[l].pp), backgroundColor: LOSS }
        ]
      },
      options: baseOpts({ scales: {
        x: { stacked: true, grid: { color: GRID }, ticks: { color: TICK } },
        y: { stacked: true, grid: { color: GRID }, ticks: { color: TICK }, beginAtZero: true }
      }})
    });
  };
  groupBar("formato", "chart-formato", "formato");
  groupBar("cancha", "chart-cancha", "cancha");

  // 4. Top compañeros por efectividad (mín 2 PJ)
  topBar("companiero", "chart-comp", "comp");
  topBar("rivales", "chart-rival", "rival");
}

function topBar(key, canvasId, chartKey) {
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
    .filter(([, v]) => v.pj >= 2)
    .map(([name, v]) => ({ name, pj: v.pj, eff: v.pg / v.pj }))
    .sort((a, b) => b.eff - a.eff || b.pj - a.pj)
    .slice(0, 8);
  destroyChart(chartKey);
  charts[chartKey] = new Chart(el(canvasId), {
    type: "bar",
    data: {
      labels: rows.map(r => `${r.name} (${r.pj})`),
      datasets: [{
        label: "Efectividad %",
        data: rows.map(r => +(r.eff * 100).toFixed(1)),
        backgroundColor: rows.map(r => r.eff >= 0.5 ? WIN : LOSS)
      }]
    },
    options: baseOpts({
      indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + "%" } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK, callback: v => v + "%" }, beginAtZero: true, max: 100 },
        y: { grid: { color: GRID }, ticks: { color: TICK } }
      }
    })
  });
}

init();

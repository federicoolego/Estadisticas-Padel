// ===== Padel Stats Dashboard =====
const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let ALL = [];
let charts = {};

const filters = { companiero: [], rival: [], anio: [], mes: [], cancha: [], formato: [], resultado: [], lastN: null };

const el = (id) => document.getElementById(id);

async function init() {
  try {
    ALL = await window.APP_ENV.loadTable("partidos");
  } catch (e) {
    console.error("Error cargando partidos:", e);
    const envMsg = window.APP_ENV && window.APP_ENV.isProd
      ? "No se pudieron cargar los partidos desde Supabase. Revisá la consola."
      : 'No se pudo cargar data/partidos.json. Si abriste el archivo directamente, servilo con un servidor local (ej: <code>python -m http.server</code>).';
    document.querySelector(".wrap").innerHTML = `<p class="empty">${envMsg}</p>`;
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
  setupCombo("combo-resultado", [["PG", "✅ Ganado"], ["PP", "❌ Perdido"]], "resultado", "Todos");
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
  const lastNInput = el("last-n");
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
  el("reset").addEventListener("click", () => {
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

function applyFilters() {
  const f = filters;
  let list = ALL.filter(m =>
    (!f.companiero.length || f.companiero.includes(m.companiero)) &&
    (!f.rival.length || splitRivals(m.rivales).some(p => f.rival.includes(p))) &&
    (!f.anio.length || f.anio.includes(String(m.anio))) &&
    (!f.mes.length || f.mes.includes(String(m.mes))) &&
    (!f.cancha.length || f.cancha.includes(m.cancha)) &&
    (!f.formato.length || f.formato.includes(m.formato)) &&
    (!f.resultado.length || f.resultado.includes(m.resultado))
  );
  if (f.lastN && f.lastN > 0) {
    // Últimos N por id descendente (los más recientes cargados)
    list = [...list].sort((a, b) => b.id - a.id).slice(0, f.lastN);
  }
  return list;
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
    return `<tr data-id="${m.id}">
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

  // Rango de fechas, promedio y máxima racha de días sin jugar
  let fechaMin = null, fechaMax = null, dias = 0, prom = 0;
  let maxSinJugar = 0, vecesMax = 0, gapsMax = [], diasRangoSinJugar = 0;
  let diasSinJugarActual = 0;
  if (pj > 0) {
    const times = list
      .map(m => {
        if (!m.fecha) return null;
        const [y, mo, d] = m.fecha.split("-").map(Number);
        return new Date(y, mo - 1, d).getTime();
      })
      .filter(t => t !== null && !isNaN(t));
    if (times.length) {
      const tMin = Math.min(...times);
      const tMax = Math.max(...times);
      fechaMin = new Date(tMin);
      fechaMax = new Date(tMax);
      dias = Math.round((tMax - tMin) / 86400000);
      prom = pj / Math.max(dias, 1);

      // Gaps entre días consecutivos con partido, guardando el rango exacto
      const uniqDays = [...new Set(times.map(t => Math.round(t / 86400000)))].sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < uniqDays.length; i++) {
        const gap = uniqDays[i] - uniqDays[i - 1] - 1;
        if (gap > 0) {
          gaps.push({
            length: gap,
            fromDay: uniqDays[i - 1] + 1,
            toDay: uniqDays[i] - 1,
            openEnded: false,
          });
        }
      }

      // Rango efectivo del KPI "sin jugar": si se extiende hasta hoy, usa hoy como fin
      diasRangoSinJugar = dias;
      const allTimes = ALL
        .map(m => {
          if (!m.fecha) return null;
          const [y, mo, d] = m.fecha.split("-").map(Number);
          return new Date(y, mo - 1, d).getTime();
        })
        .filter(t => t !== null && !isNaN(t));
      const tMaxAll = allTimes.length ? Math.max(...allTimes) : tMax;
      if (tMax === tMaxAll) {
        const hoy = new Date();
        const hoyDay = Math.round(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() / 86400000);
        const lastDay = uniqDays[uniqDays.length - 1];
        const gapAbierto = hoyDay - lastDay;
        if (gapAbierto > 0) {
          gaps.push({
            length: gapAbierto,
            fromDay: lastDay + 1,
            toDay: hoyDay,
            openEnded: true,
          });
          diasRangoSinJugar = hoyDay - uniqDays[0];
        }
      }

      if (gaps.length) {
        maxSinJugar = Math.max(...gaps.map(g => g.length));
        gapsMax = gaps.filter(g => g.length === maxSinJugar);
        vecesMax = gapsMax.length;
      }

      // Días sin jugar ACTUAL: hoy - último partido del filtro (nunca negativo)
      const hoyActual = new Date();
      const hoyDayActual = Math.round(new Date(hoyActual.getFullYear(), hoyActual.getMonth(), hoyActual.getDate()).getTime() / 86400000);
      const lastDayActual = Math.round(tMax / 86400000);
      diasSinJugarActual = Math.max(0, hoyDayActual - lastDayActual);
    }
  }
  return { pj, pg, pp, dif, eff, fechaMin, fechaMax, dias, prom, maxSinJugar, vecesMax, gapsMax, diasRangoSinJugar, diasSinJugarActual };
}

// Rachas sobre la lista filtrada, ordenada cronológicamente por # (id).
// target = "PG" (racha positiva) o "PP" (negativa).
// Devuelve { max, veces, actual }: mejor racha, cuántas veces se alcanzó ese máximo, y la racha vigente al final.
function streak(list, target) {
  const seq = [...list].sort((a, b) => a.id - b.id);
  let max = 0, run = 0, runStart = -1, actual = 0;
  const runs = []; // { length, fromIdx, toIdx }
  seq.forEach((m, i) => {
    if (m.resultado === target) {
      if (run === 0) runStart = i;
      run++;
      if (run > max) max = run;
    } else {
      if (run > 0) runs.push({ length: run, fromIdx: runStart, toIdx: i - 1 });
      run = 0;
    }
  });
  if (run > 0) runs.push({ length: run, fromIdx: runStart, toIdx: seq.length - 1 });

  const maxRuns = runs.filter(r => r.length === max && max > 0);
  const veces = maxRuns.length;

  // racha actual: contar desde el final mientras coincida
  let actualStart = -1;
  for (let i = seq.length - 1; i >= 0; i--) {
    if (seq[i].resultado === target) { actual++; actualStart = i; } else break;
  }

  // Rangos de fechas de las rachas máximas
  const rangos = maxRuns.map(r => ({
    fecha1: seq[r.fromIdx] && seq[r.fromIdx].fecha,
    fecha2: seq[r.toIdx] && seq[r.toIdx].fecha,
  }));

  // Rango de fechas de la racha actual (vigente al final)
  const rangoActual = actual > 0
    ? { fecha1: seq[actualStart] && seq[actualStart].fecha, fecha2: seq[seq.length - 1] && seq[seq.length - 1].fecha }
    : null;

  return { max, veces, actual, rangos, rangoActual };
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

  // Frecuencia de juego: días entre partidos (métrica principal) + partidos por día (secundaria)
  const promEl = el("kpi-prom");
  const promSub = el("kpi-prom-sub");
  const promCard = el("kpi-card-prom");
  if (s.pj === 0 || !s.fechaMin) {
    promEl.textContent = "–";
    promSub.textContent = "";
    promCard.removeAttribute("data-tip");
  } else {
    const fmt = d => String(d.getDate()).padStart(2, "0") + "/" +
                    String(d.getMonth() + 1).padStart(2, "0") + "/" +
                    d.getFullYear();
    if (s.dias === 0) {
      promEl.innerHTML = "0<small> días/partido</small>";
      promSub.textContent = "mismo día";
      promCard.setAttribute("data-tip", fmt(s.fechaMin));
    } else {
      const diasPorPartido = s.dias / s.pj;
      promEl.innerHTML = diasPorPartido.toFixed(2) + "<small> días/partido</small>";
      promSub.textContent = `${s.dias} ${s.dias === 1 ? "día" : "días"}`;
      promCard.setAttribute("data-tip", `${fmt(s.fechaMin)} – ${fmt(s.fechaMax)}`);
    }
  }

  // Días sin jugar dentro del rango filtrado
  const sinEl = el("kpi-sinjugar");
  const sinSub = el("kpi-sinjugar-sub");
  const sinCard = el("kpi-card-sinjugar");
  if (s.pj === 0 || !s.fechaMin) {
    sinEl.textContent = "–";
    sinSub.textContent = "";
    sinCard.removeAttribute("data-tip");
  } else {
    sinEl.innerHTML = s.maxSinJugar + (s.maxSinJugar ? ` <small>(${s.vecesMax})</small>` : "");
    sinSub.textContent = `${s.diasRangoSinJugar} ${s.diasRangoSinJugar === 1 ? "día" : "días"}`;
    if (s.maxSinJugar && s.gapsMax.length) {
      const fmtDay = dayNum => {
        const d = new Date(dayNum * 86400000);
        return String(d.getUTCDate()).padStart(2, "0") + "/" +
               String(d.getUTCMonth() + 1).padStart(2, "0") + "/" +
               d.getUTCFullYear();
      };
      const lineas = s.gapsMax.map(g =>
        `${fmtDay(g.fromDay)} – ${g.openEnded ? "HOY" : fmtDay(g.toDay)}`
      );
      sinCard.setAttribute("data-tip", lineas.join("\n"));
    } else {
      sinCard.removeAttribute("data-tip");
    }
  }

  // Días sin jugar ACTUAL: desde el último partido del filtro hasta hoy
  const sinActEl = el("kpi-sinjugar-actual");
  const sinActSub = el("kpi-sinjugar-actual-sub");
  const sinActCard = el("kpi-card-sinjugar-actual");
  if (s.pj === 0 || !s.fechaMax) {
    sinActEl.textContent = "–";
    sinActSub.textContent = "";
    sinActCard.removeAttribute("data-tip");
  } else {
    sinActEl.textContent = s.diasSinJugarActual;
    sinActSub.textContent = s.diasSinJugarActual === 1 ? "día" : "días";
    const fmtISOdate = d => {
      return String(d.getDate()).padStart(2, "0") + "/" +
             String(d.getMonth() + 1).padStart(2, "0") + "/" +
             d.getFullYear();
    };
    if (s.diasSinJugarActual > 0) {
      // El período "sin jugar" arranca el día siguiente al último partido
      const desde = new Date(s.fechaMax.getFullYear(), s.fechaMax.getMonth(), s.fechaMax.getDate() + 1);
      sinActCard.setAttribute("data-tip", `${fmtISOdate(desde)} – HOY`);
    } else {
      sinActCard.setAttribute("data-tip", `HOY (${fmtISOdate(s.fechaMax)})`);
    }
  }

  const rp = streak(data, "PG");
  const rn = streak(data, "PP");
  el("kpi-rp").innerHTML = rp.max + (rp.max ? ` <small>(${rp.veces})</small>` : "");
  el("kpi-rn").innerHTML = rn.max + (rn.max ? ` <small>(${rn.veces})</small>` : "");

  const fmtISO = iso => {
    if (!iso) return "?";
    const [y, mo, d] = iso.split("-");
    return `${d}/${mo}/${y}`;
  };
  const diasEntre = (iso1, iso2) => {
    if (!iso1 || !iso2) return 0;
    const [y1, m1, d1] = iso1.split("-").map(Number);
    const [y2, m2, d2] = iso2.split("-").map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.abs(Math.round((t2 - t1) / 86400000));
  };
  const buildStreakTip = rangos => rangos.map(r =>
    r.fecha1 === r.fecha2 ? fmtISO(r.fecha1) : `${fmtISO(r.fecha1)} – ${fmtISO(r.fecha2)}`
  ).join("\n");
  const maxDiasRango = rangos => rangos.reduce((mx, r) => Math.max(mx, diasEntre(r.fecha1, r.fecha2)), 0);
  const setStreakSub = (subEl, rangos) => {
    if (!rangos || !rangos.length) { subEl.textContent = ""; return; }
    const d = maxDiasRango(rangos);
    subEl.textContent = `${d} ${d === 1 ? "día" : "días"}`;
  };

  const rpCard = el("kpi-card-rp");
  const rnCard = el("kpi-card-rn");
  const rpSub = el("kpi-rp-sub");
  const rnSub = el("kpi-rn-sub");
  if (rp.max && rp.rangos.length) {
    rpCard.setAttribute("data-tip", buildStreakTip(rp.rangos));
    setStreakSub(rpSub, rp.rangos);
  } else {
    rpCard.removeAttribute("data-tip");
    rpSub.textContent = "";
  }
  if (rn.max && rn.rangos.length) {
    rnCard.setAttribute("data-tip", buildStreakTip(rn.rangos));
    setStreakSub(rnSub, rn.rangos);
  } else {
    rnCard.removeAttribute("data-tip");
    rnSub.textContent = "";
  }

  // Racha actual: una sola métrica. Positiva -> verde, negativa -> rojo.
  const card = el("kpi-card-actual");
  const raSub = el("kpi-ra-sub");
  card.classList.remove("win", "loss");
  let valor, tip, rangoAct = null;
  if (rp.actual > 0) {
    valor = rp.actual;
    rangoAct = rp.rangoActual;
    card.classList.add("win");
  } else if (rn.actual > 0) {
    valor = rn.actual;
    rangoAct = rn.rangoActual;
    card.classList.add("loss");
  } else {
    valor = 0;
  }
  if (rangoAct) {
    tip = rangoAct.fecha1 === rangoAct.fecha2
      ? fmtISO(rangoAct.fecha1)
      : `${fmtISO(rangoAct.fecha1)} – ${fmtISO(rangoAct.fecha2)}`;
    const d = diasEntre(rangoAct.fecha1, rangoAct.fecha2);
    raSub.textContent = `${d} ${d === 1 ? "día" : "días"}`;
  } else {
    tip = "Sin partidos en el filtro actual";
    raSub.textContent = "";
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

window.initPartidos = init;

// ================= WhatsApp: botón flotante arrastrable + imagen de KPIs =================
(function () {
  const fab = document.getElementById("wa-share");
  if (!fab) return;

  // ---- Drag (mouse + touch) ----
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  const M = 6; // margen mínimo al borde

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function place(left, top) {
    const w = fab.offsetWidth, h = fab.offsetHeight;
    left = clamp(left, M, window.innerWidth - w - M);
    top = clamp(top, M, window.innerHeight - h - M);
    fab.style.left = left + "px";
    fab.style.top = top + "px";
    fab.style.right = "auto";
    fab.style.bottom = "auto";
  }

  function down(x, y) {
    dragging = true; moved = false;
    const r = fab.getBoundingClientRect();
    ox = x - r.left; oy = y - r.top; sx = x; sy = y;
    fab.classList.add("dragging");
  }
  function move(x, y) {
    if (!dragging) return;
    if (Math.abs(x - sx) > 4 || Math.abs(y - sy) > 4) moved = true;
    place(x - ox, y - oy);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove("dragging");
  }

  fab.addEventListener("mousedown", e => { down(e.clientX, e.clientY); e.preventDefault(); });
  window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  window.addEventListener("mouseup", up);

  fab.addEventListener("touchstart", e => { const t = e.touches[0]; down(t.clientX, t.clientY); }, { passive: true });
  fab.addEventListener("touchmove", e => { const t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
  fab.addEventListener("touchend", up);

  window.addEventListener("resize", () => {
    const r = fab.getBoundingClientRect();
    if (fab.style.left) place(r.left, r.top);
  });

  // No compartir si fue un arrastre
  fab.addEventListener("click", e => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
    // Delegar a la tab activa
    const torneosTab = document.getElementById("tab-torneos");
    if (torneosTab && torneosTab.classList.contains("active")) {
      if (typeof window.shareTorneosStats === "function") window.shareTorneosStats();
      return;
    }
    shareStats();
  });

  // ---- Generación de la imagen (solo KPIs) ----
  function txt(id) { const e = el(id); return e ? e.textContent.trim() : "–"; }
  const FILTER_LABELS = {
    anio: "Año", mes: "Mes", formato: "Formato",
    cancha: "Cancha", companiero: "Compañero", rival: "Rival", resultado: "Resultado",
    lastN: "Últimos"
  };
  // orden de aparición de los filtros
  const FILTER_ORDER = ["anio", "mes", "formato", "cancha", "companiero", "rival", "resultado", "lastN"];

  function labelForValue(filterKey, val) {
    if (filterKey === "mes") {
      const n = parseInt(val, 10);
      return (typeof MESES !== "undefined" && MESES[n]) ? MESES[n] : String(val);
    }
    if (filterKey === "resultado") {
      return val === "PG" ? "Ganado" : val === "PP" ? "Perdido" : val;
    }
    return String(val);
  }

  function shownFilters() {
    const out = [];
    FILTER_ORDER.forEach(key => {
      if (key === "lastN") {
        if (filters.lastN) out.push(`${FILTER_LABELS.lastN}: ${filters.lastN}`);
        return;
      }
      const arr = filters[key] || [];
      if (arr.length) {
        const vals = arr.map(v => labelForValue(key, v)).join(", ");
        out.push((FILTER_LABELS[key] || key) + ": " + vals);
      }
    });
    return out;
  }

  function buildImage() {
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
    // glow verde arriba-izq
    const rg = ctx.createRadialGradient(150, -40, 0, 150, -40, 520);
    rg.addColorStop(0, "rgba(74,222,128,0.16)"); rg.addColorStop(1, "rgba(74,222,128,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    const PAD = 64;
    // eyebrow
    ctx.fillStyle = "#4ade80";
    ctx.font = "600 22px Inter, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("RENDIMIENTO TOTAL", PAD, 96);
    // título
    ctx.fillStyle = "#e6edf3";
    ctx.font = "700 76px 'Barlow Condensed', Arial Narrow, sans-serif";
    ctx.fillText("MIS PARTIDOS DE PÁDEL", PAD, 168);
    // subtítulo / última actualización
    ctx.fillStyle = "#8b949e";
    ctx.font = "500 24px Inter, sans-serif";
    ctx.fillText(txt("last-update") || "", PAD, 208);

    // filtros activos (si hay)
    const fl = shownFilters();
    let filterLine = fl.length ? fl.join("  ·  ") : "Todos los partidos";
    ctx.fillStyle = "#9aa4b0";
    ctx.font = "500 22px Inter, sans-serif";
    if (ctx.measureText(filterLine).width > W - PAD * 2) {
      while (ctx.measureText(filterLine + "…").width > W - PAD * 2 && filterLine.length) filterLine = filterLine.slice(0, -1);
      filterLine += "…";
    }
    ctx.fillText("Filtros · " + filterLine, PAD, 248);

    // datos KPI (4 columnas x 3 filas, 10 items)
    const eff = txt("kpi-eff");
    const cards = [
      { label: "PARTIDOS JUGADOS", value: txt("kpi-pj"), color: "#e6edf3" },
      { label: "GANADOS", value: txt("kpi-pg"), color: "#4ade80" },
      { label: "PERDIDOS", value: txt("kpi-pp"), color: "#f87171" },
      { label: "DIFERENCIA", value: txt("kpi-dif"), color: "#e6edf3" },
      { label: "PROMEDIO PARTIDOS", value: txt("kpi-prom"), color: "#e6edf3" },
      { label: "DÍAS SIN JUGAR", value: txt("kpi-sinjugar"), color: "#e6edf3" },
      { label: "DÍAS SIN JUGAR ACTUAL", value: txt("kpi-sinjugar-actual"), color: "#e6edf3" },
      { label: "EFECTIVIDAD", value: eff, color: "#4ade80" },
      { label: "MEJOR RACHA", value: txt("kpi-rp"), color: "#4ade80" },
      { label: "PEOR RACHA", value: txt("kpi-rn"), color: "#f87171" },
      { label: "RACHA ACTUAL", value: txt("kpi-ra"), color: el("kpi-card-actual").classList.contains("loss") ? "#f87171" : "#4ade80" },
    ];

    // grilla 4 columnas x 3 filas (últimos 2 slots vacíos)
    const cols = 4, gap = 18;
    const gridTop = 300, gridBottom = 1000;
    const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
    const rows = Math.ceil(cards.length / cols);
    const ch = (gridBottom - gridTop - gap * (rows - 1)) / rows;

    cards.forEach((c, i) => {
      const cx = PAD + (i % cols) * (cw + gap);
      const cy = gridTop + Math.floor(i / cols) * (ch + gap);
      // tarjeta
      roundRect(ctx, cx, cy, cw, ch, 18);
      ctx.fillStyle = "#161b22"; ctx.fill();
      ctx.strokeStyle = "#2a313c"; ctx.lineWidth = 1; ctx.stroke();
      // barrita de acento
      ctx.fillStyle = c.color;
      roundRect(ctx, cx, cy, 6, ch, 3); ctx.fill();
      // label
      ctx.fillStyle = "#8b949e";
      ctx.font = "600 15px Inter, sans-serif";
      ctx.fillText(c.label, cx + 22, cy + 34);
      // valor (limpiar % y paréntesis para render numérico grande)
      ctx.fillStyle = c.color;
      ctx.font = "700 52px 'Barlow Condensed', Arial Narrow, sans-serif";
      ctx.fillText(c.value.replace(/\s+/g, " "), cx + 22, cy + ch - 24);
    });

    // footer
    ctx.fillStyle = "#8b949e";
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("Estadísticas de Pádel · Federico Olego", PAD, 1048);

    return cv;
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

  function canvasToBlob(cv) {
    return new Promise(res => cv.toBlob(res, "image/png"));
  }

  async function shareStats() {
    fab.classList.add("busy");
    try {
      // esperar a que las fuentes estén listas para el canvas
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      const cv = buildImage();
      const blob = await canvasToBlob(cv);
      const file = new File([blob], "mis-estadisticas-padel.png", { type: "image/png" });
      const rec = txt("record").replace(/\s+/g, "");
      const text = "Mis estadísticas de pádel 🎾 " + (txt("kpi-pg") + " ganados / " + txt("kpi-pp") + " perdidos · " + txt("kpi-eff") + " efectividad");

      // 1) Web Share con archivo (móvil moderno)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      // 2) Fallback: descargar imagen + abrir WhatsApp con el texto
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
    } catch (err) {
      if (err && err.name === "AbortError") return; // usuario canceló el share
      console.error(err);
      alert("No se pudo generar la imagen para compartir.");
    } finally {
      fab.classList.remove("busy");
    }
  }
})();
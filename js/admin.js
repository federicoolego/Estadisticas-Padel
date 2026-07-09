// ===== Módulo Administrador + Switch de entorno (v4) =====
// v4 final: catálogos normalizados + panel de gestión de catálogos con contador de uso.

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const modalRoot = document.getElementById("admin-modal-root");
  const envBtn = document.getElementById("env-toggle");
  const envIcon = envBtn && envBtn.querySelector(".env-toggle-icon");
  const envLabel = envBtn && envBtn.querySelector(".env-toggle-label");
  const toggleBtn = document.getElementById("admin-toggle");
  const toggleIcon = toggleBtn && toggleBtn.querySelector(".admin-toggle-icon");
  const toggleLabel = toggleBtn && toggleBtn.querySelector(".admin-toggle-label");

  const IS_PROD = !!(window.APP_ENV && window.APP_ENV.isProd);

  // ====================================================================
  //   BLOQUE 1 · Switch de entorno (siempre activo)
  // ====================================================================
  function refreshEnvButton() {
    if (!envBtn) return;
    if (IS_PROD) {
      envIcon.textContent = "☁️";
      envLabel.textContent = "Producción";
      envBtn.title = "Entorno: Producción (Supabase) · click para cambiar";
      envBtn.classList.add("prod"); envBtn.classList.remove("local");
    } else {
      envIcon.textContent = "🖥️";
      envLabel.textContent = "Local";
      envBtn.title = "Entorno: Local (JSON estáticos, solo lectura) · click para cambiar";
      envBtn.classList.add("local"); envBtn.classList.remove("prod");
    }
  }
  refreshEnvButton();
  if (envBtn) envBtn.addEventListener("click", openEnvModal);

  function openEnvModal() {
    openModal(`
      <h2 class="admin-title">Cambiar entorno</h2>
      <p class="admin-sub">Elegí desde qué fuente se cargan los datos.</p>
      <div class="env-options">
        <button type="button" class="env-option ${!IS_PROD ? "active" : ""}" data-env="local">
          <span class="env-option-icon">🖥️</span>
          <div class="env-option-body">
            <strong>Local</strong>
            <small>Lee <code>data/partidos.json</code> y <code>data/torneos.json</code> del repo.<br>Solo lectura.</small>
          </div>
        </button>
        <button type="button" class="env-option ${IS_PROD ? "active" : ""}" data-env="prod">
          <span class="env-option-icon">☁️</span>
          <div class="env-option-body">
            <strong>Producción</strong>
            <small>Lee y escribe contra Supabase.<br>Requiere iniciar sesión para editar.</small>
          </div>
        </button>
      </div>
      <p class="admin-hint">Al cambiar el entorno la página se recarga automáticamente.</p>
      <div class="admin-actions">
        <button type="button" class="admin-btn ghost" data-close>Cerrar</button>
      </div>
    `);
    modalRoot.querySelectorAll(".env-option").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.env;
        if ((target === "prod") === IS_PROD) { closeModal(); return; }
        window.APP_ENV.setMode(target);
      });
    });
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
  }

  // ====================================================================
  //   Modal helpers
  // ====================================================================
  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.classList.remove("admin-modal-open");
    document.removeEventListener("keydown", escToClose);
  }
  function openModal(html, opts = {}) {
    modalRoot.innerHTML = `
      <div class="admin-backdrop">
        <div class="admin-modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">
          ${html}
        </div>
      </div>`;
    document.body.classList.add("admin-modal-open");
    modalRoot.querySelector(".admin-backdrop").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener("keydown", escToClose);
  }
  function escToClose(e) { if (e.key === "Escape") closeModal(); }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ====================================================================
  //   BLOQUE 2 · Auth + ABM (solo modo Producción)
  // ====================================================================
  if (!IS_PROD) return;
  if (!window.sb) { console.warn("admin.js: modo Producción sin cliente Supabase."); return; }

  const DIAS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  const CATALOGS = [
    { key: "canchas",       singular: "cancha",      plural: "Canchas",       viewUso: "canchas_con_uso",       icon: "🏟️" },
    { key: "formatos",      singular: "formato",     plural: "Formatos",      viewUso: "formatos_con_uso",      icon: "🎯" },
    { key: "jugadores",     singular: "jugador",     plural: "Jugadores",     viewUso: "jugadores_con_uso",     icon: "👥" },
    { key: "organizadores", singular: "organizador", plural: "Organizadores", viewUso: "organizadores_con_uso", icon: "🏛️" },
    { key: "categorias",    singular: "categoría",   plural: "Categorías",    viewUso: "categorias_con_uso",    icon: "🏷️" },
  ];
  const CATALOG_BY_KEY = Object.fromEntries(CATALOGS.map(c => [c.key, c]));

  // ---------- Sesión ----------
  async function updateSessionUI() {
    const { data: { session } } = await window.sb.auth.getSession();
    const isAdmin = !!session;
    document.body.classList.toggle("is-admin", isAdmin);
    if (isAdmin) {
      toggleIcon.textContent = "🔓";
      const email = session.user.email || "";
      toggleLabel.textContent = email.split("@")[0] || "Admin";
      toggleBtn.title = `Sesión: ${email} · click para menú`;
    } else {
      toggleIcon.textContent = "🔒";
      toggleLabel.textContent = "Admin";
      toggleBtn.title = "Modo administrador";
    }
  }
  window.sb.auth.onAuthStateChange(() => updateSessionUI());
  updateSessionUI();

  toggleBtn.addEventListener("click", async () => {
    const { data: { session } } = await window.sb.auth.getSession();
    if (session) openAdminMenu(session.user.email);
    else openLoginModal();
  });

  // ---------- Login ----------
  function openLoginModal() {
    openModal(`
      <h2 class="admin-title">Iniciar sesión</h2>
      <p class="admin-sub">Ingresá con tu usuario admin de Supabase.</p>
      <form id="admin-login-form" class="admin-form">
        <label>Email
          <input type="email" name="email" required autocomplete="username" autofocus>
        </label>
        <label>Contraseña
          <input type="password" name="password" required autocomplete="current-password">
        </label>
        <p class="admin-err" id="admin-login-err" hidden></p>
        <div class="admin-actions">
          <button type="button" class="admin-btn ghost" data-close>Cancelar</button>
          <button type="submit" class="admin-btn primary">Entrar</button>
        </div>
      </form>
    `);
    $("#admin-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = $("#admin-login-err");
      err.hidden = true;
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Entrando…";
      const { error } = await window.sb.auth.signInWithPassword({
        email: fd.get("email"), password: fd.get("password")
      });
      if (error) {
        err.textContent = "No se pudo iniciar sesión. Revisá email y contraseña.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = "Entrar";
        return;
      }
      closeModal();
      // Al loguear como admin, chequear inconsistencias entre JSON local y Supabase
      setTimeout(() => runIntegrityCheck({ silentIfOk: false }), 300);
    });
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
  }

  function openAdminMenu(email) {
    openModal(`
      <h2 class="admin-title">Modo administrador</h2>
      <p class="admin-sub">Sesión activa como <strong>${escapeHtml(email)}</strong>.</p>
      <p class="admin-hint">Con la sesión abierta podés:</p>
      <ul class="admin-list">
        <li>Usar los botones <strong>➕ Nuevo</strong> en cada pestaña.</li>
        <li>Click en cualquier <strong>fila de la tabla</strong> para editar o eliminar.</li>
        <li>Gestionar los <strong>catálogos</strong> (canchas, jugadores, formatos, etc.).</li>
      </ul>
      <div class="admin-actions with-delete">
        <button type="button" class="admin-btn danger" id="admin-logout">Cerrar sesión</button>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="admin-btn ghost" id="admin-check-integrity">🔍 Verificar integridad</button>
          <button type="button" class="admin-btn ghost" id="admin-open-catalogs">⚙️ Catálogos</button>
          <button type="button" class="admin-btn primary" data-close>Listo</button>
        </div>
      </div>
    `);
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
    $("#admin-logout").addEventListener("click", async () => {
      await window.sb.auth.signOut();
      closeModal();
    });
    $("#admin-open-catalogs").addEventListener("click", () => openCatalogsModal());
    $("#admin-check-integrity").addEventListener("click", () => runIntegrityCheck({ silentIfOk: false }));
  }

  // ====================================================================
  //   Catálogos: cache en memoria + CRUD helpers
  // ====================================================================
  const catalogCache = {
    canchas: null, formatos: null, jugadores: null,
    organizadores: null, categorias: null
  };

  async function ensureCatalogs() {
    if (catalogCache.canchas) return;
    const [canchas, formatos, jugadores, organizadores, categorias] = await Promise.all([
      window.sb.from("canchas").select("id, nombre").order("nombre"),
      window.sb.from("formatos").select("id, nombre").order("nombre"),
      window.sb.from("jugadores").select("id, nombre").order("nombre"),
      window.sb.from("organizadores").select("id, nombre").order("nombre"),
      window.sb.from("categorias").select("id, nombre").order("nombre"),
    ]);
    const results = { canchas, formatos, jugadores, organizadores, categorias };
    for (const [name, res] of Object.entries(results)) {
      if (res.error) throw new Error(`No se pudo cargar ${name}: ${res.error.message}`);
      catalogCache[name] = res.data || [];
    }
  }

  async function createCatalogItem(catalogName, nombre) {
    const clean = nombre.trim();
    if (!clean) throw new Error("El nombre no puede estar vacío.");
    const { data, error } = await window.sb
      .from(catalogName).insert({ nombre: clean }).select("id, nombre").single();
    if (error) {
      if (error.code === "23505") throw new Error(`"${clean}" ya existe en ${catalogName}.`);
      throw new Error(error.message);
    }
    const arr = catalogCache[catalogName];
    arr.push(data);
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return data;
  }

  async function updateCatalogItem(catalogName, id, nombre) {
    const clean = nombre.trim();
    if (!clean) throw new Error("El nombre no puede estar vacío.");
    const { data, error } = await window.sb
      .from(catalogName).update({ nombre: clean }).eq("id", id).select("id, nombre").single();
    if (error) {
      if (error.code === "23505") throw new Error(`"${clean}" ya existe en ${catalogName}.`);
      throw new Error(error.message);
    }
    const arr = catalogCache[catalogName];
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) arr[idx] = data;
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return data;
  }

  async function deleteCatalogItem(catalogName, id) {
    const { error } = await window.sb.from(catalogName).delete().eq("id", id);
    if (error) {
      if (error.code === "23503") throw new Error("No se puede eliminar: está en uso.");
      throw new Error(error.message);
    }
    const arr = catalogCache[catalogName];
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  }

  // ====================================================================
  //   Combobox buscable con "+ Crear nuevo"
  // ====================================================================
  let comboSeq = 0;
  function comboSkeleton(hiddenName, placeholder) {
    comboSeq++;
    return `
      <div class="admin-combo" data-combo-id="c${comboSeq}">
        <input type="text" class="admin-combo-input" placeholder="${placeholder}" autocomplete="off">
        <input type="hidden" name="${hiddenName}" value="">
        <div class="admin-combo-panel" hidden>
          <ul class="admin-combo-list"></ul>
          <button type="button" class="admin-combo-create" hidden>
            ➕ Crear "<strong></strong>"
          </button>
          <p class="admin-combo-empty" hidden>No hay coincidencias.</p>
        </div>
      </div>`;
  }

  function makeCombo({ container, catalog, initialId, canCreate = true }) {
    const items = catalogCache[catalog];
    const input = container.querySelector(".admin-combo-input");
    const hidden = container.querySelector('input[type="hidden"]');
    const panel = container.querySelector(".admin-combo-panel");
    const list = container.querySelector(".admin-combo-list");
    const createBtn = container.querySelector(".admin-combo-create");
    const emptyMsg = container.querySelector(".admin-combo-empty");
    if (!canCreate) createBtn.style.display = "none";

    if (initialId) {
      const found = items.find(x => x.id === initialId);
      if (found) { input.value = found.nombre; hidden.value = String(found.id); }
    }

    function renderList() {
      const q = input.value.trim().toLowerCase();
      const filtered = q ? items.filter(x => x.nombre.toLowerCase().includes(q)) : items;
      list.innerHTML = filtered
        .map(x => `<li data-id="${x.id}" class="${String(x.id) === hidden.value ? "selected" : ""}">${escapeHtml(x.nombre)}</li>`)
        .join("");
      emptyMsg.hidden = filtered.length > 0 || !!q;
      const exact = q && items.some(x => x.nombre.toLowerCase() === q);
      if (canCreate && q && !exact) {
        createBtn.querySelector("strong").textContent = input.value.trim();
        createBtn.hidden = false;
      } else {
        createBtn.hidden = true;
      }
    }
    function open() { panel.hidden = false; renderList(); }
    function close() { panel.hidden = true; }

    input.addEventListener("focus", open);
    input.addEventListener("input", () => { hidden.value = ""; open(); });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        const exact = items.find(x => x.nombre.toLowerCase() === q);
        if (exact) { input.value = exact.nombre; hidden.value = String(exact.id); }
        else if (!hidden.value) { input.value = ""; }
        close();
      }, 180);
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li"); if (!li) return;
      const id = Number(li.dataset.id);
      const item = items.find(x => x.id === id); if (!item) return;
      input.value = item.nombre; hidden.value = String(item.id); close();
    });
    createBtn.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      const nombre = input.value.trim(); if (!nombre) return;
      createBtn.disabled = true;
      const strong = createBtn.querySelector("strong");
      const originalTxt = strong.textContent;
      strong.textContent = "creando…";
      try {
        const newItem = await createCatalogItem(catalog, nombre);
        input.value = newItem.nombre; hidden.value = String(newItem.id); close();
      } catch (err) {
        alert("Error al crear: " + err.message);
        strong.textContent = originalTxt;
      } finally { createBtn.disabled = false; }
    });

    renderList();
    return {
      getValue: () => hidden.value ? { id: Number(hidden.value), nombre: input.value } : null,
      getId: () => hidden.value ? Number(hidden.value) : null,
      focus: () => input.focus()
    };
  }

  // ====================================================================
  //   Handlers de "Nuevo" y click en filas
  // ====================================================================
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".admin-new-btn");
    if (!btn) return;
    if (!document.body.classList.contains("is-admin")) return;
    const kind = btn.dataset.new;
    if (kind === "partido") await openPartidoForm();
    if (kind === "torneo") await openTorneoForm();
  });

  document.addEventListener("click", async (e) => {
    if (!document.body.classList.contains("is-admin")) return;
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const tbody = tr.parentElement;
    const id = Number(tr.dataset.id);
    if (tbody.id === "tabla-body") {
      const { data, error } = await window.sb.from("partidos_view").select("*").eq("id", id).single();
      if (error) return alert("No se pudo cargar el partido: " + error.message);
      await openPartidoForm(data);
    } else if (tbody.id === "t-tabla-body") {
      const { data, error } = await window.sb.from("torneos_view").select("*").eq("id", id).single();
      if (error) return alert("No se pudo cargar el torneo: " + error.message);
      await openTorneoForm(data);
    }
  });

  // ====================================================================
  //   Helpers
  // ====================================================================
  function todayISO() {
    // Fecha de hoy en la zona local, formato YYYY-MM-DD (compatible con <input type="date">)
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function deriveFromDate(fechaStr) {
    const [y, mo, d] = fechaStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12));
    return { anio: y, mes: mo, dia: DIAS_ES[dt.getUTCDay()] };
  }

  async function withLoadingModal(fn) {
    openModal(`<h2 class="admin-title">Cargando…</h2><p class="admin-sub">Preparando el formulario.</p>`);
    try { await fn(); }
    catch (e) {
      openModal(`
        <h2 class="admin-title">Error</h2>
        <p class="admin-err">${escapeHtml(e.message)}</p>
        <div class="admin-actions">
          <button type="button" class="admin-btn primary" data-close>Cerrar</button>
        </div>
      `);
      modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
    }
  }

  // ====================================================================
  //   Formulario PARTIDO
  // ====================================================================
  async function openPartidoForm(record) {
    await withLoadingModal(async () => {
      await ensureCatalogs();
      renderPartidoForm(record);
    });
  }

  function renderPartidoForm(record) {
    const isEdit = !!record;
    const r = record || {
      fecha: "", resultado: "PG",
      cancha_id: null, formato_id: null, companiero_id: null,
      rival1_id: null, rival2_id: null
    };
    openModal(`
      <h2 class="admin-title">${isEdit ? "Editar partido #" + r.id : "Nuevo partido"}</h2>
      <form id="admin-partido-form" class="admin-form">
        <label>Fecha
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}" max="${todayISO()}">
        </label>
        <div class="admin-row-2">
          <label>Cancha ${comboSkeleton("cancha_id", "Buscar cancha…")}</label>
          <label>Formato ${comboSkeleton("formato_id", "Buscar formato…")}</label>
        </div>
        <label>Compañero ${comboSkeleton("companiero_id", "Buscar jugador…")}</label>
        <div class="admin-row-2">
          <label>Rival 1 ${comboSkeleton("rival1_id", "Buscar jugador…")}</label>
          <label>Rival 2 ${comboSkeleton("rival2_id", "Buscar jugador…")}</label>
        </div>
        <label>Resultado
          <select name="resultado" required>
            <option value="PG" ${r.resultado === "PG" ? "selected" : ""}>✅ Ganado (PG)</option>
            <option value="PP" ${r.resultado === "PP" ? "selected" : ""}>❌ Perdido (PP)</option>
          </select>
        </label>
        <p class="admin-err" id="admin-partido-err" hidden></p>
        <div class="admin-actions ${isEdit ? "with-delete" : ""}">
          ${isEdit ? '<button type="button" class="admin-btn danger" id="admin-partido-del">🗑️ Eliminar</button>' : ""}
          <button type="button" class="admin-btn ghost" data-close>Cancelar</button>
          <button type="submit" class="admin-btn primary">${isEdit ? "Guardar" : "Crear"}</button>
        </div>
      </form>
    `);
    const form = $("#admin-partido-form");
    const combos = {
      cancha:     makeCombo({ container: form.querySelectorAll(".admin-combo")[0], catalog: "canchas",   initialId: r.cancha_id }),
      formato:    makeCombo({ container: form.querySelectorAll(".admin-combo")[1], catalog: "formatos",  initialId: r.formato_id }),
      companiero: makeCombo({ container: form.querySelectorAll(".admin-combo")[2], catalog: "jugadores", initialId: r.companiero_id }),
      rival1:     makeCombo({ container: form.querySelectorAll(".admin-combo")[3], catalog: "jugadores", initialId: r.rival1_id }),
      rival2:     makeCombo({ container: form.querySelectorAll(".admin-combo")[4], catalog: "jugadores", initialId: r.rival2_id }),
    };
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#admin-partido-err"); err.hidden = true;
      const fd = new FormData(form);
      const fecha = fd.get("fecha");
      if (fecha > todayISO()) {
        err.textContent = "La fecha no puede ser posterior a hoy. No se puede cargar un partido que aún no jugaste.";
        err.hidden = false; return;
      }
      const resultado = fd.get("resultado");
      const canchaId = combos.cancha.getId();
      const formatoId = combos.formato.getId();
      const companieroId = combos.companiero.getId();
      const rival1Id = combos.rival1.getId();
      const rival2Id = combos.rival2.getId();
      const missing = [];
      if (!canchaId) missing.push("Cancha");
      if (!formatoId) missing.push("Formato");
      if (!companieroId) missing.push("Compañero");
      if (!rival1Id) missing.push("Rival 1");
      if (!rival2Id) missing.push("Rival 2");
      if (missing.length) {
        err.textContent = "Faltan campos: " + missing.join(", ") + ". Elegí una opción de la lista o creá una nueva.";
        err.hidden = false; return;
      }
      if (rival1Id === rival2Id) { err.textContent = "Rival 1 y Rival 2 no pueden ser el mismo jugador."; err.hidden = false; return; }
      if (companieroId === rival1Id || companieroId === rival2Id) {
        err.textContent = "El compañero no puede ser también rival."; err.hidden = false; return;
      }
      const { anio, mes, dia } = deriveFromDate(fecha);
      const payload = {
        fecha, anio, mes, dia, resultado,
        cancha_id: canchaId, formato_id: formatoId, companiero_id: companieroId,
        rival1_id: rival1Id, rival2_id: rival2Id
      };
      await submitRecord("partidos", isEdit ? r.id : null, payload, "#admin-partido-err", form);
    });

    if (isEdit) {
      $("#admin-partido-del").addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el partido #${r.id}? Esta acción no se puede deshacer.`)) return;
        await deleteRecord("partidos", r.id, "#admin-partido-err");
      });
    }
  }

  // ====================================================================
  //   Formulario TORNEO
  // ====================================================================
  async function openTorneoForm(record) {
    await withLoadingModal(async () => {
      await ensureCatalogs();
      renderTorneoForm(record);
    });
  }

  function triSelect(name, val) {
    const opts = [
      { v: "",      label: "— No jugó" },
      { v: "true",  label: "✅ Ganó" },
      { v: "false", label: "❌ Perdió" }
    ];
    const cur = val === true ? "true" : val === false ? "false" : "";
    return `<select name="${name}">${opts.map(o =>
      `<option value="${o.v}" ${cur === o.v ? "selected" : ""}>${o.label}</option>`
    ).join("")}</select>`;
  }

  function renderTorneoForm(record) {
    const isEdit = !!record;
    const r = record || {
      fecha: "", organizador_id: null, categoria_id: null, companiero_id: null,
      zona: null, octavos: null, cuartos: null, semifinal: null, final: null, puesto: null
    };
    openModal(`
      <h2 class="admin-title">${isEdit ? "Editar torneo #" + r.id : "Nuevo torneo"}</h2>
      <form id="admin-torneo-form" class="admin-form">
        <label>Fecha
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}" max="${todayISO()}">
        </label>
        <div class="admin-row-2">
          <label>Organizador ${comboSkeleton("organizador_id", "Buscar organizador…")}</label>
          <label>Categoría ${comboSkeleton("categoria_id", "Buscar categoría…")}</label>
        </div>
        <label>Compañero ${comboSkeleton("companiero_id", "Buscar jugador…")}</label>

        <fieldset class="admin-fieldset">
          <legend>Etapas jugadas</legend>
          <div class="admin-row-etapas">
            <label>Zona ${triSelect("zona", r.zona)}</label>
            <label>Octavos ${triSelect("octavos", r.octavos)}</label>
            <label>Cuartos ${triSelect("cuartos", r.cuartos)}</label>
            <label>Semifinal ${triSelect("semifinal", r.semifinal)}</label>
            <label>Final ${triSelect("final", r.final)}</label>
          </div>
        </fieldset>

        <label>Puesto final
          <select name="puesto">
            <option value=""           ${!r.puesto ? "selected" : ""}>— Sin podio</option>
            <option value="campeon"    ${r.puesto === "campeon"    ? "selected" : ""}>🥇 Campeón</option>
            <option value="subcampeon" ${r.puesto === "subcampeon" ? "selected" : ""}>🥈 Subcampeón</option>
            <option value="tercero"    ${r.puesto === "tercero"    ? "selected" : ""}>🥉 Tercero</option>
          </select>
        </label>

        <p class="admin-err" id="admin-torneo-err" hidden></p>
        <div class="admin-actions ${isEdit ? "with-delete" : ""}">
          ${isEdit ? '<button type="button" class="admin-btn danger" id="admin-torneo-del">🗑️ Eliminar</button>' : ""}
          <button type="button" class="admin-btn ghost" data-close>Cancelar</button>
          <button type="submit" class="admin-btn primary">${isEdit ? "Guardar" : "Crear"}</button>
        </div>
      </form>
    `);
    const form = $("#admin-torneo-form");
    const combos = {
      organizador: makeCombo({ container: form.querySelectorAll(".admin-combo")[0], catalog: "organizadores", initialId: r.organizador_id }),
      categoria:   makeCombo({ container: form.querySelectorAll(".admin-combo")[1], catalog: "categorias",    initialId: r.categoria_id }),
      companiero:  makeCombo({ container: form.querySelectorAll(".admin-combo")[2], catalog: "jugadores",     initialId: r.companiero_id }),
    };
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#admin-torneo-err"); err.hidden = true;
      const fd = new FormData(form);
      const fecha = fd.get("fecha");
      if (fecha > todayISO()) {
        err.textContent = "La fecha no puede ser posterior a hoy. No se puede cargar un torneo que aún no jugaste.";
        err.hidden = false; return;
      }
      const organizadorId = combos.organizador.getId();
      const categoriaId = combos.categoria.getId();
      const companieroId = combos.companiero.getId();
      const missing = [];
      if (!organizadorId) missing.push("Organizador");
      if (!categoriaId) missing.push("Categoría");
      if (!companieroId) missing.push("Compañero");
      if (missing.length) {
        err.textContent = "Faltan campos: " + missing.join(", ") + ". Elegí una opción de la lista o creá una nueva.";
        err.hidden = false; return;
      }
      const tri = (name) => {
        const v = fd.get(name);
        if (v === "true") return true;
        if (v === "false") return false;
        return null;
      };
      const puestoRaw = fd.get("puesto");
      const { anio, mes, dia } = deriveFromDate(fecha);
      const payload = {
        fecha, anio, mes, dia,
        organizador_id: organizadorId, categoria_id: categoriaId, companiero_id: companieroId,
        zona: tri("zona"), octavos: tri("octavos"), cuartos: tri("cuartos"),
        semifinal: tri("semifinal"), final: tri("final"),
        puesto: puestoRaw || null
      };
      await submitRecord("torneos", isEdit ? r.id : null, payload, "#admin-torneo-err", form);
    });

    if (isEdit) {
      $("#admin-torneo-del").addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el torneo #${r.id}? Esta acción no se puede deshacer.`)) return;
        await deleteRecord("torneos", r.id, "#admin-torneo-err");
      });
    }
  }

  // ====================================================================
  //   Submit y delete genéricos (partidos/torneos)
  // ====================================================================
  async function submitRecord(table, id, payload, errSel, form) {
    const err = $(errSel); err.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Guardando…";
    let res;
    if (id == null) res = await window.sb.from(table).insert(payload);
    else            res = await window.sb.from(table).update(payload).eq("id", id);
    if (res.error) {
      err.textContent = "Error: " + res.error.message;
      err.hidden = false;
      btn.disabled = false; btn.textContent = id == null ? "Crear" : "Guardar";
      return;
    }
    location.reload();
  }
  async function deleteRecord(table, id, errSel) {
    const { error } = await window.sb.from(table).delete().eq("id", id);
    if (error) {
      const err = $(errSel);
      err.textContent = "No se pudo eliminar: " + error.message;
      err.hidden = false;
      return;
    }
    location.reload();
  }

  // ====================================================================
  //   BLOQUE 3 · Verificación de integridad Local (JSON) ↔ Prod (Supabase)
  // ====================================================================
  // Compara el contenido de data/partidos.json y data/torneos.json contra
  // las views partidos_view / torneos_view de Supabase, y muestra un modal
  // con las diferencias detectadas. Se dispara automáticamente al iniciar
  // sesión como admin, y también desde el menú admin ("Verificar integridad").

  // Campos que se comparan en cada tabla (ignoramos id porque es la clave,
  // pero SÍ lo usamos para hacer el match entre ambas fuentes).
  const INTEGRITY_FIELDS = {
    partidos: ["fecha","mes","anio","dia","cancha","formato","companiero","rivales","resultado"],
    torneos:  ["fecha","mes","anio","dia","organizador","companiero","categoria","zona","octavos","cuartos","semifinal","final","puesto"]
  };

  function normalizeValue(v) {
    // Normaliza para comparar: null/undefined/"" son equivalentes.
    if (v === undefined || v === null) return null;
    if (typeof v === "string") return v.trim() === "" ? null : v.trim();
    return v;
  }

  function diffRecord(fields, localRec, prodRec) {
    const diffs = [];
    for (const f of fields) {
      const a = normalizeValue(localRec[f]);
      const b = normalizeValue(prodRec[f]);
      if (a !== b) diffs.push({ field: f, local: a, prod: b });
    }
    return diffs;
  }

  async function fetchLocalJson(name) {
    // Le agrego un cache-buster para que no me lea una versión cacheada del JSON.
    const res = await fetch(`data/${name}.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`No se pudo leer data/${name}.json (HTTP ${res.status}).`);
    return await res.json();
  }

  async function fetchProdView(viewName) {
    const { data, error } = await window.sb.from(viewName).select("*").order("id", { ascending: true });
    if (error) throw new Error(`No se pudo leer ${viewName}: ${error.message}`);
    return data || [];
  }

  async function compareDatasets(name, viewName) {
    const [localArr, prodArr] = await Promise.all([
      fetchLocalJson(name),
      fetchProdView(viewName)
    ]);
    const localById = new Map(localArr.map(r => [r.id, r]));
    const prodById  = new Map(prodArr.map(r => [r.id, r]));
    const fields = INTEGRITY_FIELDS[name];

    const onlyLocal = [];   // ids que están en el JSON local pero no en Supabase
    const onlyProd  = [];   // ids que están en Supabase pero no en el JSON local
    const different = [];   // ids que están en ambos pero con diferencias

    for (const [id, rec] of localById) {
      if (!prodById.has(id)) onlyLocal.push(rec);
      else {
        const d = diffRecord(fields, rec, prodById.get(id));
        if (d.length) different.push({ id, local: rec, prod: prodById.get(id), diffs: d });
      }
    }
    for (const [id, rec] of prodById) {
      if (!localById.has(id)) onlyProd.push(rec);
    }
    return {
      localCount: localArr.length,
      prodCount: prodArr.length,
      onlyLocal, onlyProd, different
    };
  }

  async function runIntegrityCheck(opts = {}) {
    const { silentIfOk = false } = opts;
    openModal(`
      <h2 class="admin-title">🔍 Verificando integridad de datos…</h2>
      <p class="admin-sub">Comparando <code>data/partidos.json</code> y <code>data/torneos.json</code> contra Supabase.</p>
    `);
    let partidos, torneos, fatalError = null;
    try {
      [partidos, torneos] = await Promise.all([
        compareDatasets("partidos", "partidos_view"),
        compareDatasets("torneos",  "torneos_view")
      ]);
    } catch (e) {
      fatalError = e.message || String(e);
    }
    if (fatalError) {
      openModal(`
        <h2 class="admin-title">⚠️ Error al verificar integridad</h2>
        <p class="admin-err">${escapeHtml(fatalError)}</p>
        <div class="admin-actions">
          <button type="button" class="admin-btn primary" data-close>Cerrar</button>
        </div>
      `);
      modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
      return;
    }

    const totalIssues =
      partidos.onlyLocal.length + partidos.onlyProd.length + partidos.different.length +
      torneos.onlyLocal.length  + torneos.onlyProd.length  + torneos.different.length;

    if (totalIssues === 0 && silentIfOk) { closeModal(); return; }

    openModal(renderIntegrityReport(partidos, torneos, totalIssues), { wide: true });
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
  }

  function renderIntegrityReport(partidos, torneos, totalIssues) {
    const okBanner = `
      <div class="integrity-banner ok">
        <strong>✅ Todo alineado.</strong>
        Los archivos locales coinciden exactamente con Supabase.
      </div>`;
    const issuesBanner = `
      <div class="integrity-banner warn">
        <strong>⚠️ Se detectaron ${totalIssues} diferencia${totalIssues === 1 ? "" : "s"}.</strong>
        Revisá el detalle de cada tabla más abajo para alinear <code>partidos.json</code> /
        <code>torneos.json</code> con la base de Supabase.
      </div>`;

    return `
      <h2 class="admin-title">🔍 Integridad Local ↔ Producción</h2>
      <p class="admin-sub">
        Local: <code>data/*.json</code> · Producción: Supabase (<code>partidos_view</code> / <code>torneos_view</code>).
      </p>
      ${totalIssues === 0 ? okBanner : issuesBanner}
      ${renderIntegritySection("Partidos", "partido", partidos, INTEGRITY_FIELDS.partidos)}
      ${renderIntegritySection("Torneos",  "torneo",  torneos,  INTEGRITY_FIELDS.torneos)}
      <div class="admin-actions">
        <button type="button" class="admin-btn primary" data-close>Cerrar</button>
      </div>
    `;
  }

  function renderIntegritySection(title, singular, cmp, fields) {
    const hasIssues = cmp.onlyLocal.length || cmp.onlyProd.length || cmp.different.length;
    return `
      <section class="integrity-section">
        <h3 class="integrity-title">
          ${escapeHtml(title)}
          <span class="integrity-counts">
            Local: <strong>${cmp.localCount}</strong> ·
            Prod: <strong>${cmp.prodCount}</strong>
            ${hasIssues ? `· <span class="integrity-badge">${cmp.onlyLocal.length + cmp.onlyProd.length + cmp.different.length} diferencia${(cmp.onlyLocal.length + cmp.onlyProd.length + cmp.different.length) === 1 ? "" : "s"}</span>` : `· <span class="integrity-badge ok">OK</span>`}
          </span>
        </h3>
        ${cmp.onlyLocal.length ? `
          <details class="integrity-details" open>
            <summary>📄 Solo en Local (${cmp.onlyLocal.length}) — falta cargar${cmp.onlyLocal.length === 1 ? "" : "n"} en Supabase</summary>
            <ul class="integrity-list">
              ${cmp.onlyLocal.map(r => `<li><strong>#${r.id}</strong> · ${escapeHtml(r.fecha || "")} · ${escapeHtml(summaryLine(singular, r))}</li>`).join("")}
            </ul>
          </details>` : ""}
        ${cmp.onlyProd.length ? `
          <details class="integrity-details" open>
            <summary>☁️ Solo en Producción (${cmp.onlyProd.length}) — falta${cmp.onlyProd.length === 1 ? "" : "n"} en el JSON local</summary>
            <ul class="integrity-list">
              ${cmp.onlyProd.map(r => `<li><strong>#${r.id}</strong> · ${escapeHtml(r.fecha || "")} · ${escapeHtml(summaryLine(singular, r))}</li>`).join("")}
            </ul>
          </details>` : ""}
        ${cmp.different.length ? `
          <details class="integrity-details" open>
            <summary>✏️ Con diferencias (${cmp.different.length})</summary>
            <ul class="integrity-list">
              ${cmp.different.map(d => `
                <li>
                  <strong>#${d.id}</strong> · ${escapeHtml(d.local.fecha || d.prod.fecha || "")}
                  <ul class="integrity-diffs">
                    ${d.diffs.map(x => `
                      <li>
                        <span class="integrity-field">${escapeHtml(x.field)}</span>:
                        <span class="integrity-local">Local = ${escapeHtml(formatVal(x.local))}</span>
                        <span class="integrity-arrow">→</span>
                        <span class="integrity-prod">Prod = ${escapeHtml(formatVal(x.prod))}</span>
                      </li>`).join("")}
                  </ul>
                </li>`).join("")}
            </ul>
          </details>` : ""}
        ${!hasIssues ? `<p class="integrity-ok-msg">✅ Sin diferencias en ${escapeHtml(title.toLowerCase())}.</p>` : ""}
      </section>
    `;
  }

  function summaryLine(singular, r) {
    if (singular === "partido") {
      return `${r.companiero || "?"} vs ${r.rivales || "?"} · ${r.resultado || "?"}`;
    }
    // torneo
    return `${r.organizador || "?"} · ${r.categoria || "?"} · ${r.puesto || "sin podio"}`;
  }

  function formatVal(v) {
    if (v === null) return "—";
    if (v === true) return "true";
    if (v === false) return "false";
    return String(v);
  }

  // ====================================================================
  //   BLOQUE 4 · Panel de gestión de catálogos
  // ====================================================================
  // El estado del modal se guarda en un objeto viajero. Al hacer rename de un
  // item con uso > 0 marcamos dirty=true; al cerrar el modal reload completo
  // para que los partidos/torneos ya cargados reflejen el nuevo nombre.

  async function openCatalogsModal() {
    const state = {
      activeTab: "canchas",
      filter: "",
      items: [],
      dirty: false,
      editingId: null,   // id existente en edición, o "new", o null
      editValue: ""
    };
    renderCatalogsShell(state);
    await loadCatalogTab(state);
    renderCatalogsBody(state);
  }

  function renderCatalogsShell(state) {
    const tabs = CATALOGS.map(c => `
      <button type="button" class="catalog-tab ${c.key === state.activeTab ? "active" : ""}" data-tab="${c.key}">
        <span>${c.icon}</span> ${c.plural}
      </button>
    `).join("");

    openModal(`
      <h2 class="admin-title">Gestión de catálogos</h2>
      <p class="admin-sub">Administrá los valores que alimentan los combos de partidos y torneos.</p>
      <div class="catalog-tabs">${tabs}</div>
      <div class="catalog-toolbar">
        <input type="search" id="catalog-search" placeholder="Buscar…" autocomplete="off">
        <button type="button" class="admin-btn primary" id="catalog-new-btn">➕ Nuevo</button>
      </div>
      <div class="catalog-body" id="catalog-body">
        <p class="catalog-empty">Cargando…</p>
      </div>
      <p class="admin-err" id="catalog-err" hidden></p>
      <div class="admin-actions">
        <button type="button" class="admin-btn ghost" id="catalog-close-btn">Cerrar</button>
      </div>
    `, { wide: true });

    modalRoot.querySelectorAll(".catalog-tab").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.tab === state.activeTab) return;
        state.activeTab = btn.dataset.tab;
        state.filter = "";
        state.editingId = null;
        modalRoot.querySelectorAll(".catalog-tab").forEach(b =>
          b.classList.toggle("active", b.dataset.tab === state.activeTab));
        $("#catalog-search").value = "";
        $("#catalog-body").innerHTML = `<p class="catalog-empty">Cargando…</p>`;
        await loadCatalogTab(state);
        renderCatalogsBody(state);
      });
    });

    $("#catalog-search").addEventListener("input", (e) => {
      state.filter = e.target.value;
      renderCatalogsBody(state);
    });

    $("#catalog-new-btn").addEventListener("click", () => {
      state.editingId = "new";
      state.editValue = "";
      renderCatalogsBody(state);
      const input = modalRoot.querySelector(".catalog-row.new .catalog-edit-input");
      if (input) input.focus();
    });

    $("#catalog-close-btn").addEventListener("click", () => {
      if (state.dirty) location.reload();
      else closeModal();
    });

    // Delegación permanente de clicks sobre el body
    $("#catalog-body").addEventListener("click", (e) => onCatalogAction(e, state));
    // Tracking del input inline + Enter/Escape (delegado)
    $("#catalog-body").addEventListener("input", (e) => {
      if (e.target.classList.contains("catalog-edit-input")) state.editValue = e.target.value;
    });
    $("#catalog-body").addEventListener("keydown", async (e) => {
      if (!e.target.classList.contains("catalog-edit-input")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (state.editingId === "new") await handleSaveNew(state);
        else await handleSaveEdit(state);
      } else if (e.key === "Escape") {
        state.editingId = null;
        renderCatalogsBody(state);
      }
    });
  }

  async function loadCatalogTab(state) {
    const meta = CATALOG_BY_KEY[state.activeTab];
    const { data, error } = await window.sb
      .from(meta.viewUso).select("id, nombre, uso").order("nombre");
    if (error) {
      state.items = [];
      showCatalogError(error.message);
      return;
    }
    state.items = data || [];
  }

  function showCatalogError(msg) {
    const err = $("#catalog-err");
    if (!err) return;
    err.textContent = "Error: " + msg;
    err.hidden = false;
    setTimeout(() => { if (err) err.hidden = true; }, 5000);
  }

  function renderCatalogsBody(state) {
    const container = $("#catalog-body");
    const meta = CATALOG_BY_KEY[state.activeTab];
    const q = state.filter.trim().toLowerCase();
    const filtered = q ? state.items.filter(x => x.nombre.toLowerCase().includes(q)) : state.items;

    const rowsHtml = [];

    if (state.editingId === "new") {
      rowsHtml.push(`
        <div class="catalog-row editing new" data-id="new">
          <input type="text" class="catalog-edit-input" placeholder="Nombre del ${escapeHtml(meta.singular)}…" value="${escapeHtml(state.editValue)}">
          <div class="catalog-actions">
            <button type="button" class="catalog-btn primary" data-action="save-new" title="Crear">✅</button>
            <button type="button" class="catalog-btn" data-action="cancel-new" title="Cancelar">✖️</button>
          </div>
        </div>
      `);
    }

    for (const item of filtered) {
      if (state.editingId === item.id) {
        rowsHtml.push(`
          <div class="catalog-row editing" data-id="${item.id}">
            <input type="text" class="catalog-edit-input" value="${escapeHtml(state.editValue)}">
            <div class="catalog-actions">
              <button type="button" class="catalog-btn primary" data-action="save-edit" title="Guardar">✅</button>
              <button type="button" class="catalog-btn" data-action="cancel-edit" title="Cancelar">✖️</button>
            </div>
          </div>
        `);
      } else {
        const canDelete = item.uso === 0;
        rowsHtml.push(`
          <div class="catalog-row" data-id="${item.id}">
            <span class="catalog-name">${escapeHtml(item.nombre)}</span>
            <span class="catalog-uso ${canDelete ? "unused" : ""}" title="${canDelete ? "Sin uso" : "En uso"}">${item.uso}</span>
            <div class="catalog-actions">
              <button type="button" class="catalog-btn" data-action="edit" title="Editar">✏️</button>
              <button type="button" class="catalog-btn danger" data-action="delete" title="${canDelete ? "Eliminar" : "En uso — no se puede eliminar"}" ${canDelete ? "" : "disabled"}>🗑️</button>
            </div>
          </div>
        `);
      }
    }

    if (rowsHtml.length === 0) {
      container.innerHTML = `
        <p class="catalog-empty">${q ? "No hay coincidencias con \"" + escapeHtml(state.filter) + "\"." : "No hay registros todavía. Click en \"➕ Nuevo\" para agregar el primero."}</p>
      `;
    } else {
      container.innerHTML = `<div class="catalog-list">${rowsHtml.join("")}</div>`;
    }

    // Enfocar y seleccionar el input recién insertado (si hay uno)
    const focusInput = container.querySelector(".catalog-row.editing .catalog-edit-input");
    if (focusInput && document.activeElement !== focusInput) {
      // Solo enfocar automáticamente si el usuario acaba de entrar en modo edición
      // (evita robar el foco al re-renderizar por otros motivos)
      focusInput.focus();
      if (state.editingId !== "new") focusInput.select();
    }
  }

  async function onCatalogAction(e, state) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const row = btn.closest(".catalog-row");
    const rowId = row.dataset.id;

    if (action === "edit") {
      const item = state.items.find(x => String(x.id) === rowId);
      if (!item) return;
      state.editingId = item.id;
      state.editValue = item.nombre;
      renderCatalogsBody(state);
    }
    else if (action === "cancel-edit" || action === "cancel-new") {
      state.editingId = null;
      renderCatalogsBody(state);
    }
    else if (action === "save-edit") {
      await handleSaveEdit(state);
    }
    else if (action === "save-new") {
      await handleSaveNew(state);
    }
    else if (action === "delete") {
      await handleDelete(state, Number(rowId));
    }
  }

  async function handleSaveNew(state) {
    const nombre = state.editValue.trim();
    if (!nombre) { showCatalogError("El nombre no puede estar vacío."); return; }
    try {
      await createCatalogItem(state.activeTab, nombre);
      await loadCatalogTab(state);
      state.editingId = null;
      state.editValue = "";
      renderCatalogsBody(state);
    } catch (err) {
      showCatalogError(err.message);
    }
  }

  async function handleSaveEdit(state) {
    const nombre = state.editValue.trim();
    if (!nombre) { showCatalogError("El nombre no puede estar vacío."); return; }
    const original = state.items.find(x => x.id === state.editingId);
    if (!original) { showCatalogError("Registro no encontrado."); return; }
    if (nombre === original.nombre) {
      state.editingId = null;
      renderCatalogsBody(state);
      return;
    }
    try {
      await updateCatalogItem(state.activeTab, state.editingId, nombre);
      if (original.uso > 0) state.dirty = true;
      await loadCatalogTab(state);
      state.editingId = null;
      renderCatalogsBody(state);
    } catch (err) {
      showCatalogError(err.message);
    }
  }

  async function handleDelete(state, id) {
    const item = state.items.find(x => x.id === id);
    if (!item) return;
    if (item.uso > 0) {
      alert(`No se puede eliminar "${item.nombre}": está en uso en ${item.uso} registro${item.uso === 1 ? "" : "s"}.`);
      return;
    }
    if (!confirm(`¿Eliminar "${item.nombre}" de ${CATALOG_BY_KEY[state.activeTab].plural}?`)) return;
    try {
      await deleteCatalogItem(state.activeTab, id);
      await loadCatalogTab(state);
      renderCatalogsBody(state);
    } catch (err) {
      showCatalogError(err.message);
    }
  }

})();
// ===== Módulo Administrador + Switch de entorno (v4) =====
// El switch de entorno (Local ↔ Producción) siempre está activo.
// El resto (auth y ABM) solo se activa cuando APP_ENV.isProd === true.
//
// v4: formularios con comboboxes buscables sobre los catálogos normalizados.
// - Canchas, formatos, jugadores, organizadores, categorías se cargan una vez
//   por sesión (cache en memoria) y alimentan los combos.
// - Cada combo permite "+ Crear nuevo" inline: inserta el registro en el catálogo
//   correspondiente y lo selecciona automáticamente.
// - El compañero, rival 1, rival 2 y compañero de torneo comparten el mismo
//   catálogo `jugadores` — crear en uno actualiza los demás combos abiertos.

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
      envBtn.classList.add("prod");
      envBtn.classList.remove("local");
    } else {
      envIcon.textContent = "🖥️";
      envLabel.textContent = "Local";
      envBtn.title = "Entorno: Local (JSON estáticos, solo lectura) · click para cambiar";
      envBtn.classList.add("local");
      envBtn.classList.remove("prod");
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
            <small>Lee <code>data/partidos.json</code> y <code>data/torneos.json</code> del repo.<br>Solo lectura. Ideal si Supabase se cae o para trabajar offline.</small>
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
  function openModal(html) {
    modalRoot.innerHTML = `
      <div class="admin-backdrop">
        <div class="admin-modal" role="dialog" aria-modal="true">
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
  //   BLOQUE 2 · Auth + ABM (solo en modo Producción)
  // ====================================================================
  if (!IS_PROD) return;

  if (!window.sb) {
    console.warn("admin.js: modo Producción sin cliente Supabase inicializado.");
    return;
  }

  const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

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
        email: fd.get("email"),
        password: fd.get("password")
      });
      if (error) {
        err.textContent = "No se pudo iniciar sesión. Revisá email y contraseña.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = "Entrar";
        return;
      }
      closeModal();
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
      </ul>
      <div class="admin-actions">
        <button type="button" class="admin-btn danger" id="admin-logout">Cerrar sesión</button>
        <button type="button" class="admin-btn primary" data-close>Listo</button>
      </div>
    `);
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
    $("#admin-logout").addEventListener("click", async () => {
      await window.sb.auth.signOut();
      closeModal();
    });
  }

  // ====================================================================
  //   Catálogos: cache en memoria + creación inline
  // ====================================================================
  const catalogCache = {
    canchas: null, formatos: null, jugadores: null,
    organizadores: null, categorias: null
  };

  async function ensureCatalogs() {
    if (catalogCache.canchas) return; // ya cargados
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
      .from(catalogName)
      .insert({ nombre: clean })
      .select("id, nombre")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error(`"${clean}" ya existe en ${catalogName}.`);
      throw new Error(error.message);
    }
    // Insertar ordenado en el cache
    const arr = catalogCache[catalogName];
    arr.push(data);
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return data;
  }

  // ====================================================================
  //   Combobox buscable con "+ Crear nuevo"
  // ====================================================================
  // Uso:
  //   const combo = makeCombo({
  //     container: <div>, catalog: "jugadores",
  //     initialId: 42, name: "companiero_id",
  //     canCreate: true
  //   });
  //   combo.getValue() => { id, nombre } | null

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

    // Valor inicial (modo edición)
    if (initialId) {
      const found = items.find(x => x.id === initialId);
      if (found) {
        input.value = found.nombre;
        hidden.value = String(found.id);
      }
    }

    function currentTextMatches(item) {
      return item && input.value.trim().toLowerCase() === item.nombre.toLowerCase();
    }

    function renderList() {
      const q = input.value.trim().toLowerCase();
      const filtered = q
        ? items.filter(x => x.nombre.toLowerCase().includes(q))
        : items;
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

    // Al escribir, invalidamos el ID seleccionado hasta que se elija de la lista o se cree
    input.addEventListener("focus", open);
    input.addEventListener("input", () => {
      hidden.value = "";
      open();
    });
    // Cerrar al perder foco (delay para permitir click en items/botón)
    input.addEventListener("blur", () => {
      setTimeout(() => {
        // Si el texto no matchea exactamente ninguna opción, limpiamos el hidden y el input
        const q = input.value.trim().toLowerCase();
        const exact = items.find(x => x.nombre.toLowerCase() === q);
        if (exact) {
          input.value = exact.nombre;
          hidden.value = String(exact.id);
        } else if (!hidden.value) {
          input.value = "";
        }
        close();
      }, 180);
    });

    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      const id = Number(li.dataset.id);
      const item = items.find(x => x.id === id);
      if (!item) return;
      input.value = item.nombre;
      hidden.value = String(item.id);
      close();
    });

    createBtn.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      const nombre = input.value.trim();
      if (!nombre) return;
      createBtn.disabled = true;
      const strong = createBtn.querySelector("strong");
      const originalTxt = strong.textContent;
      strong.textContent = "creando…";
      try {
        const newItem = await createCatalogItem(catalog, nombre);
        input.value = newItem.nombre;
        hidden.value = String(newItem.id);
        close();
      } catch (err) {
        alert("Error al crear: " + err.message);
        strong.textContent = originalTxt;
      } finally {
        createBtn.disabled = false;
      }
    });

    renderList();

    return {
      getValue: () => hidden.value ? { id: Number(hidden.value), nombre: input.value } : null,
      getId: () => hidden.value ? Number(hidden.value) : null,
      focus: () => input.focus()
    };
  }

  // ====================================================================
  //   Handlers de botones "Nuevo" y click en filas
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
      // Leemos de partidos_view para tener IDs Y strings
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
  function deriveFromDate(fechaStr) {
    const [y, mo, d] = fechaStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12));
    return { anio: y, mes: mo, dia: DIAS_ES[dt.getUTCDay()] };
  }

  async function withLoadingModal(fn) {
    openModal(`
      <h2 class="admin-title">Cargando…</h2>
      <p class="admin-sub">Preparando el formulario.</p>
    `);
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
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}">
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
      const err = $("#admin-partido-err");
      err.hidden = true;

      const fd = new FormData(form);
      const fecha = fd.get("fecha");
      const resultado = fd.get("resultado");
      const canchaId = combos.cancha.getId();
      const formatoId = combos.formato.getId();
      const companieroId = combos.companiero.getId();
      const rival1Id = combos.rival1.getId();
      const rival2Id = combos.rival2.getId();

      // Validaciones
      const missing = [];
      if (!canchaId) missing.push("Cancha");
      if (!formatoId) missing.push("Formato");
      if (!companieroId) missing.push("Compañero");
      if (!rival1Id) missing.push("Rival 1");
      if (!rival2Id) missing.push("Rival 2");
      if (missing.length) {
        err.textContent = "Faltan campos: " + missing.join(", ") + ". Elegí una opción de la lista o creá una nueva.";
        err.hidden = false;
        return;
      }
      if (rival1Id === rival2Id) {
        err.textContent = "Rival 1 y Rival 2 no pueden ser el mismo jugador.";
        err.hidden = false;
        return;
      }
      if (companieroId === rival1Id || companieroId === rival2Id) {
        err.textContent = "El compañero no puede ser también rival.";
        err.hidden = false;
        return;
      }

      const { anio, mes, dia } = deriveFromDate(fecha);
      const payload = {
        fecha, anio, mes, dia, resultado,
        cancha_id: canchaId,
        formato_id: formatoId,
        companiero_id: companieroId,
        rival1_id: rival1Id,
        rival2_id: rival2Id
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
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}">
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
      const err = $("#admin-torneo-err");
      err.hidden = true;

      const fd = new FormData(form);
      const fecha = fd.get("fecha");
      const organizadorId = combos.organizador.getId();
      const categoriaId = combos.categoria.getId();
      const companieroId = combos.companiero.getId();

      const missing = [];
      if (!organizadorId) missing.push("Organizador");
      if (!categoriaId) missing.push("Categoría");
      if (!companieroId) missing.push("Compañero");
      if (missing.length) {
        err.textContent = "Faltan campos: " + missing.join(", ") + ". Elegí una opción de la lista o creá una nueva.";
        err.hidden = false;
        return;
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
        organizador_id: organizadorId,
        categoria_id: categoriaId,
        companiero_id: companieroId,
        zona: tri("zona"),
        octavos: tri("octavos"),
        cuartos: tri("cuartos"),
        semifinal: tri("semifinal"),
        final: tri("final"),
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
  //   Submit genérico
  // ====================================================================
  async function submitRecord(table, id, payload, errSel, form) {
    const err = $(errSel);
    err.hidden = true;
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
})();
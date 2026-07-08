// ===== Módulo Administrador =====
// Maneja: login/logout, alta/baja/modificación de partidos y torneos.
// Independiente de app.js y torneos.js: se comunica solo con Supabase.
// Tras cualquier ABM, hace location.reload() para garantizar consistencia total
// (más simple y confiable que sincronizar los estados internos de cada módulo).

(function () {
  "use strict";

  const MESES_LARGOS = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const modalRoot = document.getElementById("admin-modal-root");
  const toggleBtn = document.getElementById("admin-toggle");
  const toggleIcon = toggleBtn.querySelector(".admin-toggle-icon");
  const toggleLabel = toggleBtn.querySelector(".admin-toggle-label");

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

  // ---------- Modal helpers ----------
  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.classList.remove("admin-modal-open");
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
  function escToClose(e) {
    if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", escToClose); }
  }

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

  // ---------- Botones "Nuevo" ----------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-new-btn");
    if (!btn) return;
    if (!document.body.classList.contains("is-admin")) return;
    const kind = btn.dataset.new;
    if (kind === "partido") openPartidoForm();
    if (kind === "torneo") openTorneoForm();
  });

  // ---------- Click en filas de las tablas → editar ----------
  document.addEventListener("click", async (e) => {
    if (!document.body.classList.contains("is-admin")) return;
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const tbody = tr.parentElement;
    const id = Number(tr.dataset.id);
    if (tbody.id === "tabla-body") {
      const { data, error } = await window.sb.from("partidos").select("*").eq("id", id).single();
      if (error) return alert("No se pudo cargar el partido: " + error.message);
      openPartidoForm(data);
    } else if (tbody.id === "t-tabla-body") {
      const { data, error } = await window.sb.from("torneos").select("*").eq("id", id).single();
      if (error) return alert("No se pudo cargar el torneo: " + error.message);
      openTorneoForm(data);
    }
  });

  // ---------- Helpers de derivación ----------
  function deriveFromDate(fechaStr) {
    // fechaStr: "YYYY-MM-DD"
    const [y, mo, d] = fechaStr.split("-").map(Number);
    // Usamos UTC noon para evitar corrimiento por timezone
    const dt = new Date(Date.UTC(y, mo - 1, d, 12));
    const diaNum = dt.getUTCDay(); // 0..6
    return {
      anio: y,
      mes: mo,
      dia: DIAS_ES[diaNum]
    };
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------- Formulario PARTIDO ----------
  function openPartidoForm(record) {
    const isEdit = !!record;
    const r = record || { fecha: "", cancha: "", formato: "", companiero: "", rivales: "", resultado: "PG" };
    openModal(`
      <h2 class="admin-title">${isEdit ? "Editar partido #" + r.id : "Nuevo partido"}</h2>
      <form id="admin-partido-form" class="admin-form">
        <label>Fecha
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}">
        </label>
        <div class="admin-row-2">
          <label>Cancha
            <input type="text" name="cancha" required value="${escapeHtml(r.cancha)}" placeholder="Ej: NODO">
          </label>
          <label>Formato
            <input type="text" name="formato" required value="${escapeHtml(r.formato)}" placeholder="Ej: TURNO">
          </label>
        </div>
        <label>Compañero
          <input type="text" name="companiero" required value="${escapeHtml(r.companiero)}">
        </label>
        <label>Rivales <span class="admin-hint-inline">(dos jugadores separados por " - ")</span>
          <input type="text" name="rivales" required value="${escapeHtml(r.rivales)}" placeholder="Nombre1 - Nombre2">
        </label>
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
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
    $("#admin-partido-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fecha = fd.get("fecha");
      const { anio, mes, dia } = deriveFromDate(fecha);
      const payload = {
        fecha,
        anio, mes, dia,
        cancha: (fd.get("cancha") || "").trim().toUpperCase(),
        formato: (fd.get("formato") || "").trim().toUpperCase(),
        companiero: (fd.get("companiero") || "").trim(),
        rivales: (fd.get("rivales") || "").trim(),
        resultado: fd.get("resultado")
      };
      await submitRecord("partidos", isEdit ? r.id : null, payload, "#admin-partido-err", e.target);
    });
    if (isEdit) {
      $("#admin-partido-del").addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el partido #${r.id}? Esta acción no se puede deshacer.`)) return;
        await deleteRecord("partidos", r.id, "#admin-partido-err");
      });
    }
  }

  // ---------- Formulario TORNEO ----------
  function triSelect(name, val) {
    // val: true / false / null / undefined
    const opts = [
      { v: "",     label: "— No jugó" },
      { v: "true", label: "✅ Ganó" },
      { v: "false", label: "❌ Perdió" }
    ];
    const cur = val === true ? "true" : val === false ? "false" : "";
    return `<select name="${name}">${opts.map(o =>
      `<option value="${o.v}" ${cur === o.v ? "selected" : ""}>${o.label}</option>`
    ).join("")}</select>`;
  }

  function openTorneoForm(record) {
    const isEdit = !!record;
    const r = record || {
      fecha: "", organizador: "", companiero: "", categoria: "",
      zona: null, octavos: null, cuartos: null, semifinal: null, final: null, puesto: null
    };
    openModal(`
      <h2 class="admin-title">${isEdit ? "Editar torneo #" + r.id : "Nuevo torneo"}</h2>
      <form id="admin-torneo-form" class="admin-form">
        <label>Fecha
          <input type="date" name="fecha" required value="${escapeHtml(r.fecha)}">
        </label>
        <div class="admin-row-2">
          <label>Organizador
            <input type="text" name="organizador" required value="${escapeHtml(r.organizador)}" placeholder="Ej: NODO">
          </label>
          <label>Categoría
            <input type="text" name="categoria" required value="${escapeHtml(r.categoria)}" placeholder="Ej: 8va, +13">
          </label>
        </div>
        <label>Compañero
          <input type="text" name="companiero" required value="${escapeHtml(r.companiero)}">
        </label>

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
    modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
    $("#admin-torneo-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fecha = fd.get("fecha");
      const { anio, mes, dia } = deriveFromDate(fecha);
      const tri = (name) => {
        const v = fd.get(name);
        if (v === "true") return true;
        if (v === "false") return false;
        return null;
      };
      const puestoRaw = fd.get("puesto");
      const payload = {
        fecha,
        anio, mes, dia,
        organizador: (fd.get("organizador") || "").trim().toUpperCase(),
        categoria: (fd.get("categoria") || "").trim(),
        companiero: (fd.get("companiero") || "").trim(),
        zona: tri("zona"),
        octavos: tri("octavos"),
        cuartos: tri("cuartos"),
        semifinal: tri("semifinal"),
        final: tri("final"),
        puesto: puestoRaw || null
      };
      await submitRecord("torneos", isEdit ? r.id : null, payload, "#admin-torneo-err", e.target);
    });
    if (isEdit) {
      $("#admin-torneo-del").addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el torneo #${r.id}? Esta acción no se puede deshacer.`)) return;
        await deleteRecord("torneos", r.id, "#admin-torneo-err");
      });
    }
  }

  // ---------- Submit genérico (insert / update) ----------
  async function submitRecord(table, id, payload, errSel, form) {
    const err = $(errSel);
    err.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Guardando…";

    let res;
    if (id == null) {
      res = await window.sb.from(table).insert(payload);
    } else {
      res = await window.sb.from(table).update(payload).eq("id", id);
    }
    if (res.error) {
      err.textContent = "Error: " + res.error.message;
      err.hidden = false;
      btn.disabled = false; btn.textContent = id == null ? "Crear" : "Guardar";
      return;
    }
    // Recarga para reflejar el cambio en filtros, KPIs, charts y tabla.
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

// ===== Auth gate: login obligatorio =====
// Bloquea toda la UI hasta que exista una sesión válida de Supabase.
// Expone window.AUTH_READY (Promise<session>) para que el arranque de la app
// (tabs → initPartidos / initTorneos) espere a estar autenticado antes de pedir datos.
// Se carga DESPUÉS de supabase-client.js y ANTES de partidos.js / torneos.js / admin.js.

(function () {
  "use strict";

  const root = document.documentElement;
  const gate = document.getElementById("auth-gate");
  const form = document.getElementById("auth-gate-form");
  const errEl = document.getElementById("auth-gate-err");
  const submitBtn = form.querySelector('button[type="submit"]');

  let resolveReady;
  window.AUTH_READY = new Promise(r => { resolveReady = r; });

  let unlocked = false;

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function lock() {
    root.classList.remove("auth-checking");
    root.classList.add("auth-pending");
    gate.hidden = false;
    setTimeout(() => form.email && form.email.focus(), 50);
  }

  function unlock(session, freshLogin) {
    unlocked = true;
    root.classList.remove("auth-checking", "auth-pending");
    gate.hidden = true;
    form.reset();
    setupLocalModeLogout(session);
    resolveReady(session);
    if (freshLogin) {
      window.dispatchEvent(new CustomEvent("auth:login", { detail: { session } }));
    }
  }

  // En modo Local admin.js no se activa, así que el botón de la topbar
  // queda solo como indicador de sesión + logout.
  function setupLocalModeLogout(session) {
    if (!window.APP_ENV || !window.APP_ENV.isLocal) return;
    const btn = document.getElementById("admin-toggle");
    if (!btn) return;
    const email = (session && session.user && session.user.email) || "";
    btn.querySelector(".admin-toggle-icon").textContent = "🔓";
    btn.querySelector(".admin-toggle-label").textContent = email.split("@")[0] || "Sesión";
    btn.title = `Sesión: ${email} · click para cerrar sesión`;
    btn.addEventListener("click", async () => {
      if (confirm("¿Cerrar sesión?")) await window.sb.auth.signOut();
    });
  }

  if (!window.sb) {
    lock();
    submitBtn.disabled = true;
    showError("No se pudo inicializar Supabase. Revisá la consola.");
    console.error("auth-gate: window.sb no está disponible.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando…";

    const fd = new FormData(form);
    const { data, error } = await window.sb.auth.signInWithPassword({
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || "")
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";

    if (error || !data.session) {
      showError("No se pudo iniciar sesión. Revisá email y contraseña.");
      return;
    }
    unlock(data.session, true);
  });

  // Logout (desde el menú admin o por expiración de sesión) → volver al login limpio.
  window.sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && unlocked) location.reload();
  });

  // Chequeo inicial: si hay sesión persistida, entra directo.
  (async () => {
    try {
      const { data: { session } } = await window.sb.auth.getSession();
      if (session) unlock(session, false);
      else lock();
    } catch (err) {
      console.error("auth-gate: error al obtener la sesión", err);
      lock();
    }
  })();
})();

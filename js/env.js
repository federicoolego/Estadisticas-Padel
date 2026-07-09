// ===== Environment switch =====
// Define window.APP_ENV con el modo actual y un loader de datos unificado.
// Modo "local": lee data/*.json (solo lectura, ideal para GitHub Pages puro).
// Modo "prod":  lee/escribe contra Supabase (requiere sesión para escribir).
// La preferencia se guarda en localStorage y se aplica en el próximo reload.
//
// Este archivo se carga ANTES que supabase-client.js, partidos.js, torneos.js y admin.js.

(function () {
  const STORAGE_KEY = "app_env_mode";
  const VALID = new Set(["local", "prod"]);

  const stored = localStorage.getItem(STORAGE_KEY);
  const MODE = VALID.has(stored) ? stored : "prod"; // ← default: Producción

  // En modo Prod, "partidos" y "torneos" leen de las views aplanadas que
  // devuelven el mismo shape que los JSON originales (con strings resueltos
  // desde los catálogos normalizados). La escritura sigue yendo contra las
  // tablas base — eso lo maneja admin.js directamente.
  const READ_TABLE = {
    partidos: "partidos_view",
    torneos:  "torneos_view"
  };

  const APP_ENV = {
    MODE,
    isProd: MODE === "prod",
    isLocal: MODE === "local",

    // Cambia el modo y recarga la página para que todo se reinicialice de cero.
    setMode(newMode) {
      if (!VALID.has(newMode)) return;
      if (newMode === MODE) return;
      localStorage.setItem(STORAGE_KEY, newMode);
      location.reload();
    },

    // Cargador unificado: partidos.js y torneos.js llaman esto sin saber el origen.
    async loadTable(name) {
      if (MODE === "prod") {
        if (!window.sb) {
          throw new Error("Modo Producción activo pero el cliente Supabase no está inicializado. Revisá js/supabase-client.js.");
        }
        const source = READ_TABLE[name] || name;
        const { data, error } = await window.sb
          .from(source)
          .select("*")
          .order("id", { ascending: true });
        if (error) throw error;
        return data || [];
      } else {
        const res = await fetch(`data/${name}.json`);
        if (!res.ok) throw new Error(`No se pudo cargar data/${name}.json (HTTP ${res.status}).`);
        return await res.json();
      }
    }
  };

  window.APP_ENV = APP_ENV;

  // Marca el <html> con la clase del entorno actual para que CSS pueda reaccionar.
  document.documentElement.classList.add(MODE === "prod" ? "env-prod" : "env-local");
})();
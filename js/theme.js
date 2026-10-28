// ===== Tema claro / oscuro =====
// Se carga en el <head> (sin defer) para aplicar el tema antes del primer pintado y evitar el "flash".
// La preferencia se guarda en localStorage. Default: oscuro.
(function () {
  const KEY = "padel-theme";
  const root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; }
    catch (_) { return "dark"; }
  }

  // Paletas para Chart.js (los colores de los gráficos no salen del CSS)
  const PALETTES = {
    dark: {
      grid: "#2a313c", tick: "#8b949e", text: "#e6edf3",
      gold: "#fbbf24", goldFill: "rgba(251,191,36,0.08)", other: "#3a4352",
      silver: "#cbd5e1", silverText: "#cbd5e1",
      partners: ["#60a5fa", "#f472b6", "#2dd4bf", "#a78bfa", "#fb923c", "#facc15", "#f87171", "#94a3b8"]
    },
    light: {
      grid: "#e3e8ee", tick: "#5d6878", text: "#1b2230",
      gold: "#d97706", goldFill: "rgba(217,119,6,0.08)", other: "#c3cbd6",
      silver: "#94a3b8", silverText: "#64748b",
      partners: ["#2563eb", "#db2777", "#0d9488", "#7c3aed", "#ea580c", "#ca8a04", "#dc2626", "#475569"]
    }
  };

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      const toLight = theme === "dark";
      btn.querySelector(".theme-toggle-icon").textContent = toLight ? "☀️" : "🌙";
      btn.setAttribute("title", toLight ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
      btn.setAttribute("aria-label", btn.getAttribute("title"));
    }
    if (window.Chart) {
      window.Chart.defaults.color = PALETTES[theme].tick;
    }
  }

  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch (_) {}
    apply(theme);
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  window.THEME = {
    get: () => root.getAttribute("data-theme") || "dark",
    colors: () => PALETTES[root.getAttribute("data-theme") === "light" ? "light" : "dark"],
    palette: name => PALETTES[name === "light" ? "light" : "dark"],
    set,
    toggle: () => set(window.THEME.get() === "dark" ? "light" : "dark")
  };

  apply(read());

  document.addEventListener("DOMContentLoaded", () => {
    apply(window.THEME.get());
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", () => window.THEME.toggle());
  });
})();

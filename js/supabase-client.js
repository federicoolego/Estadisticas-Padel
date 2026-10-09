const SUPABASE_URL = "https://puofvxsvoaaynbspddsj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n9I9IHiVTBD_SRr1znNvyQ_Xvo6-Sls"; // Es pública, va acá tranquilo

// El cliente se instancia SIEMPRE (Local y Prod): el login es obligatorio en ambos modos.
// En modo Local solo se usa para auth; los datos siguen saliendo de data/*.json.
if (!window.supabase) {
  console.error("El SDK de Supabase no cargó.");
} else {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

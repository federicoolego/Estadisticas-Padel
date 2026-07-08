const SUPABASE_URL = "https://puofvxsvoaaynbspddsj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n9I9IHiVTBD_SRr1znNvyQ_Xvo6-Sls"; // Es pública, va acá tranquilo

if (window.APP_ENV && window.APP_ENV.isProd) {
  if (!window.supabase) {
    console.error("Modo Producción activo pero el SDK de Supabase no cargó.");
  } else {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
}

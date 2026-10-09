-- =====================================================================
--  Lectura SOLO para usuarios autenticados (complemento del login obligatorio)
--  Correr en Supabase → SQL Editor. Es idempotente.
-- =====================================================================

-- 1) Tablas: borrar policies de SELECT abiertas a anon/public y crear una para authenticated
DO $$
DECLARE
  t   text;
  pol record;
  tablas text[] := ARRAY['partidos','torneos','canchas','formatos','jugadores','organizadores','categorias'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND cmd IN ('SELECT','ALL')
        AND (roles && ARRAY['anon','public']::name[])
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE 'Eliminada policy "%" en %', pol.policyname, t;
    END LOOP;

    EXECUTE format('DROP POLICY IF EXISTS "lectura_autenticados" ON public.%I', t);
    EXECUTE format('CREATE POLICY "lectura_autenticados" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- 2) Views: por defecto corren con permisos del owner y SALTEAN el RLS.
--    security_invoker hace que respeten el RLS de las tablas base (Postgres 15+).
DO $$
DECLARE
  v text;
  vistas text[] := ARRAY['partidos_view','torneos_view',
                         'canchas_con_uso','formatos_con_uso','jugadores_con_uso',
                         'organizadores_con_uso','categorias_con_uso'];
BEGIN
  FOREACH v IN ARRAY vistas LOOP
    IF to_regclass('public.' || v) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', v);
  END LOOP;
END $$;

-- 3) Verificación: no debería quedar ninguna policy de SELECT para anon/public
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

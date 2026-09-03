-- ============================================================================
-- BioVac — Políticas RLS TEMPORALES para la fase standalone
--
-- Supabase habilita RLS por defecto en tablas nuevas de public (sin que se
-- pida explícitamente), así que sin políticas quedan completamente
-- bloqueadas para anon/authenticated (0 filas, sin error).
--
-- Estas políticas son deliberadamente permisivas (USING (true)) porque en
-- esta fase (3-5 del plan) no hay todavía login/roles reales -- mismo
-- patrón que ya usan otras tablas tempranas de este repo (ej.
-- influenza_capturas, unidades_bcg_config).
--
-- OBLIGATORIO reemplazar esto por políticas basadas en rol/CLUES real
-- (MUNICIPAL/JURISDICCIONAL/ADMIN, igual que perfiles/registros_sis) antes
-- de la Fase 6 (integración a la página).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'biovac_jurisdicciones', 'biovac_unidades', 'biovac_bloques_catalogo',
    'biovac_catalogo_biologicos', 'biovac_lotes', 'biovac_movimientos',
    'biovac_renglones', 'biovac_correcciones', 'biovac_informes_jurisdiccionales'
  ]
  loop
    execute format('drop policy if exists biovac_temporal_all on %I', t);
    execute format(
      'create policy biovac_temporal_all on %I for all to anon, authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ============================================================================
-- BioVac — Funciones de solo lectura para la vista jurisdiccional (Fase 4)
--
-- Requiere haber corrido biovac_schema.sql y biovac_engine.sql antes.
--
-- El concentrado jurisdiccional NUNCA se almacena aparte: siempre se agrega
-- en vivo con SUM/GROUP BY sobre los movimientos municipales ya CERRADOS
-- (mismo patrón que ya usa este repo en rpc_concentrado_aplicaciones.sql).
-- Solo "generar informe" (biovac_generar_informe_jurisdiccional, ya en
-- biovac_engine.sql) toma una foto fija para el PDF/Excel oficial.
-- ============================================================================

-- 10. Concentrado en vivo: un renglón por (biológico, lote, categoría),
--     sumado a través de las unidades de la jurisdicción.
create or replace function biovac_concentrado_jurisdiccion(p_jurisdiccion_id uuid, p_anio int, p_mes int)
returns table (
  bloque_id uuid, pagina text, orden_bloque int, biologico_id uuid, orden_en_bloque int,
  nombre_excel text, clave text, regla_especial text, lote_id uuid, numero_lote text, caducidad date, categoria text,
  existencia_anterior_frascos numeric, recibido_frascos numeric,
  aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric, desechadas_b numeric,
  existencia_final_frascos numeric, unidades_reportando int
)
language sql
stable
as $$
  select cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque,
         cb.nombre_excel, cb.clave, cb.regla_especial, l.id, l.numero_lote, l.caducidad, r.categoria,
         sum(r.existencia_anterior_frascos), sum(r.recibido_frascos),
         sum(r.aplicadas_a), sum(r.aplicadas_b), sum(r.desechadas_a), sum(r.desechadas_b),
         sum(r.existencia_final_frascos), count(distinct m.unidad_id)::int
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  join biovac_bloques_catalogo bl on bl.id = cb.bloque_id
  where u.jurisdiccion_id = p_jurisdiccion_id
    and m.anio = p_anio and m.mes = p_mes
    and m.estado = 'CERRADO'
  group by cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque, cb.nombre_excel, cb.clave, cb.regla_especial,
           l.id, l.numero_lote, l.caducidad, r.categoria
  order by bl.pagina, bl.orden, cb.orden_en_bloque, r.categoria, l.numero_lote;
$$;

-- 11. Detalle por unidad de un lote específico (para el drill-down de
--     corrección desde la vista jurisdiccional). Incluye unidades que no
--     reportaron ese lote (renglon_id null) para que se note la ausencia.
create or replace function biovac_detalle_lote_jurisdiccion(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_lote_id uuid, p_categoria text
)
returns table (
  unidad_id uuid, unidad_nombre text, movimiento_id uuid, movimiento_estado text,
  renglon_id uuid, existencia_anterior_frascos numeric, recibido_frascos numeric,
  aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric, desechadas_b numeric,
  existencia_final_frascos numeric, observaciones text
)
language sql
stable
as $$
  select u.id, u.nombre, m.id, m.estado,
         r.id, r.existencia_anterior_frascos, r.recibido_frascos,
         r.aplicadas_a, r.aplicadas_b, r.desechadas_a, r.desechadas_b,
         r.existencia_final_frascos, r.observaciones
  from biovac_unidades u
  left join biovac_movimientos m on m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes
  left join biovac_renglones r on r.movimiento_id = m.id and r.lote_id = p_lote_id and r.categoria = p_categoria
  where u.jurisdiccion_id = p_jurisdiccion_id and u.activo
  order by u.nombre;
$$;

-- SQL Schema (v5) - SINCRONIZACIÓN ABSOLUTA
-- Diseñado para evitar errores de importación (FKs eliminadas temporalmente)
-- Soporte total para decimales y headers exactos detectados en auditoría profunda.

-- 1. CONFIGURACIÓN DE FECHAS (CRÍTICO)
ALTER DATABASE postgres SET datestyle TO 'ISO, DMY';

-- 2. UNIDADES
CREATE TABLE unidades (
    municipio TEXT,
    clues TEXT PRIMARY KEY,
    unidad TEXT,
    activo TEXT DEFAULT 'SI',
    orden_clues INTEGER
);

-- 3. USUARIOS
CREATE TABLE usuarios (
    usuario TEXT PRIMARY KEY,
    password TEXT,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    rol TEXT,
    activo TEXT DEFAULT 'SI'
);

-- 4. EXISTENCIA_BIOLOGICOS (Matriz Resumen)
CREATE TABLE biologicos_existencia (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    fecha DATE,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    bcg NUMERIC DEFAULT 0,
    hepatitis_b NUMERIC DEFAULT 0,
    hexavalente NUMERIC DEFAULT 0,
    dpt NUMERIC DEFAULT 0,
    rotavirus NUMERIC DEFAULT 0,
    neumococica_13 NUMERIC DEFAULT 0,
    neumococica_20 NUMERIC DEFAULT 0, -- Sincronizado con auditoría
    srp NUMERIC DEFAULT 0,
    sr NUMERIC DEFAULT 0,
    vph NUMERIC DEFAULT 0,
    varicela NUMERIC DEFAULT 0,
    hepatitis_a NUMERIC DEFAULT 0,
    td NUMERIC DEFAULT 0,
    tdpa NUMERIC DEFAULT 0,
    covid_19 NUMERIC DEFAULT 0,
    influenza NUMERIC DEFAULT 0,
    vsr NUMERIC DEFAULT 0,
    capturado_por TEXT,
    editado TEXT,
    editado_por TEXT,
    editado_ts TIMESTAMPTZ
);

-- 5. CONSUMIBLES
CREATE TABLE consumibles (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    fecha DATE,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    srp_dosis NUMERIC DEFAULT 0,
    sr_dosis NUMERIC DEFAULT 0,
    jeringa_reconst_5ml_0605500438 NUMERIC DEFAULT 0,
    jeringa_aplic_05ml_0605502657 NUMERIC DEFAULT 0,
    aguja_06004037 NUMERIC DEFAULT 0,
    capturado_por TEXT,
    editado TEXT,
    editado_por TEXT,
    editado_ts TIMESTAMPTZ
);

-- 6. PARAM_BIOLOGICOS (Configuración)
CREATE TABLE biologicos_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    biologico TEXT,
    max_dosis INTEGER DEFAULT 0,
    min_dosis INTEGER DEFAULT 0,
    promedio_frascos NUMERIC DEFAULT 0,
    multiplo INTEGER DEFAULT 1 -- Sincronizado con auditoría
);

-- 7. CAPTURA_BIOLOGICOS (Pedidos / Detalle de Captura)
CREATE TABLE biologicos_pedido (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    fecha_captura DATE,
    fecha_pedido_programada DATE,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    biologico TEXT,
    max_dosis INTEGER DEFAULT 0,
    min_dosis INTEGER DEFAULT 0,
    promedio_frascos NUMERIC DEFAULT 0,
    multiplo INTEGER DEFAULT 1,
    frascos NUMERIC DEFAULT 0,
    dosis_x_frasco NUMERIC DEFAULT 0,
    dosis_totales NUMERIC DEFAULT 0,
    lote TEXT,
    caducidad DATE,
    capturado_por TEXT,
    editado TEXT,
    editado_por TEXT,
    editado_ts TIMESTAMPTZ
);

-- 8. CATALOGO_BIOLOGICOS
CREATE TABLE biologicos_catalogo (
    orden_biologico INTEGER PRIMARY KEY,
    biologico TEXT,
    total_ref INTEGER,
    multiplo_pedido INTEGER,
    captura_activa TEXT DEFAULT 'SI'
);

-- 9. CALENDARIO_PEDIDOS
CREATE TABLE calendario_pedidos (
    anio_mes TEXT PRIMARY KEY,
    fecha_programada DATE,
    habilitar_desde TIMESTAMPTZ,
    habilitar_hasta TIMESTAMPTZ,
    motivo TEXT,
    activo TEXT DEFAULT 'SI'
);

-- 10. PINOL_SOLICITUDES
CREATE TABLE pinol_solicitudes (
    id TEXT PRIMARY KEY,
    timestamp_solicitud TIMESTAMPTZ,
    fecha_solicitud DATE,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    existencia_actual_botellas NUMERIC DEFAULT 0,
    solicitud_botellas NUMERIC DEFAULT 0,
    observaciones TEXT,
    capturado_por TEXT,
    editado TEXT,
    editado_por TEXT,
    editado_ts TIMESTAMPTZ
);

-- 11. NOTIFICACIONES
CREATE TABLE notificaciones (
    id TEXT PRIMARY KEY,
    created_ts TIMESTAMPTZ,
    created_date DATE,
    from_usuario TEXT,
    from_rol TEXT,
    target_scope TEXT,
    target_municipio TEXT,
    target_clues TEXT,
    target_usuario TEXT,
    title TEXT,
    message TEXT,
    is_read TEXT DEFAULT 'NO', -- Mapeado de auditoría
    read_ts TIMESTAMPTZ
);

-- 12. EXISTENCIA_DETALLE (Lotes)
CREATE TABLE existencia_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE,
    clues TEXT,
    unidad TEXT,
    municipio TEXT,
    biologico TEXT,
    lote TEXT,
    caducidad DATE,
    fecha_recepcion DATE,
    cantidad NUMERIC DEFAULT 0,
    capturado_por TEXT,
    editado TEXT,
    editado_por TEXT,
    editado_ts TIMESTAMPTZ
);

-- Indices de búsqueda frecuentes
CREATE INDEX idx_exist_fecha ON biologicos_existencia(fecha);
CREATE INDEX idx_exist_clues ON biologicos_existencia(clues);
CREATE INDEX idx_det_clues_fecha ON existencia_detalle(clues, fecha);
CREATE INDEX idx_ped_fecha ON biologicos_pedido(fecha_captura);

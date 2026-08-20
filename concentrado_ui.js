/**
 * concentrado_ui.js — Panel "Concentrado de Aplicaciones" (ADMIN / JURISDICCIONAL / VISUALIZADOR_JURISDICCIONAL)
 * Motor aislado: RPCs propias (get_concentrado_por_biologico, get_concentrado_aplicaciones),
 * sin dependencias de rda_ui.js / rda_calculator.js / influenza_module.js. No modifica ni
 * reutiliza get_rda_indicators.
 *
 * Diseño anti-truncamiento: la jurisdicción completa tiene ~163 claves SIS de vacunación
 * activas por unidad — pedir el detalle crudo (clues x clave) para las 71 unidades da más
 * de 11,000 filas, muy por encima del límite por defecto de fila de PostgREST/Supabase
 * (1000). Por eso la vista por defecto ("Por biológico") usa un RPC que agrega en SQL a
 * nivel (unidad, biológico) -- ~1,200 filas -- y el detalle crudo por clave solo se pide
 * bajo demanda cuando el usuario cambia a "Por clave". Además, TODAS las llamadas RPC se
 * paginan con .range() sin importar el tamaño esperado, así nunca se trunca en silencio
 * sin importar cómo esté configurado el límite del proyecto.
 */
(function (window) {
  'use strict';

  // 17 biológicos "padre" (misma lista/orden que public.biologicos_catalogo) — colores
  // reutilizados 1:1 de la paleta `insumos` ya usada en main.js:generateProfessionalXLSX
  // para que este reporte luzca visualmente consistente con el resto de SIREVAQ.
  const CONCENTRADO_BIOLOGICOS = [
    { key: 'BCG', label: 'BCG', color: '3A86B7', fontColor: 'FFFFFFFF' },
    { key: 'HEPATITIS B', label: 'Hepatitis B', color: 'C43D3D', fontColor: 'FFFFFFFF' },
    { key: 'HEXAVALENTE', label: 'Hexavalente', color: '9ACD32', fontColor: 'FF000000' },
    { key: 'DPT', label: 'DPT', color: 'E9C46A', fontColor: 'FF000000' },
    { key: 'ROTAVIRUS', label: 'Rotavirus', color: '264653', fontColor: 'FFFFFFFF' },
    { key: 'NEUMOCOCICA 13', label: 'Neumocócica 13', color: '3D405B', fontColor: 'FFFFFFFF' },
    { key: 'NEUMOCOCICA 20', label: 'Neumocócica 20', color: '5C5F82', fontColor: 'FFFFFFFF' },
    { key: 'SRP', label: 'SRP', color: 'B23A48', fontColor: 'FFFFFFFF' },
    { key: 'SR', label: 'SR', color: '7B5EA7', fontColor: 'FFFFFFFF' },
    { key: 'VPH', label: 'VPH', color: '2A9D8F', fontColor: 'FF000000' },
    { key: 'VARICELA', label: 'Varicela', color: '8ED1C2', fontColor: 'FF000000' },
    { key: 'HEPATITIS A', label: 'Hepatitis A', color: 'BDBDBD', fontColor: 'FF000000' },
    { key: 'TD', label: 'TD', color: '9E9E9E', fontColor: 'FF000000' },
    { key: 'TDPA', label: 'TDPA', color: 'E76F51', fontColor: 'FFFFFFFF' },
    { key: 'COVID-19', label: 'COVID-19', color: '4A4A4A', fontColor: 'FFFFFFFF' },
    { key: 'INFLUENZA', label: 'Influenza', color: 'D48A6A', fontColor: 'FFFFFFFF' },
    { key: 'VSR', label: 'VSR', color: 'D8B4A0', fontColor: 'FF000000' }
  ];
  const CONCENTRADO_OTROS = { key: 'OTROS', label: 'Otros / sin clasificar', color: 'CBD5E1', fontColor: 'FF000000' };
  const CONCENTRADO_BIOLOGICOS_ALL = CONCENTRADO_BIOLOGICOS.concat([CONCENTRADO_OTROS]);

  // Une, por cada biológico "padre", TODAS las variantes de public.sis_variables_mapeo que
  // le pertenecen (incluye alias MOTHER_*, y las variantes ADOL_/AM_/EMB_ por grupo
  // poblacional) — a diferencia de RDA, aquí NO nos interesa el grupo poblacional, solo el
  // biológico. Debe coincidir 1:1 con el mapa "alias_map" del lado SQL
  // (supabase/rpc_concentrado_aplicaciones.sql, get_concentrado_por_biologico) -- aquí solo
  // se usa para anotar la vista "Por clave" con el biológico de origen, el cálculo real de
  // la vista "Por biológico" ya lo hace el RPC.
  const CANONICAL_BIOLOGICO_ALIASES = {
    'BCG': ['BCG', 'MOTHER_BCG'],
    'HEPATITIS B': ['HEPB_0_7', 'ADOL_HB', 'HEPATITIS B', 'MOTHER_HEPATITIS_B'],
    'HEXAVALENTE': ['HEXA_1', 'HEXA_2', 'HEXA_3', 'HEXA_REF', 'HEXAVALENTE', 'MOTHER_HEXAVALENTE'],
    'DPT': ['DPT_4', 'DPT', 'MOTHER_DPT'],
    'ROTAVIRUS': ['ROTA_1', 'ROTA_2', 'ROTAVIRUS', 'MOTHER_ROTAVIRUS'],
    'NEUMOCOCICA 13': ['NEUMO_1', 'NEUMO_2', 'NEUMO_C1', 'NEUMO_C2', 'NEUMO_C3', 'NEUMO_REF', 'AM_NEUMO13', 'MOTHER_NEUMO_CONJ'],
    'NEUMOCOCICA 20': ['AM_NEUMO20', 'MOTHER_NEUMO_20'],
    'SRP': ['SRP_1', 'SRP_2', 'SRP_6', 'SRP', 'MOTHER_SRP'],
    'SR': ['ADOL_SR', 'SR', 'MOTHER_SR'],
    'VPH': ['ADOL_VPH', 'VPH', 'MOTHER_VPH'],
    'VARICELA': ['VARICELA', 'MOTHER_VARICELA'],
    'HEPATITIS A': ['HEPATITIS_A', 'HEPATITIS A', 'MOTHER_HEPATITIS_A'],
    'TD': ['ADOL_TD', 'AM_TD', 'TD', 'MOTHER_TD'],
    'TDPA': ['ADOL_TDPA', 'EMB_TDPA', 'TDPA', 'MOTHER_TDPA'],
    'COVID-19': ['COVID', 'COVID-19', 'MOTHER_COVID'],
    'INFLUENZA': ['INFLUENZA', 'MOTHER_INFLUENZA'],
    'VSR': ['EMB_VSR', 'VSR', 'MOTHER_VSR']
  };

  const MUNI_ORDER_CONCENTRADO = ['CORREGIDORA', 'HUIMILPAN', 'MARQUES', 'QUERETARO'];
  // QTSSA001740 (Hospital de Especialidades del Niño y la Mujer) no tiene ni una sola fila
  // en registros_sis bajo ese CLUES -- su captura histórica quedó ligada a otro CLUES/nombre
  // ("HENM", ver main.js:generateProfessionalXLSX). Se excluye del panel: no aporta nada y
  // su nombre larguísimo rompe el ancho de la columna Unidad para todas las demás filas.
  const EXCLUDED_CLUES = new Set(['QTSSA001740']);
  // Anchos fijos de las 3 primeras columnas (CLUES/Unidad/Municipio), que quedan pegadas
  // (sticky) al hacer scroll horizontal por las ~17 columnas de biológico.
  const STICKY_W = { clues: 108, unidad: 210, municipio: 104 };
  // OJO: si Supabase tiene configurado un tope de fila a nivel de PostgREST (API Settings
  // -> Max Rows, típicamente 1000), ese tope se aplica ENCIMA de p_limit sin avisar --
  // pedir páginas de 3000 hacía que la primera respuesta llegara recortada a 1000 y el
  // bucle de abajo, al ver "menos filas de las pedidas", creía erróneamente que ya era la
  // última página y descartaba el resto (las unidades al final del orden alfabético). Se
  // usa un tamaño de página chico, muy por debajo de cualquier tope típico, para que la
  // comparación "¿llegaron menos de PAGE_SIZE?" vuelva a ser una señal confiable de fin.
  const PAGE_SIZE = 500;

  // Mayúsculas + sin acentos. CRÍTICO para municipio: en unidades_medicas los valores
  // reales son "MARQUÉS" y "QUERÉTARO" (con acento) -- sin este strip, MUNI_ORDER_CONCENTRADO
  // nunca hacía match contra esos dos municipios y el panel solo mostraba Corregidora/Huimilpan.
  function normUp_(s) {
    return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function biologicoLabelFor_(key) {
    const found = CONCENTRADO_BIOLOGICOS_ALL.find(b => b.key === key);
    return found ? found.label : key;
  }

  function biologicoOrderIndex_(key) {
    const idx = CONCENTRADO_BIOLOGICOS.findIndex(b => b.key === key);
    return idx === -1 ? CONCENTRADO_BIOLOGICOS.length : idx; // 'OTROS' siempre al final
  }

  const _state = {
    initialized: false,
    anio: 2026,
    mesIni: 1,
    mesFin: 12,
    municipio: '',
    busqueda: '', // texto libre: filtra por nombre de unidad o CLUES (normalizado, sin acentos)
    vista: 'biologico', // 'biologico' | 'clave'
    loading: false,
    bioFetchKey: null,   // `${anio}|${mesIni}|${mesFin}` de _state.bioRows
    claveFetchKey: null, // `${anio}|${mesIni}|${mesFin}` de _state.claveRows (carga perezosa)
    bioRows: [],     // [{clues,nombre,municipio,biologico,total_dosis}] -- ya agregado en SQL
    claveRows: [],   // [{clues,nombre,municipio,variable_sis,total_dosis}] -- crudo, solo bajo demanda
    unidades: [],    // catálogo de unidades activas visibles al usuario: {clues,nombre,municipio}
    claveToBiologico: new Map() // variable_sis (upper) -> biologico padre, solo para anotar la vista "Por clave"
  };

  // ── Paginación defensiva: nunca confiar en que un solo fetch trae todo, NI en que el
  // número de filas que llega coincide con lo pedido -- si Supabase tiene un tope de fila
  // configurado a nivel de PostgREST (API Settings -> Max Rows), ese tope recorta la
  // respuesta POR DEBAJO de nuestro propio p_limit sin avisar. Por eso el offset avanza
  // por las filas que REALMENTE llegaron (rows.length), no por PAGE_SIZE nominal -- así,
  // aunque el tope real del servidor sea más chico que PAGE_SIZE, solo se traduce en más
  // vueltas, nunca en filas saltadas. Se sigue pidiendo hasta que una página llega vacía.
  // Parámetros explícitos p_offset/p_limit (llamados por POST, el default de .rpc()) en
  // vez de .range() -- .range() fuerza GET, que además de exigir que la función sea
  // STABLE, se puede cachear en el navegador y servir una respuesta vieja entre despliegues.
  async function fetchAllPaginated_(rpcName, params) {
    let all = [];
    let offset = 0;
    while (true) {
      const { data, error } = await window.supabase.rpc(rpcName, { ...params, p_offset: offset, p_limit: PAGE_SIZE });
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) break;
      all = all.concat(rows);
      offset += rows.length;
    }
    return all;
  }

  // ── 1. Construcción del mapa clave -> biológico padre desde sis_variables_mapeo ──────
  // (solo para etiquetar sub-columnas en la vista "Por clave"; el cálculo real de "Por
  // biológico" ya viene agregado del RPC get_concentrado_por_biologico)
  async function buildAliasLookup_(anio) {
    _state.claveToBiologico = new Map();

    const { data, error } = await window.supabase
      .from('sis_variables_mapeo')
      .select('biologico, variables')
      .eq('anio', anio);

    if (error) {
      console.error('[Concentrado] Error cargando sis_variables_mapeo:', error);
      return;
    }

    const aliasIndex = new Map();
    Object.keys(CANONICAL_BIOLOGICO_ALIASES).forEach(parent => {
      CANONICAL_BIOLOGICO_ALIASES[parent].forEach(alias => aliasIndex.set(normUp_(alias), parent));
    });

    (data || []).forEach(row => {
      const bioNameUp = normUp_(row.biologico);
      const parent = aliasIndex.get(bioNameUp) || 'OTROS';
      const claves = Array.isArray(row.variables) ? row.variables : [];
      claves.forEach(clave => {
        const claveUp = normUp_(clave);
        if (claveUp) _state.claveToBiologico.set(claveUp, parent);
      });
    });
  }

  // ── 2. Catálogo de unidades visibles según el alcance del usuario ───────────────────
  async function loadUnidadesVisibles_() {
    const [medRes, actRes] = await Promise.all([
      window.supabase.from('unidades_medicas').select('clues, nombre, municipio'),
      window.supabase.from('unidades').select('clues, activo').eq('activo', 'SI')
    ]);

    if (medRes.error) { console.error('[Concentrado] Error cargando unidades_medicas:', medRes.error); return; }
    if (actRes.error) { console.error('[Concentrado] Error cargando unidades activas:', actRes.error); return; }

    const activasSet = new Set((actRes.data || []).map(u => u.clues));
    const user = window.USER || {};

    _state.unidades = (medRes.data || [])
      .filter(u => activasSet.has(u.clues))
      .filter(u => !EXCLUDED_CLUES.has(u.clues))
      .filter(u => typeof window.canSeeMunicipio_ === 'function' ? window.canSeeMunicipio_(user, u.municipio) : true)
      .sort((a, b) => (a.municipio || '').localeCompare(b.municipio || '') || a.clues.localeCompare(b.clues));
  }

  function municipiosVisibles_() {
    const set = new Set(_state.unidades.map(u => normUp_(u.municipio)));
    return MUNI_ORDER_CONCENTRADO.filter(m => set.has(m));
  }

  // ── 3. Fetch de los RPCs aislados (con paginación defensiva) ────────────────────────
  async function fetchBiologicoData_(force) {
    const key = `${_state.anio}|${_state.mesIni}|${_state.mesFin}`;
    if (!force && _state.bioFetchKey === key) return;

    _state.loading = true;
    renderLoadingState_();

    try {
      _state.bioRows = await fetchAllPaginated_('get_concentrado_por_biologico', {
        p_anio: _state.anio, p_mes_ini: _state.mesIni, p_mes_fin: _state.mesFin
      });
      _state.bioFetchKey = key;
    } catch (err) {
      console.error('[Concentrado] Error en RPC get_concentrado_por_biologico:', err);
      if (window.showToast) window.showToast('No se pudo cargar el concentrado de aplicaciones.', false, 'bad');
      _state.bioRows = [];
      _state.bioFetchKey = null;
    }

    _state.loading = false;
    renderConcentradoTable();
  }

  // Vista "Por clave": detalle crudo, mucho más pesado (~11k filas para toda la
  // jurisdicción) -- se pide una sola vez por rango de fechas, solo cuando el usuario
  // realmente activa esa pestaña, y se cachea igual que la vista por biológico.
  async function fetchClaveData_(force) {
    const key = `${_state.anio}|${_state.mesIni}|${_state.mesFin}`;
    if (!force && _state.claveFetchKey === key) return;

    _state.loading = true;
    renderLoadingState_();

    try {
      _state.claveRows = await fetchAllPaginated_('get_concentrado_aplicaciones', {
        p_anio: _state.anio, p_mes_ini: _state.mesIni, p_mes_fin: _state.mesFin
      });
      _state.claveFetchKey = key;
    } catch (err) {
      console.error('[Concentrado] Error en RPC get_concentrado_aplicaciones:', err);
      if (window.showToast) window.showToast('No se pudo cargar el desglose por clave.', false, 'bad');
      _state.claveRows = [];
      _state.claveFetchKey = null;
    }

    _state.loading = false;
    renderConcentradoTable();
  }

  function fetchActivo_(force) {
    return _state.vista === 'clave' ? fetchClaveData_(force) : fetchBiologicoData_(force);
  }

  // ── 4. Agregación en cliente (por unidad, según la vista activa) ────────────────────
  function computeUnitAggregate_(clues) {
    if (_state.vista === 'clave') {
      const rowsUnidad = _state.claveRows.filter(r => r.clues === clues);
      const porClave = {};
      let totalGeneral = 0;
      rowsUnidad.forEach(r => {
        const val = Number(r.total_dosis || 0);
        porClave[normUp_(r.variable_sis)] = val;
        totalGeneral += val;
      });
      return { totalGeneral, porFuente: porClave };
    }

    const rowsUnidad = _state.bioRows.filter(r => r.clues === clues);
    const porBiologico = {};
    let totalGeneral = 0;
    rowsUnidad.forEach(r => {
      const val = Number(r.total_dosis || 0);
      porBiologico[r.biologico] = val;
      totalGeneral += val;
    });
    return { totalGeneral, porFuente: porBiologico };
  }

  // Unidades visibles bajo el filtro actual de municipio/búsqueda (sin considerar año/mes,
  // eso ya lo resolvió el RPC). Se usa tanto para renderizar filas como para los KPIs, así
  // ambos siempre están sincronizados.
  function unidadesVisiblesFiltro_() {
    let out = _state.unidades;
    if (_state.municipio) out = out.filter(u => normUp_(u.municipio) === _state.municipio);
    if (_state.busqueda) {
      out = out.filter(u => normUp_(u.nombre).includes(_state.busqueda) || normUp_(u.clues).includes(_state.busqueda));
    }
    return out;
  }

  // Suma, para el conjunto de unidades visible ahora mismo, el total por fuente (biológico
  // o clave según la vista) — una sola pasada que alimenta tanto la decisión de qué
  // columnas mostrar como los KPIs.
  function computeScopeAggregate_(unidades) {
    const porFuenteTotal = {};
    let grandTotal = 0;
    let unidadesConDatos = 0;

    unidades.forEach(u => {
      const agg = computeUnitAggregate_(u.clues);
      if (agg.totalGeneral > 0) unidadesConDatos++;
      grandTotal += agg.totalGeneral;
      Object.keys(agg.porFuente).forEach(k => { porFuenteTotal[k] = (porFuenteTotal[k] || 0) + agg.porFuente[k]; });
    });

    return { porFuenteTotal, grandTotal, unidadesConDatos };
  }

  // Columnas a mostrar para la vista activa. Siempre las mismas 17 (o el set completo de
  // claves con datos en el rango de fechas elegido) -- un set de columnas predecible es
  // más fácil de escanear que uno que cambia de tamaño según el filtro de unidad/municipio.
  // Las celdas en 0 se muestran como "—", no se ocultan columnas completas.
  function columnasActivas_(scopeAgg) {
    if (_state.vista === 'clave') {
      return Object.keys(scopeAgg.porFuenteTotal)
        .map(c => {
          const parent = _state.claveToBiologico.get(c) || 'OTROS';
          return { key: c, label: c, sublabel: biologicoLabelFor_(parent), color: null, fontColor: null, parentIdx: biologicoOrderIndex_(parent) };
        })
        // Orden del esquema de vacunación (BCG primero... Influenza casi al final, como
        // biologicos_catalogo.orden_biologico), no alfabético por clave SIS.
        .sort((a, b) => (a.parentIdx - b.parentIdx) || a.key.localeCompare(b.key));
    }
    return CONCENTRADO_BIOLOGICOS_ALL;
  }

  // ── 5. Render de filtros (poblado inicial de selects) ───────────────────────────────
  function renderFiltros_() {
    const selAnio = $('concFilterAnio');
    const selMesIni = $('concFilterMesIni');
    const selMesFin = $('concFilterMesFin');
    const selMuni = $('concFilterMunicipio');
    const inpBusqueda = $('concSearchUnidad');

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (selAnio && !selAnio.dataset.filled) {
      selAnio.innerHTML = ['2026', '2025'].map(a => `<option value="${a}">${a}</option>`).join('');
      selAnio.value = String(_state.anio);
      selAnio.dataset.filled = '1';
      selAnio.addEventListener('change', async () => {
        _state.anio = Number(selAnio.value);
        _state.mesFin = await resolveMesCorte_(_state.anio);
        if (_state.mesIni > _state.mesFin) _state.mesIni = _state.mesFin;
        if (selMesFin) selMesFin.value = String(_state.mesFin);
        if (selMesIni) selMesIni.value = String(_state.mesIni);
        await buildAliasLookup_(_state.anio);
        fetchActivo_(true);
      });
    }

    if (selMesIni && !selMesIni.dataset.filled) {
      selMesIni.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
      selMesIni.value = String(_state.mesIni);
      selMesIni.dataset.filled = '1';
      selMesIni.addEventListener('change', () => {
        _state.mesIni = Number(selMesIni.value);
        if (_state.mesIni > _state.mesFin) { _state.mesFin = _state.mesIni; if (selMesFin) selMesFin.value = String(_state.mesFin); }
        fetchActivo_(true);
      });
    }

    if (selMesFin && !selMesFin.dataset.filled) {
      selMesFin.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
      selMesFin.value = String(_state.mesFin);
      selMesFin.dataset.filled = '1';
      selMesFin.addEventListener('change', () => {
        _state.mesFin = Number(selMesFin.value);
        if (_state.mesFin < _state.mesIni) { _state.mesIni = _state.mesFin; if (selMesIni) selMesIni.value = String(_state.mesIni); }
        fetchActivo_(true);
      });
    }

    if (selMuni) {
      const munis = municipiosVisibles_();
      selMuni.innerHTML = '<option value="">Todos los municipios</option>' + munis.map(m => `<option value="${m}">${m.charAt(0) + m.slice(1).toLowerCase()}</option>`).join('');
      selMuni.value = _state.municipio;
      if (!selMuni.dataset.bound) {
        selMuni.addEventListener('change', () => {
          _state.municipio = selMuni.value;
          renderConcentradoTable();
        });
        selMuni.dataset.bound = '1';
      }
    }

    // Búsqueda libre por nombre o CLUES -- reemplaza al select de "Unidad": escribir es
    // más rápido que abrir un desplegable de 70+ opciones para encontrar una en concreto.
    if (inpBusqueda && !inpBusqueda.dataset.bound) {
      inpBusqueda.addEventListener('input', () => {
        _state.busqueda = normUp_(inpBusqueda.value);
        renderConcentradoTable();
      });
      inpBusqueda.dataset.bound = '1';
    }
  }

  function renderBiologicoVistaTabs_() {
    const tabBio = $('concTabBiologico');
    const tabClave = $('concTabClave');
    if (tabBio && !tabBio.dataset.bound) {
      tabBio.addEventListener('click', () => setVista_('biologico'));
      tabBio.dataset.bound = '1';
    }
    if (tabClave && !tabClave.dataset.bound) {
      tabClave.addEventListener('click', () => setVista_('clave'));
      tabClave.dataset.bound = '1';
    }
  }

  // Mes de corte "inteligente": reutiliza la RPC get_rda_max_mes ya existente (solo
  // lectura, no se toca ni se modifica RDA) para no sumar meses del año que todavía no
  // tienen ninguna captura -- evita diluir los totales con ceros estructurales.
  async function resolveMesCorte_(anio) {
    try {
      const { data, error } = await window.supabase.rpc('get_rda_max_mes', { p_anio: anio });
      if (error) throw error;
      const maxMes = Number(data);
      if (maxMes >= 1 && maxMes <= 12) return maxMes;
    } catch (err) {
      console.warn('[Concentrado] No se pudo resolver el mes de corte automático, se usa diciembre:', err);
    }
    return 12;
  }

  function setVista_(vista) {
    if (_state.vista === vista) return;
    _state.vista = vista;
    const tabBio = $('concTabBiologico');
    const tabClave = $('concTabClave');
    if (tabBio) tabBio.classList.toggle('active', vista === 'biologico');
    if (tabClave) tabClave.classList.toggle('active', vista === 'clave');
    if (typeof window.syncTabGroupIndicator === 'function') {
      window.syncTabGroupIndicator('#concVistaTabs');
    }
    // Carga perezosa: el detalle por clave (pesado) solo se pide la primera vez que se
    // activa esa pestaña para el rango de fechas actual, no en cada carga del panel.
    fetchActivo_(false);
  }

  // ── 6. Render de la tabla (unidad -> subtotal municipal -> total jurisdiccional) ──
  function renderLoadingState_() {
    const tbody = $('concTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="20" class="p-6 text-center text-surface-onVariant/60">Cargando concentrado de aplicaciones…</td></tr>`;
  }

  function renderConcentradoTable() {
    const thead = $('concThead');
    const tbody = $('concTbody');
    if (!thead || !tbody) return;

    if (_state.loading) { renderLoadingState_(); return; }

    const unidadesFiltradas = unidadesVisiblesFiltro_();
    const scopeAgg = computeScopeAggregate_(unidadesFiltradas);
    const cols = columnasActivas_(scopeAgg);

    updateSearchCount_(unidadesFiltradas.length);

    // Encabezado + primeras 3 columnas pegadas (sticky) en ambos ejes -- al hacer scroll
    // horizontal por las ~17 columnas de biológico, o vertical por las unidades, CLUES/
    // Unidad/Municipio y el encabezado de columna siguen siempre visibles.
    const leftClues = 0, leftUnidad = STICKY_W.clues, leftMuni = STICKY_W.clues + STICKY_W.unidad;
    const stickyLeftAll = STICKY_W.clues + STICKY_W.unidad + STICKY_W.municipio;

    thead.innerHTML = `<tr>
      <th class="p-4 text-left sticky top-0 bg-slate-50" style="left:${leftClues}px; width:${STICKY_W.clues}px; min-width:${STICKY_W.clues}px; z-index:30;">CLUES</th>
      <th class="p-4 text-left sticky top-0 bg-slate-50" style="left:${leftUnidad}px; width:${STICKY_W.unidad}px; min-width:${STICKY_W.unidad}px; z-index:30;">Unidad</th>
      <th class="p-4 text-left sticky top-0 bg-slate-50" style="left:${leftMuni}px; width:${STICKY_W.municipio}px; min-width:${STICKY_W.municipio}px; z-index:30;">Municipio</th>
      ${cols.map(c => `<th class="p-4 text-center sticky top-0 z-20 bg-slate-50 whitespace-nowrap">${c.label}${c.sublabel ? `<div class="font-normal text-slate-400" style="font-size:9px; text-transform:none;">${c.sublabel}</div>` : ''}</th>`).join('')}
      <th class="p-4 text-center sticky top-0 z-20 bg-slate-50">TOTAL</th>
    </tr>`;

    if (cols.length === 0) {
      tbody.innerHTML = `<tr><td class="p-6 text-center text-surface-onVariant/60">No hay claves SIS con datos en este rango de fechas.</td></tr>`;
      renderKpis_(scopeAgg.grandTotal, scopeAgg.unidadesConDatos, unidadesFiltradas.length, {}, []);
      return;
    }

    if (unidadesFiltradas.length === 0) {
      tbody.innerHTML = `<tr><td class="p-8 text-center text-surface-onVariant/60">Ninguna unidad coincide con "${$('concSearchUnidad')?.value || ''}". Revisa el nombre/CLUES o quita el filtro de municipio.</td></tr>`;
      renderKpis_(0, 0, 0, {}, cols);
      return;
    }

    const munisVisibles = _state.municipio ? [_state.municipio] : municipiosVisibles_();
    // Con una búsqueda activa, la tabla ya no representa "todas las unidades del
    // municipio/jurisdicción" sino solo las que coinciden con el texto -- una fila de
    // TOTAL MUNICIPAL/JURISDICCIONAL en ese contexto es engañosa (parece un total real
    // cuando es apenas la suma de los resultados filtrados), así que se ocultan.
    const mostrarTotalMunicipal = !_state.busqueda;
    const mostrarTotalJurisdiccional = !_state.busqueda && !_state.municipio && munisVisibles.length > 1;

    // Devuelve el atributo class+style COMPLETO de una celda pegada (sticky) -- se usa tal
    // cual en el <td>, no se concatena a medias con otro class="" (evita comillas rotas).
    const tdSticky = (leftPx, w, extraClass) =>
      `class="p-4 sticky z-10 bg-surface ${extraClass || ''}" style="left:${leftPx}px; width:${w}px; min-width:${w}px;"`;

    let filasHtml = '';

    munisVisibles.forEach(muni => {
      const unidadesMuni = unidadesFiltradas.filter(u => normUp_(u.municipio) === muni);
      if (unidadesMuni.length === 0) return;

      let subtotalesPorCol = {};
      let subtotalGeneral = 0;

      unidadesMuni.forEach(u => {
        const agg = computeUnitAggregate_(u.clues);

        filasHtml += `<tr class="group hover:bg-primary/10 border-b border-outline-variant/20">
          <td ${tdSticky(leftClues, STICKY_W.clues, 'whitespace-nowrap font-semibold group-hover:bg-primary/10')}>${u.clues}</td>
          <td ${tdSticky(leftUnidad, STICKY_W.unidad, 'truncate group-hover:bg-primary/10')} title="${u.nombre}">${u.nombre}</td>
          <td ${tdSticky(leftMuni, STICKY_W.municipio, 'whitespace-nowrap group-hover:bg-primary/10')}>${muni.charAt(0) + muni.slice(1).toLowerCase()}</td>
          ${cols.map(c => {
            const v = agg.porFuente[c.key] || 0;
            subtotalesPorCol[c.key] = (subtotalesPorCol[c.key] || 0) + v;
            return `<td class="p-4 text-center">${v ? v.toLocaleString('es-MX') : '—'}</td>`;
          }).join('')}
          <td class="p-4 text-center font-bold">${agg.totalGeneral.toLocaleString('es-MX')}</td>
        </tr>`;

        subtotalGeneral += agg.totalGeneral;
      });

      if (mostrarTotalMunicipal) {
        filasHtml += `<tr class="bg-primary/5 font-extrabold">
          <td class="p-4 sticky left-0 z-10 bg-primary/5" colspan="3" style="width:${stickyLeftAll}px; min-width:${stickyLeftAll}px;">TOTAL MUNICIPAL — ${muni.charAt(0) + muni.slice(1).toLowerCase()}</td>
          ${cols.map(c => `<td class="p-4 text-center">${(subtotalesPorCol[c.key] || 0).toLocaleString('es-MX')}</td>`).join('')}
          <td class="p-4 text-center">${subtotalGeneral.toLocaleString('es-MX')}</td>
        </tr>`;
      }
    });

    if (mostrarTotalJurisdiccional) {
      filasHtml += `<tr class="bg-primary/10 font-extrabold" style="border-top: 2px solid rgba(0,51,102,0.4);">
        <td class="p-4 sticky left-0 z-10 bg-primary/10" colspan="3" style="width:${stickyLeftAll}px; min-width:${stickyLeftAll}px;">TOTAL JURISDICCIONAL (JURISDICCIÓN SANITARIA 1)</td>
        ${cols.map(c => `<td class="p-4 text-center">${(scopeAgg.porFuenteTotal[c.key] || 0).toLocaleString('es-MX')}</td>`).join('')}
        <td class="p-4 text-center">${scopeAgg.grandTotal.toLocaleString('es-MX')}</td>
      </tr>`;
    }

    tbody.innerHTML = filasHtml || `<tr><td colspan="${cols.length + 4}" class="p-6 text-center text-surface-onVariant/60">Sin aplicaciones registradas para este filtro.</td></tr>`;

    renderKpis_(scopeAgg.grandTotal, scopeAgg.unidadesConDatos, unidadesFiltradas.length, scopeAgg.porFuenteTotal, cols);
  }

  function updateSearchCount_(n) {
    const el = $('concSearchCount');
    if (!el) return;
    const total = _state.unidades.length;
    el.textContent = (_state.busqueda || _state.municipio) ? `${n} de ${total} unidades` : '';
  }

  function renderKpis_(totalGeneral, unidadesConDatos, totalUnidades, totalesPorCol, cols) {
    const kpiTotal = $('concKpiTotal');
    const kpiUnidades = $('concKpiUnidades');
    const kpiPrincipal = $('concKpiPrincipal');

    if (kpiTotal) kpiTotal.textContent = totalGeneral.toLocaleString('es-MX');
    if (kpiUnidades) kpiUnidades.textContent = `${unidadesConDatos} / ${totalUnidades}`;

    if (kpiPrincipal) {
      let mejor = null;
      cols.forEach(c => {
        if (c.key === 'OTROS') return;
        const v = totalesPorCol[c.key] || 0;
        if (!mejor || v > mejor.v) mejor = { label: c.label, v };
      });
      kpiPrincipal.textContent = mejor ? `${mejor.label} (${mejor.v.toLocaleString('es-MX')})` : '—';
    }
  }

  // ── 7. Exportación a Excel institucional (ExcelJS) ──────────────────────────────────
  async function exportConcentradoExcel() {
    if (!window.ExcelJS) {
      if (window.showToast) window.showToast('Librería de exportación no cargada todavía, intenta de nuevo en unos segundos.', false, 'bad');
      return;
    }
    const rowsActivas = _state.vista === 'clave' ? _state.claveRows : _state.bioRows;
    if (_state.loading || rowsActivas.length === 0) {
      if (window.showToast) window.showToast('No hay datos cargados para exportar.', false, 'bad');
      return;
    }

    if (window.showToast) window.showToast('Generando concentrado en Excel…', true, 'info');

    const unidadesFiltradas = unidadesVisiblesFiltro_();
    const scopeAgg = computeScopeAggregate_(unidadesFiltradas);
    const cols = columnasActivas_(scopeAgg);
    const munisVisibles = _state.municipio ? [_state.municipio] : municipiosVisibles_();
    // Con una búsqueda activa, la tabla ya no representa "todas las unidades del
    // municipio/jurisdicción" sino solo las que coinciden con el texto -- una fila de
    // TOTAL MUNICIPAL/JURISDICCIONAL en ese contexto es engañosa (parece un total real
    // cuando es apenas la suma de los resultados filtrados), así que se ocultan.
    const mostrarTotalMunicipal = !_state.busqueda;
    const mostrarTotalJurisdiccional = !_state.busqueda && !_state.municipio && munisVisibles.length > 1;

    if (cols.length === 0) {
      if (window.showToast) window.showToast('No hay aplicaciones registradas en este filtro para exportar.', false, 'bad');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIREVAQ';
    const ws = wb.addWorksheet('Concentrado', { views: [{ showGridLines: false }] });

    const totalCols = 3 + cols.length + 1; // CLUES, Unidad, Municipio, ...bio/clave, TOTAL

    // Encabezado institucional
    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell('A1').value = 'SECRETARÍA DE SALUD DE QUERÉTARO — JURISDICCIÓN SANITARIA 1';
    ws.getCell('A1').font = { name: 'Arial Nova', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E46' } };
    ws.getRow(1).height = 32;

    const ambitoLabel = unidadesFiltradas.length === 1
      ? unidadesFiltradas[0].nombre
      : (_state.municipio ? `MUNICIPIO DE ${_state.municipio}` : 'JURISDICCIÓN SANITARIA 1 (TODOS LOS MUNICIPIOS)');
    const vistaLabel = _state.vista === 'clave' ? 'Desglosado por clave SIS' : 'Agrupado por biológico';
    const mesesLabel = `Meses ${_state.mesIni} a ${_state.mesFin} de ${_state.anio}`;

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell('A2').value = `CONCENTRADO DE APLICACIONES POR UNIDAD — ${ambitoLabel}`;
    ws.getCell('A2').font = { name: 'Arial Nova', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(3, 1, 3, totalCols);
    ws.getCell('A3').value = `${vistaLabel} · ${mesesLabel} · Emitido: ${new Date().toLocaleDateString('es-MX')}`;
    ws.getCell('A3').font = { name: 'Arial Nova', size: 9, italic: true, color: { argb: 'FF64748B' } };
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

    const HEADER_ROW = 5;
    const headerRow = ws.getRow(HEADER_ROW);
    headerRow.values = ['CLUES', 'UNIDAD', 'MUNICIPIO', ...cols.map(c => c.sublabel ? `${c.label}\n(${c.sublabel})` : c.label), 'TOTAL'];
    headerRow.height = 26;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial Nova', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const colDef = cols[colNumber - 4];
      const bg = colDef && colDef.color ? colDef.color : '2F3E46';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
    });

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    let rowCursor = HEADER_ROW + 1;
    let jurisRowIdxs = [];

    munisVisibles.forEach(muni => {
      const unidadesMuni = unidadesFiltradas.filter(u => normUp_(u.municipio) === muni);
      if (unidadesMuni.length === 0) return;

      const muniStartRow = rowCursor;

      unidadesMuni.forEach(u => {
        const agg = computeUnitAggregate_(u.clues);
        const row = ws.getRow(rowCursor);
        row.getCell(1).value = u.clues;
        row.getCell(2).value = u.nombre;
        row.getCell(3).value = muni.charAt(0) + muni.slice(1).toLowerCase();
        cols.forEach((c, i) => { row.getCell(4 + i).value = agg.porFuente[c.key] || 0; });
        const totalColIdx = 4 + cols.length;
        row.getCell(totalColIdx).value = { formula: `SUM(D${rowCursor}:${ws.getColumn(totalColIdx - 1).letter}${rowCursor})` };

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial Nova', size: 9, bold: colNumber === totalColIdx };
          cell.border = borderThin;
          if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
        });
        rowCursor++;
      });

      if (mostrarTotalMunicipal) {
        const muniEndRow = rowCursor - 1;
        const subtotalRow = ws.getRow(rowCursor);
        ws.mergeCells(rowCursor, 1, rowCursor, 3);
        subtotalRow.getCell(1).value = `TOTAL MUNICIPAL — ${muni.charAt(0) + muni.slice(1).toLowerCase()}`;
        cols.forEach((c, i) => {
          const colLetter = ws.getColumn(4 + i).letter;
          subtotalRow.getCell(4 + i).value = { formula: `SUM(${colLetter}${muniStartRow}:${colLetter}${muniEndRow})` };
        });
        const totalColIdx = 4 + cols.length;
        const totalColLetter = ws.getColumn(totalColIdx).letter;
        subtotalRow.getCell(totalColIdx).value = { formula: `SUM(${totalColLetter}${muniStartRow}:${totalColLetter}${muniEndRow})` };

        subtotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial Nova', size: 9, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
          cell.border = borderThin;
          if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
        });

        jurisRowIdxs.push(rowCursor);
        rowCursor++;
      }
    });

    if (mostrarTotalJurisdiccional && jurisRowIdxs.length > 0) {
      const jurisRow = ws.getRow(rowCursor);
      ws.mergeCells(rowCursor, 1, rowCursor, 3);
      jurisRow.getCell(1).value = 'TOTAL JURISDICCIONAL (JURISDICCIÓN SANITARIA 1)';
      const totalColIdx = 4 + cols.length;
      cols.forEach((c, i) => {
        const colLetter = ws.getColumn(4 + i).letter;
        const refs = jurisRowIdxs.map(r => `${colLetter}${r}`).join('+');
        jurisRow.getCell(4 + i).value = { formula: refs };
      });
      const totalColLetter = ws.getColumn(totalColIdx).letter;
      jurisRow.getCell(totalColIdx).value = { formula: jurisRowIdxs.map(r => `${totalColLetter}${r}`).join('+') };

      jurisRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Arial Nova', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0D7FF' } };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF4C1D95' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };
        if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
      });
      rowCursor++;
    }

    // Autoajuste de ancho de columnas
    ws.columns.forEach((column, idx) => {
      if (idx < 3) { column.width = idx === 1 ? 38 : 16; return; }
      let maxLen = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value;
        if (val && typeof val === 'object' && val.formula) return;
        const str = String(val || '');
        if (str.length > maxLen) maxLen = str.length;
      });
      column.width = Math.max(12, Math.min(maxLen + 4, 26));
    });

    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW, showGridLines: false }];

    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
    };
    ws.headerFooter = {
      oddFooter: `&L&"Arial Nova,Regular"&8SIREVAQ — Concentrado de Aplicaciones &C&"Arial Nova,Regular"&8Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} &R&"Arial Nova,Regular"&8Página &P de &N`
    };

    const anioLabel = _state.anio;
    const mesesFile = `${_state.mesIni}-${_state.mesFin}`;
    const ambitoFile = (ambitoLabel || 'JURISDICCIONAL').replace(/\s+/g, '_');
    const fechaFile = new Date().toISOString().slice(0, 10);
    const fileName = `Concentrado_Aplicaciones_${ambitoFile}_${anioLabel}_${mesesFile}_${fechaFile}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    if (window.showToast) window.showToast('🟢 Concentrado exportado a Excel.', true, 'good');
  }

  // ── 8. Init (llamado de forma perezosa desde activateOpsTab) ────────────────────────
  async function initConcentradoPanel() {
    const btnExport = $('btnExportConcentrado');
    if (btnExport && !btnExport.dataset.bound) {
      btnExport.addEventListener('click', exportConcentradoExcel);
      btnExport.dataset.bound = '1';
    }
    const btnRefresh = $('btnRefreshConcentrado');
    if (btnRefresh && !btnRefresh.dataset.bound) {
      btnRefresh.addEventListener('click', () => fetchActivo_(true));
      btnRefresh.dataset.bound = '1';
    }

    renderBiologicoVistaTabs_();
    if (typeof window.syncTabGroupIndicator === 'function') {
      setTimeout(() => window.syncTabGroupIndicator('#concVistaTabs'), 60);
    }

    if (_state.initialized) {
      renderFiltros_();
      renderConcentradoTable();
      return;
    }

    try {
      await loadUnidadesVisibles_();
      await buildAliasLookup_(_state.anio);
      _state.mesFin = await resolveMesCorte_(_state.anio);
      if (_state.mesIni > _state.mesFin) _state.mesIni = _state.mesFin;
      renderFiltros_();
      _state.initialized = true;
      await fetchBiologicoData_(true);
    } catch (err) {
      console.error('[Concentrado] Error inicializando el panel:', err);
      if (window.showToast) window.showToast('Error al inicializar el concentrado de aplicaciones.', false, 'bad');
    }
  }

  window.initConcentradoPanel = initConcentradoPanel;

})(window);
